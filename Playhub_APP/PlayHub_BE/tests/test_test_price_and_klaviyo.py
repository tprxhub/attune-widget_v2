from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest

from app import mailer
from app.billing import CheckoutResult, create_checkout, plan_price
from app.config import Settings, get_settings
from app.mailer import OutgoingEmail, klaviyo_event, send_email


def register_family(client, email="tester@example.com"):
    response = client.post("/api/v1/auth/register-family", json={
        "email": email,
        "display_name": "Tester",
        "guardian_name": "Tester Guardian",
        "child_name": "Tester Child",
        "password": "secure-password",
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


SAVED = {"6m": {"months": 6, "amount": 33900, "name": "Play Hub — 6-Month"}}


def test_an_old_test_price_setting_is_ignored():
    """Checkouts charge the saved plan price even if the server still has BILLING_TEST_AMOUNT set."""
    assert plan_price(Settings(), "6m", SAVED)["amount"] == 33900
    assert plan_price(Settings(billing_test_amount=200), "6m", SAVED) == SAVED["6m"]
    assert plan_price(Settings(billing_test_amount=200), "nope", SAVED) is None


def test_checkout_charges_the_saved_price_not_a_test_price(monkeypatch):
    captured = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="cs_test", url="https://checkout.stripe.test/session")

    import stripe

    monkeypatch.setattr(stripe.checkout.Session, "create", fake_create)
    create_checkout(
        Settings(stripe_secret_key="sk_test", stripe_webhook_secret="whsec_test", billing_test_amount=200),
        user_id="user-1",
        email="family@example.com",
        child_id="child-1",
        plan="3m",
        catalog={"3m": {"months": 3, "amount": 18900, "name": "Play Hub — 3-Month"}},
    )
    line = captured["line_items"][0]["price_data"]
    assert line["unit_amount"] == 18900
    assert line["currency"] == "aed"
    assert "test price" not in line["product_data"]["name"]


def test_webhook_activates_a_plan_paid_at_the_test_price(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "billing_test_amount", 200)
    family = register_family(client)
    child = client.get("/api/v1/children", headers=family).json()[0]
    monkeypatch.setattr(
        "app.api.create_checkout",
        lambda *_, **__: CheckoutResult("cs_test_price", "https://checkout.stripe.test/session"),
    )
    assert client.post(
        "/api/v1/billing/checkout", headers=family, json={"child_id": child["id"], "plan": "3m"}
    ).status_code == 201
    paid = {
        "id": "cs_test_price",
        "created": int(datetime.now(timezone.utc).timestamp()),
        "payment_status": "paid",
        "amount_total": 200,
        "currency": "aed",
        "payment_intent": "pi_test_price",
        "metadata": {"child_id": child["id"], "plan": "3m", "plan_amount": "200", "plan_months": "3", "plan_label": "Play Hub — 3-Month (test price)"},
    }
    monkeypatch.setattr(
        "app.api.parse_webhook",
        lambda *_: {"id": "evt_test_price", "type": "checkout.session.completed", "data": {"object": paid}},
    )
    assert client.post(
        "/api/v1/billing/webhook", content=b"event", headers={"stripe-signature": "sig"}
    ).status_code == 200
    subscription = client.get("/api/v1/children", headers=family).json()[0]["subscription"]
    assert subscription["status"] == "active"
    assert subscription["plan_name"] == "3m"


def test_klaviyo_event_carries_the_email_for_the_flow():
    event = klaviyo_event(OutgoingEmail("a@example.com", "Hello", "Body"), "Play Hub Email")
    attributes = event["data"]["attributes"]
    assert attributes["properties"] == {"subject": "Hello", "text": "Body"}
    assert attributes["metric"]["data"]["attributes"]["name"] == "Play Hub Email"
    assert attributes["profile"]["data"]["attributes"]["email"] == "a@example.com"
    assert attributes["unique_id"]


def test_emails_go_through_klaviyo_when_a_key_is_set(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "klaviyo_private_key", "pk_test_key")
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(202, request=httpx.Request("POST", url))

    monkeypatch.setattr(mailer.httpx, "post", fake_post)
    send_email(OutgoingEmail("a@example.com", "Reset", "Link"))
    assert len(calls) == 1
    url, kwargs = calls[0]
    assert url == "https://a.klaviyo.com/api/events"
    assert kwargs["headers"]["Authorization"] == "Klaviyo-API-Key pk_test_key"
    assert kwargs["json"]["data"]["attributes"]["properties"]["subject"] == "Reset"


def test_klaviyo_failures_are_logged_not_raised(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "klaviyo_private_key", "pk_test_key")

    def failing_post(url, **_):
        return httpx.Response(401, request=httpx.Request("POST", url))

    monkeypatch.setattr(mailer.httpx, "post", failing_post)
    send_email(OutgoingEmail("a@example.com", "Reset", "Link"))
