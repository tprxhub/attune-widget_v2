"""Paying during signup: verify the email, pay, then create the account, which takes the plan."""
from datetime import date, datetime, timezone

from app.billing import CheckoutResult, create_checkout
from app.security import create_signup_token

API = "/api/v1"
EMAIL = "paying.family@example.com"


def start_checkout(client, monkeypatch, session_id="cs_signup_1", email=EMAIL, plan="6m"):
    calls = {}

    def fake(*_, **kwargs):
        calls.update(kwargs)
        return CheckoutResult(session_id, "https://checkout.stripe.test/signup")

    monkeypatch.setattr("app.api.create_checkout", fake)
    response = client.post(f"{API}/billing/signup-checkout",
                           json={"email_token": create_signup_token(email), "plan": plan})
    return response, calls


def pay(client, monkeypatch, session_id="cs_signup_1", email=EMAIL, amount=33900, event_id="evt_signup_1"):
    paid = {
        "id": session_id,
        "created": int(datetime.now(timezone.utc).timestamp()),
        "payment_status": "paid",
        "amount_total": amount,
        "currency": "aed",
        "payment_intent": "pi_signup_1",
        "customer": "cus_signup_1",
        "metadata": {"kind": "signup", "signup_email": email, "plan": "6m", "plan_amount": "33900",
                     "plan_months": "6", "plan_label": "Play Hub — 6-Month"},
    }
    monkeypatch.setattr("app.api.parse_webhook",
                        lambda *_: {"id": event_id, "type": "checkout.session.completed", "data": {"object": paid}})
    return client.post(f"{API}/billing/webhook", content=b"event", headers={"stripe-signature": "sig"})


def status(client, session_id="cs_signup_1"):
    return client.get(f"{API}/billing/signup-checkout/{session_id}")


def register(client, token, email=EMAIL):
    return client.post(f"{API}/auth/register-family", json={
        "email": email, "guardian_name": "Paying Family", "child_name": "Noor",
        "password": "secure-password", "email_token": token,
    })


def test_pay_first_then_finish_signup_and_the_child_gets_the_plan(client, monkeypatch):
    response, calls = start_checkout(client, monkeypatch)
    assert response.status_code == 201
    assert response.json()["checkout_url"].startswith("https://checkout.stripe.test/")
    # A signup purchase: for the verified email, with no account or child yet.
    assert calls["child_id"] is None and calls["user_id"] is None and calls["email"] == EMAIL

    waiting = status(client).json()
    assert waiting["status"] == "pending" and "email_token" not in waiting

    assert pay(client, monkeypatch).status_code == 200
    assert pay(client, monkeypatch).status_code == 200  # Stripe retries are harmless
    paid = status(client).json()
    assert paid["status"] == "paid" and paid["email"] == EMAIL and paid["plan_label"] == "Play Hub — 6-Month"

    created = register(client, paid["email_token"])
    assert created.status_code == 201
    family = {"Authorization": f"Bearer {created.json()['access_token']}"}
    subscription = client.get(f"{API}/children", headers=family).json()[0]["subscription"]
    assert subscription["status"] == "active"
    assert subscription["plan_name"] == "6m"
    assert subscription["started_on"] == date.today().isoformat()
    assert status(client).json()["status"] == "claimed"


def test_a_payment_is_kept_for_a_family_that_signs_up_later(client, monkeypatch):
    start_checkout(client, monkeypatch)
    pay(client, monkeypatch)
    # They left after paying; days later they sign up again with the same (re-verified) email.
    created = register(client, create_signup_token(EMAIL))
    family = {"Authorization": f"Bearer {created.json()['access_token']}"}
    assert client.get(f"{API}/children", headers=family).json()[0]["subscription"]["status"] == "active"


def test_a_payment_confirmed_after_the_account_exists_is_applied_straight_away(client, monkeypatch):
    start_checkout(client, monkeypatch)
    created = register(client, create_signup_token(EMAIL))
    family = {"Authorization": f"Bearer {created.json()['access_token']}"}
    assert client.get(f"{API}/children", headers=family).json()[0]["subscription"]["status"] == "free"
    pay(client, monkeypatch)
    assert client.get(f"{API}/children", headers=family).json()[0]["subscription"]["status"] == "active"
    assert status(client).json()["status"] == "claimed"


def test_signup_checkout_needs_a_verified_email_and_a_new_one(client, monkeypatch):
    monkeypatch.setattr("app.api.create_checkout", lambda *_, **__: CheckoutResult("cs_x", "https://x"))
    for token in ["", "nonsense"]:
        assert client.post(f"{API}/billing/signup-checkout", json={"email_token": token, "plan": "6m"}).status_code in {403, 422}
    register(client, create_signup_token(EMAIL))
    assert start_checkout(client, monkeypatch)[0].status_code == 409
    assert start_checkout(client, monkeypatch, email="new@example.com", plan="99m")[0].status_code == 422


def test_an_underpaid_signup_payment_is_refused(client, monkeypatch):
    start_checkout(client, monkeypatch)
    assert pay(client, monkeypatch, amount=100).status_code == 422
    assert status(client).json()["status"] == "pending"


def test_unknown_session_and_another_familys_payment(client, monkeypatch):
    assert status(client, "cs_nope").status_code == 404
    start_checkout(client, monkeypatch)
    pay(client, monkeypatch)
    # Someone else signing up with a different email doesn't get it.
    other = register(client, create_signup_token("other@example.com"), email="other@example.com")
    family = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get(f"{API}/children", headers=family).json()[0]["subscription"]["status"] == "free"
    assert status(client).json()["status"] == "paid"


def test_the_stripe_session_for_a_signup_returns_to_signup(monkeypatch):
    import stripe

    from app.config import get_settings

    sent = {}

    class Session:
        id = "cs_live"
        url = "https://checkout.stripe.com/x"

    def fake_create(**kwargs):
        sent.update(kwargs)
        return Session()

    monkeypatch.setattr(stripe.checkout.Session, "create", fake_create)
    settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test", "stripe_webhook_secret": "whsec"})
    catalog = {"6m": {"amount": 33900, "months": 6, "name": "Play Hub — 6-Month"}}
    create_checkout(settings, user_id=None, email=EMAIL, child_id=None, plan="6m", catalog=catalog)
    assert "/signup?session_id=" in sent["success_url"]
    assert sent["cancel_url"].endswith("/signup?checkout=cancelled")
    assert "client_reference_id" not in sent
    assert sent["metadata"]["kind"] == "signup" and sent["metadata"]["signup_email"] == EMAIL
    assert sent["customer_email"] == EMAIL


def test_a_coupon_works_while_paying_first_and_counts_for_the_new_account(client, platform_admin, monkeypatch):
    from tests.test_discounts import discount

    assert client.post(f"{API}/billing/discounts", headers=platform_admin,
                       json=discount(code="first20", kind="percent", value=20)).status_code == 201
    token = create_signup_token(EMAIL)
    check = client.post(f"{API}/billing/discounts/check-signup",
                        json={"email_token": token, "code": "first20", "plan": "6m"})
    assert check.status_code == 200
    assert check.json()["final_amount"] == 33900 - 6780
    # Without a verified email the check is refused; a wrong code explains itself.
    assert client.post(f"{API}/billing/discounts/check-signup",
                       json={"email_token": "x", "code": "first20", "plan": "6m"}).status_code == 403
    assert client.post(f"{API}/billing/discounts/check-signup",
                       json={"email_token": token, "code": "nope", "plan": "6m"}).status_code == 422

    calls = {}

    def fake(*_, **kwargs):
        calls.update(kwargs)
        return CheckoutResult("cs_signup_1", "https://checkout.stripe.test/signup")

    monkeypatch.setattr("app.api.create_checkout", fake)
    started = client.post(f"{API}/billing/signup-checkout",
                          json={"email_token": token, "plan": "6m", "discount_code": "first20"})
    assert started.status_code == 201
    assert calls["discount"]["code"] == "FIRST20" and calls["discount"]["amount_off"] == 6780

    # Stripe charged the discounted amount; the webhook carries the discount in the metadata.
    paid = {
        "id": "cs_signup_1", "created": int(datetime.now(timezone.utc).timestamp()),
        "payment_status": "paid", "amount_total": 27120, "currency": "aed",
        "payment_intent": "pi_signup_1", "customer": "cus_signup_1",
        "metadata": {"kind": "signup", "signup_email": EMAIL, "plan": "6m", "plan_amount": "27120",
                     "plan_months": "6", "plan_label": "Play Hub — 6-Month (FIRST20)",
                     "discount_id": calls["discount"]["id"], "discount_code": "FIRST20",
                     "list_amount": "33900", "discount_amount": "6780"},
    }
    monkeypatch.setattr("app.api.parse_webhook",
                        lambda *_: {"id": "evt_c", "type": "checkout.session.completed", "data": {"object": paid}})
    assert client.post(f"{API}/billing/webhook", content=b"e", headers={"stripe-signature": "s"}).status_code == 200
    created = register(client, status(client).json()["email_token"])
    family = {"Authorization": f"Bearer {created.json()['access_token']}"}
    assert client.get(f"{API}/children", headers=family).json()[0]["subscription"]["status"] == "active"
    # The coupon is now used by this account (it was once per account).
    again = client.post(f"{API}/billing/discounts/check", headers=family, json={"code": "first20", "plan": "6m"})
    assert again.status_code == 422 and "already used" in again.json()["detail"]
    listed = {row["code"]: row for row in client.get(f"{API}/billing/discounts", headers=platform_admin).json()}
    assert listed["FIRST20"]["uses"] == 1
