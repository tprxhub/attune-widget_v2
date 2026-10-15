from conftest import register_family
import copy
from types import SimpleNamespace

import pytest

from app.billing import create_checkout, settled_plan
from app.api import stripe_field
from app.config import Settings

URL = "/api/v1/billing/plans"


@pytest.fixture
def family(client):
    return register_family(client, "pricing-family@example.com")

def catalogue():
    return {"currency": "AED", "plans": [
        {"months": months, "amount": months * 1000 + 99, "label": f"{months} months", "note": "Guided play", "featured": months == 6, "badge_text": "Most popular"}
        for months in (1, 3, 6, 9, 12)
    ]}


def test_public_catalogue_defaults_and_super_admin_save(client, platform_admin, family):
    assert [plan["months"] for plan in client.get(URL).json()["plans"]] == [1, 3, 6]
    assert client.put(URL, json=catalogue()).status_code == 401
    assert client.put(URL, headers=family, json=catalogue()).status_code == 403
    assert client.put(URL, headers=platform_admin, json=catalogue()).status_code == 200
    assert client.get(URL).json() == catalogue()
    events = client.get("/api/v1/audit-events", headers=platform_admin).json()
    assert any(event["action"] == "billing.pricing_updated" for event in events)


@pytest.mark.parametrize("change", [
    lambda p: p.update(plans=[]),
    lambda p: p["plans"].append(copy.deepcopy(p["plans"][0])),
    lambda p: p["plans"][0].update(months=3),
    lambda p: p["plans"][0].update(months=0),
    lambda p: p["plans"][0].update(months=61),
    lambda p: p["plans"][0].update(amount=0),
    lambda p: p["plans"][0].update(amount=99.9),
    lambda p: p["plans"][0].update(label=" "),
    lambda p: p["plans"][0].update(badge_text=" "),
    lambda p: p["plans"][0].update(badge_text="x" * 61),
])
def test_invalid_pricing_does_not_replace_catalogue(client, platform_admin, change):
    payload = catalogue()
    change(payload)
    assert client.put(URL, headers=platform_admin, json=payload).status_code == 422
    assert [plan["months"] for plan in client.get(URL).json()["plans"]] == [1, 3, 6]


def test_checkout_uses_saved_catalogue_and_rejects_unlisted_plans(client, platform_admin, family, monkeypatch):
    from app.billing import CheckoutResult
    child = client.get("/api/v1/children", headers=family).json()[0]
    client.put(URL, headers=platform_admin, json=catalogue())
    captured = {}
    def fake_checkout(*args, **kwargs):
        captured.update(kwargs)
        return CheckoutResult("cs_custom", "https://checkout.stripe.test/session")
    monkeypatch.setattr("app.api.create_checkout", fake_checkout)
    result = client.post("/api/v1/billing/checkout", headers=family, json={"child_id": child["id"], "plan": "9m", "amount": 1})
    assert result.status_code == 201
    assert captured["catalog"]["9m"]["amount"] == 9099
    assert client.post("/api/v1/billing/checkout", headers=family, json={"child_id": child["id"], "plan": "2m"}).status_code == 422


def test_checkout_snapshot_survives_future_price_changes(monkeypatch):
    import stripe
    captured = {}
    def fake_create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="cs_snapshot", url="https://checkout.stripe.test/session")
    monkeypatch.setattr(stripe.checkout.Session, "create", fake_create)
    settings = Settings(stripe_secret_key="sk_test", stripe_webhook_secret="whsec_test", billing_test_amount=None)
    source = {"9m": {"months": 9, "amount": 9099, "name": "Play Hub — Nine months"}}
    create_checkout(settings, user_id="u", email="test@example.com", child_id="c", plan="9m", catalog=source)
    assert captured["line_items"][0]["price_data"]["unit_amount"] == 9099
    source.clear()
    assert settled_plan(settings, {"metadata": captured["metadata"]}, stripe_field) == {"months": 9, "amount": 9099, "name": "Play Hub — Nine months"}
    captured["metadata"]["plan_months"] = "60"
    assert settled_plan(settings, {"metadata": captured["metadata"]}, stripe_field) is None


def test_signed_payment_keeps_purchased_term_after_plan_removal(client, platform_admin, family, monkeypatch):
    from datetime import date, datetime, timezone
    from app.api import add_months
    child = client.get("/api/v1/children", headers=family).json()[0]
    client.put(URL, headers=platform_admin, json=catalogue())
    event = {"id": "evt_old_quote", "type": "checkout.session.completed", "data": {"object": {
        "id": "cs_old_quote", "payment_intent": "pi_old_quote", "payment_status": "paid",
        "currency": "aed", "amount_total": 1, "created": int(datetime(2026, 1, 31, tzinfo=timezone.utc).timestamp()),
        "metadata": {"child_id": child["id"], "plan": "9m", "plan_months": "9", "plan_amount": "9099", "plan_label": "Nine months"},
    }}}
    monkeypatch.setattr("app.api.parse_webhook", lambda *args: event)
    replacement = catalogue()
    replacement["plans"] = replacement["plans"][:1]
    client.put(URL, headers=platform_admin, json=replacement)
    assert client.post("/api/v1/billing/webhook", content=b"signed").status_code == 422
    event["data"]["object"]["amount_total"] = 9099
    assert client.post("/api/v1/billing/webhook", content=b"signed").status_code == 200
    sub = client.get("/api/v1/children", headers=family).json()[0]["subscription"]
    assert sub["plan_name"] == "9m"
    assert sub["ends_on"] == add_months(date(2026, 1, 31), 9).isoformat()
    assert client.post("/api/v1/billing/webhook", content=b"signed").status_code == 200
    assert client.get("/api/v1/children", headers=family).json()[0]["subscription"]["ends_on"] == sub["ends_on"]


def test_each_plan_can_show_its_own_badge(client, platform_admin):
    payload = catalogue()
    for index, plan in enumerate(payload["plans"]):
        plan.update(featured=True, badge_text=f"Custom badge {index + 1}")
    response = client.put(URL, headers=platform_admin, json=payload)
    assert response.status_code == 200
    assert client.get(URL).json() == payload
    payload["plans"][1]["featured"] = False
    assert client.put(URL, headers=platform_admin, json=payload).status_code == 200
    assert [plan["featured"] for plan in client.get(URL).json()["plans"]] == [True, False, True, True, True]
