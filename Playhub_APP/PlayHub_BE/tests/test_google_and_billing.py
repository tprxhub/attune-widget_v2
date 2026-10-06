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
        "amount_total": 33900,
        "currency": "aed",
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
    assert captured["line_items"][0]["price_data"]["unit_amount"] == 57900
    assert captured["line_items"][0]["price_data"]["currency"] == "aed"
    assert captured["metadata"] == {"child_id": "child-1", "plan": "12m", "user_id": "user-1"}


def test_refresh_swaps_a_valid_token_for_a_fresh_one_and_rejects_anonymous(client):
    assert client.post("/api/v1/auth/refresh").status_code == 401
    email = "refresh@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "display_name": "Re Fresh", "password": "ChangeMe123!", "role": "super_admin", "account_scope": "platform"})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "ChangeMe123!"}).json()["access_token"]
    fresh = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert fresh.status_code == 200
    new_token = fresh.json()["access_token"]
    assert new_token != token
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"}).status_code == 200


def test_play_plan_and_dose_credit_defaults_to_actor_and_can_be_edited(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Credit plan", "slug": "credit-plan"}).json()
    assert plan["created_by_name"] == "Platform Admin"
    named = client.post(
        "/api/v1/play-plans", headers=platform_admin,
        json={"name": "Named plan", "slug": "named-plan", "created_by_name": "Dr Jane Doe"},
    ).json()
    assert named["created_by_name"] == "Dr Jane Doe"
    patched = client.patch(f"/api/v1/play-plans/{named['id']}", headers=platform_admin, json={"created_by_name": "Sam Lee"}).json()
    assert patched["created_by_name"] == "Sam Lee"
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin,
        json={"level": "starter", "title": "Credit dose", "created_by_name": "Ann Ray"},
    ).json()
    assert dose["created_by_name"] == "Ann Ray"
    dose = client.patch(f"/api/v1/play-doses/{dose['id']}", headers=platform_admin, json={"created_by_name": "Bo Kim"}).json()
    assert dose["created_by_name"] == "Bo Kim"


def test_first_time_google_sign_in_creates_a_free_family_account(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.verify_google_credential",
        lambda *_: GoogleIdentity("google-fresh", "fresh.parent@gmail.com", "Fresh Parent", True),
    )
    body = {"credential": "x" * 100, "child_name": "Kai", "child_date_of_birth": "2021-05-01"}
    created = client.post("/api/v1/auth/google/register-family", json=body)
    assert created.status_code == 201
    headers = {"Authorization": f"Bearer {created.json()['access_token']}"}
    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert me["email"] == "fresh.parent@gmail.com" and me["display_name"] == "Fresh Parent"
    assert [child["name"] for child in client.get("/api/v1/children", headers=headers).json()] == ["Kai"]
    # The account now exists, so Google login works and a second registration is refused.
    assert client.post("/api/v1/auth/google", json={"credential": "x" * 100}).status_code == 200
    assert client.post("/api/v1/auth/google/register-family", json=body).status_code == 409
    # A Google account has no password, so password login cannot be used on it.
    assert client.post("/api/v1/auth/login", json={"email": "fresh.parent@gmail.com", "password": "anything-at-all"}).status_code == 401


def _ttp_employee(client, platform_admin, permissions, email="ttp@example.com"):
    invite = client.post("/api/v1/invitations", headers=platform_admin, json={
        "email": email, "display_name": "TTP Person", "role": "ttp_employee",
        "account_scope": "platform", "permissions": permissions,
    })
    assert invite.status_code == 201, invite.text
    accepted = client.post("/api/v1/invitations/accept", json={
        "token": invite.json()["acceptance_token"], "password": "secure-password",
    })
    assert accepted.status_code == 200, accepted.text
    return {"Authorization": f"Bearer {accepted.json()['access_token']}"}


def test_ttp_employee_only_reaches_the_pages_ticked_for_them(client, platform_admin):
    headers = _ttp_employee(client, platform_admin, ["audit", "plans"])
    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert me["role"] == "ttp_employee" and me["permissions"] == ["audit", "plans"]
    # Allowed pages
    assert client.get("/api/v1/audit-events", headers=headers).status_code == 200
    assert client.get("/api/v1/play-plans?include_inactive=true", headers=headers).status_code == 200
    created = client.post("/api/v1/play-plans", headers=headers, json={"name": "TTP plan", "slug": "ttp-plan"})
    assert created.status_code == 201
    # Pages that were not ticked
    assert client.get("/api/v1/admin/progress", headers=headers).status_code == 403
    assert client.post("/api/v1/organisations", headers=headers, json={"name": "Nope Org", "kind": "school", "seat_limit": 3, "billing_cycle": "annual"}).status_code == 403
    assert client.put("/api/v1/site-content/homepage", headers=headers, json={}).status_code == 403
    assert client.get("/api/v1/users", headers=headers).status_code == 403


def test_ttp_employee_can_edit_plans_but_cannot_delete_content(client, platform_admin):
    headers = _ttp_employee(client, platform_admin, ["plans"], "ttp.editor@example.com")
    plan = client.post(
        "/api/v1/play-plans",
        headers=headers,
        json={"name": "TTP editable", "slug": "ttp-editable"},
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=headers,
        json={"level": "rookie", "title": "Editable dose"},
    ).json()
    activity = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=headers,
        json={"sequence": 0, "title": "Editable activity"},
    ).json()

    assert client.patch(
        f"/api/v1/play-doses/{dose['id']}", headers=headers, json={"summary": "Updated"}
    ).status_code == 200
    assert client.delete(f"/api/v1/activities/{activity['id']}", headers=headers).status_code == 403
    assert client.delete(f"/api/v1/play-doses/{dose['id']}", headers=headers).status_code == 403


def test_super_admin_edits_ttp_permissions_and_only_they_manage_platform_staff(client, platform_admin):
    headers = _ttp_employee(client, platform_admin, ["team"])
    users = client.get("/api/v1/users", headers=platform_admin).json()
    ttp = next(user for user in users if user["role"] == "ttp_employee")
    # A TTP employee with Team access cannot add platform staff or see them.
    assert client.post("/api/v1/invitations", headers=headers, json={
        "email": "other@example.com", "role": "ttp_employee", "account_scope": "platform", "permissions": ["audit"],
    }).status_code == 403
    assert all(user["role"] not in {"super_admin", "ttp_employee"} for user in client.get("/api/v1/users", headers=headers).json())
    assert client.patch(f"/api/v1/users/{ttp['id']}", headers=headers, json={"is_active": False}).status_code == 403
    # Super Admin can change permissions, and the change applies on the next request.
    updated = client.patch(f"/api/v1/users/{ttp['id']}", headers=platform_admin, json={"permissions": ["audit", "children"]})
    assert updated.status_code == 200 and updated.json()["permissions"] == ["children", "audit"]
    assert client.get("/api/v1/audit-events", headers=headers).status_code == 200
    assert client.get("/api/v1/users", headers=headers).status_code == 200
    assert client.patch(f"/api/v1/users/{ttp['id']}", headers=platform_admin, json={"permissions": ["bogus"]}).status_code == 422
    # Deactivating the employee locks them out.
    assert client.patch(f"/api/v1/users/{ttp['id']}", headers=platform_admin, json={"is_active": False}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_audit_log_entries_are_limited_to_the_categories_ticked_for_a_ttp_employee(client, platform_admin):
    # Generate entries in several categories: accounts, content and billing.
    client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Audit plan", "slug": "audit-plan"})
    family = register_family(client, "billing.family@example.com")
    child_id = client.get("/api/v1/children", headers=family).json()[0]["id"]
    client.put(f"/api/v1/children/{child_id}/subscription", headers=platform_admin, json={"status": "active", "plan_name": "3m", "started_on": "2026-10-01", "ends_on": "2027-01-01"})

    everything = client.get("/api/v1/audit-events", headers=platform_admin).json()
    actions = {event["action"] for event in everything}
    assert any(a.startswith("play_plan.") for a in actions) and any(a.startswith("family.") for a in actions)
    assert any(a.startswith(("billing.", "subscription.")) for a in actions)

    page_only = _ttp_employee(client, platform_admin, ["audit"], "page.only@example.com")
    assert client.get("/api/v1/audit-events", headers=page_only).json() == []

    content_only = _ttp_employee(client, platform_admin, ["audit", "audit_content"], "content.only@example.com")
    seen = client.get("/api/v1/audit-events", headers=content_only).json()
    assert seen and all(event["action"].startswith(("play_", "activity.", "site_content.")) for event in seen)
    assert all(event["actor_name"] for event in seen if event["actor_id"])

    no_billing = _ttp_employee(client, platform_admin, ["audit", "audit_accounts", "audit_content", "audit_organisations", "audit_activity"], "no.billing@example.com")
    visible = client.get("/api/v1/audit-events", headers=no_billing).json()
    assert visible and not any(event["action"].startswith(("billing.", "subscription.")) for event in visible)

    # Category permissions without the page permission still do not open the page.
    without_page = _ttp_employee(client, platform_admin, ["audit_billing"], "no.page@example.com")
    assert client.get("/api/v1/audit-events", headers=without_page).status_code == 403


def test_admin_can_reorder_play_plans_and_play_doses(client, platform_admin):
    plans = [
        client.post("/api/v1/play-plans", headers=platform_admin, json={"name": name, "slug": name.lower()}).json()
        for name in ("Alpha", "Bravo", "Charlie")
    ]
    listed = [p["name"] for p in client.get("/api/v1/play-plans", headers=platform_admin).json()]
    assert listed == ["Alpha", "Bravo", "Charlie"]  # new plans join the end

    ids = [plans[2]["id"], plans[0]["id"], plans[1]["id"]]
    assert client.put("/api/v1/play-plans/order", json={"ids": ids}).status_code == 401
    assert client.put("/api/v1/play-plans/order", headers=platform_admin, json={"ids": ids + ["nope"]}).status_code == 422
    done = client.put("/api/v1/play-plans/order", headers=platform_admin, json={"ids": ids})
    assert done.status_code == 200
    assert [p["name"] for p in client.get("/api/v1/play-plans", headers=platform_admin).json()] == ["Charlie", "Alpha", "Bravo"]

    plan_id = plans[0]["id"]
    doses = [
        client.post(f"/api/v1/play-plans/{plan_id}/play-doses", headers=platform_admin, json={"level": level, "title": level}).json()
        for level in ("rookie", "starter", "pro")
    ]
    flipped = [doses[2]["id"], doses[0]["id"], doses[1]["id"]]
    result = client.put(f"/api/v1/play-plans/{plan_id}/play-doses/order", headers=platform_admin, json={"ids": flipped})
    assert result.status_code == 200
    assert [d["id"] for d in result.json()["play_doses"]] == flipped
    assert client.put(f"/api/v1/play-plans/{plan_id}/play-doses/order", headers=platform_admin, json={"ids": ["nope"]}).status_code == 422


def test_renewal_opens_in_the_last_days_and_carries_on_from_the_last_day(client, monkeypatch):
    from datetime import date, timedelta

    from app.api import add_months
    from app.database import get_db
    from app.main import app
    from app.models import Subscription, SubscriptionStatus

    family = register_family(client, "renew@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    monkeypatch.setattr(
        "app.api.create_checkout",
        lambda *_, **__: CheckoutResult("cs_renew", "https://checkout.stripe.test/session"),
    )

    def set_period(last_day: date) -> None:
        db = next(app.dependency_overrides[get_db]())
        try:
            sub = db.query(Subscription).filter_by(child_id=child["id"]).one_or_none() or Subscription(child_id=child["id"])
            sub.status, sub.plan_name = SubscriptionStatus.ACTIVE, "3m"
            sub.started_on, sub.ends_on = date.today() - timedelta(days=80), last_day
            db.add(sub)
            db.commit()
        finally:
            db.close()

    def buy():
        return client.post("/api/v1/billing/checkout", headers=family, json={"child_id": child["id"], "plan": "6m"})

    set_period(date.today() + timedelta(days=40))
    assert buy().status_code == 409
    assert client.get("/api/v1/children", headers=family).json()[0]["subscription"]["renewal_open"] is False

    last_day = date.today() + timedelta(days=5)
    set_period(last_day)
    assert client.get("/api/v1/children", headers=family).json()[0]["subscription"]["renewal_open"] is True
    assert buy().status_code == 201

    paid = {
        "id": "cs_renew",
        "created": int(datetime.now(timezone.utc).timestamp()),
        "payment_status": "paid",
        "amount_total": 33900,
        "currency": "aed",
        "payment_intent": "pi_renew",
        "metadata": {"child_id": child["id"], "plan": "6m"},
    }
    monkeypatch.setattr(
        "app.api.parse_webhook",
        lambda *_: {"id": "evt_renew", "type": "checkout.session.completed", "data": {"object": paid}},
    )
    assert client.post("/api/v1/billing/webhook", content=b"event", headers={"stripe-signature": "sig"}).status_code == 200
    renewed = client.get("/api/v1/children", headers=family).json()[0]["subscription"]
    assert renewed["ends_on"] == add_months(last_day, 6).isoformat()

    # Refunding the renewal gives back only the renewal: the earlier paid days stay.
    monkeypatch.setattr("app.api.create_refund", lambda *_: "re_renew")
    refunded = client.post(f"/api/v1/billing/refund/{child['id']}", headers=family).json()
    assert refunded["status"] == "active"
    assert refunded["ends_on"] == last_day.isoformat()


def test_payment_check_accepts_aed_and_stripe_local_currency_conversion():
    from app.api import stripe_field
    from app.billing import PLAN_CATALOG, paid_in_full

    plan = PLAN_CATALOG["6m"]
    assert paid_in_full({"currency": "aed", "amount_total": 33900}, plan, stripe_field)
    # A visitor in the UK paid in pounds through Adaptive Pricing; the AED price still matches.
    converted = {"currency": "gbp", "amount_total": 7300,
                 "currency_conversion": {"source_currency": "aed", "amount_total": 33900}}
    assert paid_in_full(converted, plan, stripe_field)
    assert not paid_in_full({"currency": "aed", "amount_total": 100}, plan, stripe_field)
    assert not paid_in_full({"currency": "gbp", "amount_total": 33900}, plan, stripe_field)
