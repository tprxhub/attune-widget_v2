"""Stripe Checkout adapter. Entitlements are changed only by signed webhooks."""
from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings


# Prices are charged in UAE dirhams, in fils (1 AED = 100 fils).
# Legacy catalogue for checkouts created before editable pricing; new purchases use app.pricing.
CURRENCY = "aed"

PLAN_CATALOG = {
    "3m": {"months": 3, "amount": 18900, "name": "Play Hub — 3 months"},
    "6m": {"months": 6, "amount": 33900, "name": "Play Hub — 6 months"},
    "12m": {"months": 12, "amount": 57900, "name": "Play Hub — 12 months"},
}


def plan_price(settings: Settings, plan: str | None, catalog: dict | None = None) -> dict | None:
    """The plan as it is charged now: its catalogue price, or the test price while one is set."""
    selected = (PLAN_CATALOG if catalog is None else catalog).get(plan or "")
    if selected is None or settings.billing_test_amount is None:
        return selected
    return {**selected, "amount": settings.billing_test_amount, "name": f"{selected['name']} (test price)"}


def paid_in_full(session, plan: dict, field) -> bool:
    """True when a completed Checkout Session charged exactly this plan's price.

    With Stripe Adaptive Pricing switched on, a visitor abroad pays in their own currency; the
    session then reports that currency, and the AED amount sits under `currency_conversion`.
    """
    if field(session, "currency") == CURRENCY and field(session, "amount_total") == plan["amount"]:
        return True
    conversion = field(session, "currency_conversion") or {}
    return (
        field(conversion, "source_currency") == CURRENCY
        and field(conversion, "amount_total") == plan["amount"]
    )


class BillingError(RuntimeError):
    pass


@dataclass(frozen=True)
class CheckoutResult:
    id: str
    url: str


def create_checkout(settings: Settings, *, user_id: str, email: str, child_id: str, plan: str, catalog: dict | None = None) -> CheckoutResult:
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise BillingError("Stripe payments are not configured")
    selected = plan_price(settings, plan, catalog)
    if selected is None:
        raise BillingError("Unknown plan")
    metadata = {"child_id": child_id, "plan": plan, "user_id": user_id}
    if catalog is not None:
        metadata.update(plan_amount=str(selected["amount"]), plan_months=str(selected["months"]), plan_label=selected["name"])
    try:
        import stripe

        session = stripe.checkout.Session.create(
            api_key=settings.stripe_secret_key,
            mode="payment",
            customer_email=email,
            client_reference_id=child_id,
            success_url=f"{settings.frontend_base_url.rstrip('/')}/subscription?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_base_url.rstrip('/')}/subscription?checkout=cancelled",
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": CURRENCY,
                    "unit_amount": selected["amount"],
                    "product_data": {"name": selected["name"]},
                },
            }],
            metadata=metadata,
            payment_intent_data={"metadata": metadata},
        )
    except Exception as exc:
        raise BillingError("Stripe Checkout could not be started") from exc
    return CheckoutResult(id=session.id, url=session.url)


def parse_webhook(settings: Settings, payload: bytes, signature: str):
    if not settings.stripe_webhook_secret:
        raise BillingError("Stripe webhooks are not configured")
    try:
        import stripe

        return stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except Exception as exc:
        raise BillingError("Invalid Stripe webhook signature") from exc


def create_refund(settings: Settings, payment_intent_id: str, child_id: str) -> str:
    if not settings.stripe_secret_key:
        raise BillingError("Stripe payments are not configured")
    try:
        import stripe

        refund = stripe.Refund.create(
            api_key=settings.stripe_secret_key,
            payment_intent=payment_intent_id,
            reason="requested_by_customer",
            metadata={"child_id": child_id},
        )
    except Exception as exc:
        raise BillingError("Stripe could not process the refund") from exc
    return refund.id


def settled_plan(settings: Settings, session, field) -> dict | None:
    """Use the price frozen by our server in a signed Stripe session, including after catalogue edits."""
    metadata = field(session, "metadata", {}) or {}
    snapshot = [field(metadata, key) for key in ("plan_amount", "plan_months", "plan_label")]
    if not any(value is not None for value in snapshot):
        return plan_price(settings, field(metadata, "plan"))  # Checkouts created before editable pricing.
    try:
        amount, months = int(snapshot[0]), int(snapshot[1])
    except (TypeError, ValueError):
        return None
    if not 1 <= amount <= 100000000 or not 1 <= months <= 60 or field(metadata, "plan") != f"{months}m":
        return None
    if not isinstance(snapshot[2], str) or not snapshot[2].strip() or len(snapshot[2]) > 200:
        return None
    return {"amount": amount, "months": months, "name": snapshot[2]}
