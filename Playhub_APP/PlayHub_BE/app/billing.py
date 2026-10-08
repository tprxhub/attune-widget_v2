"""Stripe Checkout adapter. Entitlements are changed only by signed webhooks."""
from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings


# Prices are charged in UAE dirhams. Amounts are in fils (1 AED = 100 fils); keep them in step
# with PRICE_PLANS in the frontend (src/api/subscriptions.ts).
CURRENCY = "aed"

PLAN_CATALOG = {
    "3m": {"months": 3, "amount": 18900, "name": "Play Hub — 3 months"},
    "6m": {"months": 6, "amount": 33900, "name": "Play Hub — 6 months"},
    "12m": {"months": 12, "amount": 57900, "name": "Play Hub — 12 months"},
}


def plan_price(settings: Settings, plan: str | None) -> dict | None:
    """The plan as it is charged now: its catalogue price, or the test price while one is set."""
    selected = PLAN_CATALOG.get(plan or "")
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


def create_checkout(settings: Settings, *, user_id: str, email: str, child_id: str, plan: str) -> CheckoutResult:
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise BillingError("Stripe payments are not configured")
    selected = plan_price(settings, plan)
    if selected is None:
        raise BillingError("Unknown plan")
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
            metadata={"child_id": child_id, "plan": plan, "user_id": user_id},
            payment_intent_data={"metadata": {"child_id": child_id, "plan": plan, "user_id": user_id}},
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
