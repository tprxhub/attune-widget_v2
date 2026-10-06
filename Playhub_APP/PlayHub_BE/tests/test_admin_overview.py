from datetime import date, timedelta

from tests.test_google_and_billing import _ttp_employee, register_family


def _family_with_subscription(client, platform_admin, email, ends_in_days):
    family = register_family(client, email)
    child_id = client.get("/api/v1/children", headers=family).json()[0]["id"]
    today = date.today()
    response = client.put(f"/api/v1/children/{child_id}/subscription", headers=platform_admin, json={
        "status": "active", "plan_name": "6m",
        "started_on": (today - timedelta(days=60)).isoformat(),
        "ends_on": (today + timedelta(days=ends_in_days)).isoformat(),
    })
    assert response.status_code == 200
    return family, child_id


def test_super_admin_overview_has_every_section(client, platform_admin):
    _family_with_subscription(client, platform_admin, "ending@example.com", 5)
    _family_with_subscription(client, platform_admin, "steady@example.com", 90)
    org = client.post("/api/v1/organisations", headers=platform_admin, json={"name": "Full School", "seat_limit": 1})
    assert org.status_code == 201

    data = client.get("/api/v1/admin/overview", headers=platform_admin).json()
    assert all(data["access"].values())
    assert data["children"]["individual"] == 2 and data["children"]["never_logged"] == 2
    assert data["billing"] == {
        "currency": "AED", "active": 2, "ending_14d": 1, "ended_30d": 0, "free_families": 0,
        "paid_30d": 0, "by_plan": {"6m": 2},
    }
    assert data["organisations"]["total"] == 1 and data["organisations"]["seats_total"] == 1
    assert len(data["progress"]["weekly"]) == 8
    assert data["audit"]["recent"], "recent activity should list the subscription changes"

    # The account filter narrows children, billing and organisations alike.
    individual = client.get("/api/v1/admin/overview?scope=individual", headers=platform_admin).json()
    assert individual["children"]["organisation"] == 0 and individual["organisations"]["total"] == 0


def test_ttp_employee_overview_only_contains_what_they_were_given(client, platform_admin):
    _family_with_subscription(client, platform_admin, "family@example.com", 30)
    headers = _ttp_employee(client, platform_admin, ["children"])
    data = client.get("/api/v1/admin/overview", headers=headers).json()
    assert data["access"]["children"] and not data["access"]["billing"]
    assert data["children"]["total"] == 1
    for hidden in ("progress", "organisations", "team", "billing", "plans", "audit", "homepage"):
        assert data[hidden] is None, hidden

    nothing = _ttp_employee(client, platform_admin, [], email="new@example.com")
    empty = client.get("/api/v1/admin/overview", headers=nothing).json()
    assert not any(empty["access"].values()) and empty["children"] is None
    # Families and organisation staff never reach the Overview.
    family = register_family(client, "curious@example.com")
    assert client.get("/api/v1/admin/overview", headers=family).status_code == 403


def test_only_billing_access_can_change_a_subscription(client, platform_admin):
    _, child_id = _family_with_subscription(client, platform_admin, "paying@example.com", 30)
    body = {"status": "cancelled", "plan_name": None, "started_on": None, "ends_on": None}
    children_only = _ttp_employee(client, platform_admin, ["children"])
    assert client.put(f"/api/v1/children/{child_id}/subscription", headers=children_only, json=body).status_code == 403
    billing = _ttp_employee(client, platform_admin, ["billing"], email="billing@example.com")
    assert client.put(f"/api/v1/children/{child_id}/subscription", headers=billing, json=body).status_code == 200
    data = client.get("/api/v1/admin/overview", headers=billing).json()
    assert data["billing"]["active"] == 0 and data["children"] is None
