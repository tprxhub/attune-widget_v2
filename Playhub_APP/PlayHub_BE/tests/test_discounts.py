from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.config import get_settings
from conftest import TestingSession, register_family

URL = "/api/v1/billing/discounts"
TODAY = date.today()


def discount(**overrides):
    body = {
        "code": "welcome10", "title": "Welcome offer", "description": "10% off your first plan",
        "kind": "percent", "value": 10, "plans": [], "once_per_account": True,
    }
    body.update(overrides)
    return body


@pytest.fixture
def family(client):
    return register_family(client, "discount-family@example.com")


@pytest.fixture
def stripe_ready(monkeypatch):
    """Real create_checkout with Stripe's API replaced; returns what Stripe would have been sent."""
    import stripe

    settings = get_settings()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test")
    monkeypatch.setattr(settings, "billing_test_amount", None)
    sent = []

    def fake_create(**kwargs):
        sent.append(kwargs)
        return SimpleNamespace(id=f"cs_{len(sent)}", url="https://checkout.stripe.test/session")

    monkeypatch.setattr(stripe.checkout.Session, "create", fake_create)
    return sent


def pay(client, monkeypatch, sent, n):
    """Deliver the signed webhook for the n-th checkout that was started."""
    session = sent[n - 1]
    amount = session["line_items"][0]["price_data"]["unit_amount"]
    event = {"id": f"evt_{n}", "type": "checkout.session.completed", "data": {"object": {
        "id": f"cs_{n}", "payment_intent": f"pi_{n}", "payment_status": "paid",
        "currency": "aed", "amount_total": amount, "metadata": session["metadata"],
    }}}
    monkeypatch.setattr("app.api.parse_webhook", lambda *args: event)
    return client.post("/api/v1/billing/webhook", content=b"signed")


def test_only_a_super_admin_manages_discounts(client, platform_admin, family):
    for method, path in (("get", URL), ("post", URL), ("put", f"{URL}/x"), ("delete", f"{URL}/x")):
        kwargs = {"json": discount()} if method in {"post", "put"} else {}
        assert getattr(client, method)(path, headers=family, **kwargs).status_code == 403
    created = client.post(URL, headers=platform_admin, json=discount())
    assert created.status_code == 201, created.text
    assert created.json()["code"] == "WELCOME10"  # codes are stored in capitals
    assert created.json()["status"] == "active" and created.json()["uses"] == 0
    assert client.post(URL, headers=platform_admin, json=discount(code="Welcome10")).status_code == 409
    listed = client.get(URL, headers=platform_admin).json()
    assert [row["code"] for row in listed] == ["WELCOME10"]
    events = client.get("/api/v1/audit-events", headers=platform_admin).json()
    assert any(event["action"] == "billing.discount_created" for event in events)


@pytest.mark.parametrize("change", [
    {"code": "a!"}, {"kind": "percent", "value": 95}, {"kind": "percent", "value": 0},
    {"plans": [0]}, {"starts_on": str(TODAY), "ends_on": str(TODAY - timedelta(days=1))},
    {"title": " "}, {"max_uses": 0},
])
def test_invalid_discounts_are_refused(client, platform_admin, change):
    assert client.post(URL, headers=platform_admin, json=discount(**change)).status_code == 422


def test_offers_show_what_this_person_can_use_best_first(client, platform_admin, family):
    for body in (
        discount(code="TEN", value=10),
        discount(code="FLAT50", kind="amount", value=5000, title="AED 50 off"),
        discount(code="SECRET", value=50, show_in_offers=False),
        discount(code="PAUSED", value=40, is_active=False),
        discount(code="LATER", value=40, starts_on=str(TODAY + timedelta(days=3))),
        discount(code="OVER", value=40, ends_on=str(TODAY - timedelta(days=1))),
    ):
        assert client.post(URL, headers=platform_admin, json=body).status_code == 201
    offers = client.get("/api/v1/billing/offers", headers=family).json()
    # AED 50 beats 10% of the dearest default plan (AED 339 -> AED 33.90).
    assert [offer["code"] for offer in offers] == ["FLAT50", "TEN"]
    statuses = {row["code"]: row["status"] for row in client.get(URL, headers=platform_admin).json()}
    assert statuses == {"TEN": "active", "FLAT50": "active", "SECRET": "active", "PAUSED": "paused",
                        "LATER": "scheduled", "OVER": "ended"}


def test_checking_a_code_explains_the_saving_or_why_not(client, platform_admin, family):
    client.post(URL, headers=platform_admin, json=discount(code="CAP", value=50, max_discount=5000))
    client.post(URL, headers=platform_admin, json=discount(code="SIXONLY", plans=[6]))
    client.post(URL, headers=platform_admin, json=discount(code="HUGE", kind="amount", value=99999))
    client.post(URL, headers=platform_admin, json=discount(code="OVER", ends_on=str(TODAY - timedelta(days=1))))
    check = lambda code, plan="3m": client.post(f"{URL}/check", headers=family, json={"code": code, "plan": plan})

    capped = check(" cap ").json()  # spaces and lower case are fine
    assert capped == {"code": "CAP", "title": "Welcome offer", "list_amount": 18900,
                      "discount_amount": 5000, "final_amount": 13900}
    assert "6-month plan only" in check("SIXONLY").json()["detail"]
    assert check("SIXONLY", "6m").json()["discount_amount"] == 3390
    # Never below Stripe's AED 2.00 minimum.
    assert check("HUGE", "1m").json()["final_amount"] == 200
    assert check("OVER").json()["detail"] == "This offer has ended."
    assert check("NOPE").json()["detail"].startswith("That code isn’t valid")


def test_a_discounted_checkout_charges_less_and_counts_once_paid(client, platform_admin, family, stripe_ready,
                                                                  monkeypatch):
    created = client.post(URL, headers=platform_admin, json=discount(code="SAVE20", value=20, max_uses=1)).json()
    child = client.get("/api/v1/children", headers=family).json()[0]
    started = client.post("/api/v1/billing/checkout", headers=family,
                          json={"child_id": child["id"], "plan": "3m", "discount_code": "save20"})
    assert started.status_code == 201, started.text
    line = stripe_ready[0]["line_items"][0]["price_data"]
    assert line["unit_amount"] == 18900 - 3780
    assert "SAVE20" in line["product_data"]["name"]
    assert stripe_ready[0]["metadata"]["discount_amount"] == "3780"

    # Nothing is used up until Stripe confirms the payment.
    assert client.get(URL, headers=platform_admin).json()[0]["uses"] == 0
    assert pay(client, monkeypatch, stripe_ready, 1).status_code == 200
    assert client.get("/api/v1/children", headers=family).json()[0]["subscription"]["status"] == "active"
    row = client.get(URL, headers=platform_admin).json()[0]
    assert (row["uses"], row["total_saved"], row["status"]) == (1, 3780, "used_up")
    # The subscription keeps what was actually charged, which the Overview's revenue adds up.
    with TestingSession() as db:
        from app.models import Subscription
        assert db.query(Subscription).filter_by(child_id=child["id"]).one().amount_paid == 18900 - 3780
    # The same webhook again doesn't count twice.
    assert pay(client, monkeypatch, stripe_ready, 1).status_code == 200
    assert client.get(URL, headers=platform_admin).json()[0]["uses"] == 1

    other = register_family(client, "discount-other@example.com")
    used_up = client.post(f"{URL}/check", headers=other, json={"code": "SAVE20", "plan": "3m"})
    assert used_up.json()["detail"] == "This offer has been fully used."
    # A used code stays for the records: it can be paused, not deleted or renamed.
    assert client.delete(f"{URL}/{created['id']}", headers=platform_admin).status_code == 409
    assert client.put(f"{URL}/{created['id']}", headers=platform_admin,
                      json=discount(code="RENAMED", value=20, max_uses=1)).status_code == 409
    paused = client.put(f"{URL}/{created['id']}", headers=platform_admin,
                        json=discount(code="SAVE20", value=20, max_uses=1, is_active=False))
    assert paused.json()["status"] == "paused"


def test_once_per_account_and_first_subscription_only(client, platform_admin, family, stripe_ready, monkeypatch):
    client.post(URL, headers=platform_admin, json=discount(code="ONCE", value=10))
    client.post(URL, headers=platform_admin, json=discount(code="FIRST", value=15, new_customers_only=True,
                                                           once_per_account=False))
    child = client.get("/api/v1/children", headers=family).json()[0]
    client.post("/api/v1/billing/checkout", headers=family, json={"child_id": child["id"], "plan": "1m",
                                                                  "discount_code": "ONCE"})
    assert pay(client, monkeypatch, stripe_ready, 1).status_code == 200
    check = lambda code: client.post(f"{URL}/check", headers=family, json={"code": code, "plan": "3m"}).json()
    assert check("ONCE")["detail"] == "You’ve already used this code."
    assert check("FIRST")["detail"] == "This offer is for a first subscription only."
    assert [offer["code"] for offer in client.get("/api/v1/billing/offers", headers=family).json()] == []
    # A checkout with a refused code is refused too, before reaching Stripe.
    refused = client.post("/api/v1/billing/checkout", headers=family,
                          json={"child_id": child["id"], "plan": "3m", "discount_code": "ONCE"})
    assert refused.status_code in (409, 422)
    assert len(stripe_ready) == 1


def test_an_unused_discount_can_be_deleted(client, platform_admin):
    created = client.post(URL, headers=platform_admin, json=discount()).json()
    assert client.delete(f"{URL}/{created['id']}", headers=platform_admin).status_code == 204
    assert client.get(URL, headers=platform_admin).json() == []
    with TestingSession() as db:
        from app.models import Discount
        assert db.query(Discount).count() == 0


def test_paused_and_not_yet_started_codes_are_refused_with_a_reason(client, platform_admin, family):
    client.post(URL, headers=platform_admin, json=discount(code="PAUSED", is_active=False))
    client.post(URL, headers=platform_admin, json=discount(code="SOON", starts_on=str(TODAY + timedelta(days=2))))
    check = lambda code: client.post(f"{URL}/check", headers=family, json={"code": code, "plan": "3m"}).json()
    assert check("PAUSED")["detail"] == "This code isn’t active right now."
    assert check("SOON")["detail"].startswith("This offer starts on")
