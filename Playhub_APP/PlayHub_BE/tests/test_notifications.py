from datetime import datetime, timezone

from app.mailer import SENT


def register_family(client, email="notify@example.com"):
    SENT.clear()
    response = client.post("/api/v1/auth/register-family", json={
        "email": email,
        "display_name": "Notify Family",
        "guardian_name": "Notify Guardian",
        "child_name": "Ayla",
        "password": "secure-password",
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def sent_to(email):
    return [message for message in SENT if message.to == email]


def test_a_new_family_gets_a_welcome_email(client):
    register_family(client)
    [welcome] = sent_to("notify@example.com")
    assert welcome.subject == "Welcome to Play Hub"
    assert "Ayla’s account is ready" in welcome.text
    assert "/dashboard" in welcome.text


def test_invitations_email_the_activation_link_and_a_new_link_replaces_it(client, platform_admin):
    organisation = client.post("/api/v1/organisations", headers=platform_admin, json={"name": "Sunny School"}).json()
    SENT.clear()
    invitation = client.post("/api/v1/invitations", headers=platform_admin, json={
        "email": "invitee@example.com", "display_name": "Invitee", "role": "moderator",
        "account_scope": "organisation", "organisation_id": organisation["id"],
    }).json()
    [email] = sent_to("invitee@example.com")
    assert email.subject == "You’re invited to Play Hub"
    assert "as Moderator at Sunny School" in email.text
    assert f"/accept-invite?token={invitation['acceptance_token']}" in email.text

    renewed = client.post(f"/api/v1/invitations/{invitation['id']}/activation", headers=platform_admin).json()
    assert f"/accept-invite?token={renewed['acceptance_token']}" in sent_to("invitee@example.com")[-1].text


def test_payment_refund_and_failed_refund_each_email_the_family(client, monkeypatch):
    family = register_family(client, "payer@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    paid = {
        "id": "cs_notify", "created": int(datetime.now(timezone.utc).timestamp()), "payment_status": "paid",
        "amount_total": 33900, "currency": "aed", "payment_intent": "pi_notify", "customer": "cus_notify",
        "metadata": {"child_id": child["id"], "plan": "6m"},
    }
    monkeypatch.setattr(
        "app.api.parse_webhook",
        lambda *_: {"id": "evt_notify", "type": "checkout.session.completed", "data": {"object": paid}},
    )
    SENT.clear()
    for _ in range(2):  # Stripe may deliver the same event twice; the family is emailed once.
        assert client.post("/api/v1/billing/webhook", content=b"e", headers={"stripe-signature": "s"}).status_code == 200
    [receipt] = sent_to("payer@example.com")
    assert receipt.subject == "Your Play Hub subscription is active"
    assert "AED 339.00" in receipt.text and "Ayla now has every Play Plan" in receipt.text

    monkeypatch.setattr("app.api.create_refund", lambda *_: "re_notify")
    assert client.post(f"/api/v1/billing/refund/{child['id']}", headers=family).status_code == 200
    assert sent_to("payer@example.com")[-1].subject == "Your Play Hub refund has started"

    monkeypatch.setattr(
        "app.api.parse_webhook",
        lambda *_: {"id": "evt_refund_notify", "type": "refund.failed",
                    "data": {"object": {"id": "re_notify", "status": "failed"}}},
    )
    assert client.post("/api/v1/billing/webhook", content=b"e", headers={"stripe-signature": "s"}).status_code == 200
    assert sent_to("payer@example.com")[-1].subject == "We couldn’t complete your Play Hub refund"


def test_disabling_and_enabling_an_account_emails_its_owner(client, platform_admin):
    register_family(client, "toggle@example.com")
    user = next(u for u in client.get("/api/v1/users", headers=platform_admin).json() if u["email"] == "toggle@example.com")
    SENT.clear()
    client.patch(f"/api/v1/users/{user['id']}", headers=platform_admin, json={"is_active": False})
    client.patch(f"/api/v1/users/{user['id']}", headers=platform_admin, json={"is_active": False})
    client.patch(f"/api/v1/users/{user['id']}", headers=platform_admin, json={"is_active": True})
    assert [m.subject for m in sent_to("toggle@example.com")] == [
        "Your Play Hub account has been disabled",
        "Your Play Hub account is active again",
    ]
