from datetime import datetime, timezone

import jwt

from app.billing import CheckoutResult, create_checkout
from app.config import Settings, get_settings
from app.google_identity import GoogleIdentity


def register_family(client, email="family@example.com"):
    response = client.post("/api/v1/auth/register-family", json={
        "email": email,
        "display_name": "Family",
        "guardian_name": "Family Guardian",
        "child_name": "Family Child",
        "password": "secure-password",
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_google_login_verifies_and_links_existing_authoritative_account(client, monkeypatch):
    register_family(client, "person@gmail.com")
    monkeypatch.setattr(
        "app.api.verify_google_credential",
        lambda *_: GoogleIdentity("google-123", "person@gmail.com", "Person", True),
    )

    response = client.post("/api/v1/auth/google", json={"credential": "x" * 100})
    assert response.status_code == 200
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )
    assert me.json()["email"] == "person@gmail.com"


def test_google_login_does_not_create_or_unsafe_link_accounts(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.verify_google_credential",
        lambda *_: GoogleIdentity("google-new", "missing@gmail.com", "Missing", True),
    )
    assert client.post("/api/v1/auth/google", json={"credential": "x" * 100}).status_code == 404

    register_family(client, "person@custom.example")
    monkeypatch.setattr(
        "app.api.verify_google_credential",
        lambda *_: GoogleIdentity("google-custom", "person@custom.example", "Person", False),
    )
    assert client.post("/api/v1/auth/google", json={"credential": "x" * 100}).status_code == 409


def test_access_tokens_require_the_expected_issuer_and_audience(client):
    settings = get_settings()
    bad = jwt.encode(
        {
            "sub": "someone",
            "iss": "wrong",
            "aud": settings.jwt_audience,
            "jti": "id",
            "iat": 1,
            "exp": 4_102_444_800,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_stripe_checkout_webhook_and_refund_flow(client, monkeypatch):
    family = register_family(client)
    child = client.get("/api/v1/children", headers=family).json()[0]
    monkeypatch.setattr(
        "app.api.create_checkout",
        lambda *_, **__: CheckoutResult("cs_test_123", "https://checkout.stripe.test/session"),
    )
    checkout = client.post(
        "/api/v1/billing/checkout",
        headers=family,
        json={"child_id": child["id"], "plan": "6m"},
    )
    assert checkout.status_code == 201
    assert checkout.json()["checkout_url"].startswith("https://checkout.stripe.test/")

    paid = {
        "id": "cs_test_123",
        "created": int(datetime.now(timezone.utc).timestamp()),
        "payment_status": "paid",
        "amount_total": 6900,
        "currency": "gbp",
        "payment_intent": "pi_test_123",
        "customer": "cus_test_123",
        "metadata": {"child_id": child["id"], "plan": "6m"},
    }
    monkeypatch.setattr(
        "app.api.parse_webhook",
        lambda *_: {"id": "evt_test_123", "type": "checkout.session.completed", "data": {"object": paid}},
    )
    first = client.post("/api/v1/billing/webhook", content=b"event", headers={"stripe-signature": "sig"})
    second = client.post("/api/v1/billing/webhook", content=b"event", headers={"stripe-signature": "sig"})
    assert first.status_code == second.status_code == 200
    subscription = client.get("/api/v1/children", headers=family).json()[0]["subscription"]
    assert subscription["status"] == "active"
    assert subscription["plan_name"] == "6m"
    assert subscription["payment_managed"] is True

    monkeypatch.setattr("app.api.create_refund", lambda *_: "re_test_123")
    refunded = client.post(f"/api/v1/billing/refund/{child['id']}", headers=family)
    assert refunded.status_code == 200
    assert refunded.json()["status"] == "cancelled"

    monkeypatch.setattr(
        "app.api.parse_webhook",
        lambda *_: {
            "id": "evt_refund_failed",
            "type": "refund.failed",
            "data": {"object": {"id": "re_test_123", "status": "failed"}},
        },
    )
    assert client.post(
        "/api/v1/billing/webhook", content=b"event", headers={"stripe-signature": "sig"}
    ).status_code == 200
    restored = client.get("/api/v1/children", headers=family).json()[0]["subscription"]
    assert restored["status"] == "active"


def test_checkout_rejects_cross_account_child(client, monkeypatch):
    first = register_family(client, "first@example.com")
    second = register_family(client, "second@example.com")
    child = client.get("/api/v1/children", headers=second).json()[0]
    monkeypatch.setattr(
        "app.api.create_checkout",
        lambda *_, **__: CheckoutResult("cs_test", "https://checkout.stripe.test/session"),
    )
    response = client.post(
        "/api/v1/billing/checkout",
        headers=first,
        json={"child_id": child["id"], "plan": "3m"},
    )
    assert response.status_code == 403


def test_checkout_adapter_sends_fixed_server_side_price_and_metadata(monkeypatch):
    captured = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="cs_test", url="https://checkout.stripe.test/session")

    from types import SimpleNamespace
    import stripe

    monkeypatch.setattr(stripe.checkout.Session, "create", fake_create)
    result = create_checkout(
        Settings(stripe_secret_key="sk_test", stripe_webhook_secret="whsec_test"),
        user_id="user-1",
        email="family@example.com",
        child_id="child-1",
        plan="12m",
    )
    assert result.id == "cs_test"
    assert captured["mode"] == "payment"
    assert captured["line_items"][0]["price_data"]["unit_amount"] == 11900
    assert captured["metadata"] == {"child_id": "child-1", "plan": "12m", "user_id": "user-1"}
