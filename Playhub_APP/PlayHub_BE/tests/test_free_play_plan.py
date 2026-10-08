from datetime import date, timedelta

from conftest import TestingSession

from app.models import Child, Subscription, SubscriptionStatus


def register_family(client, email="free@example.com"):
    response = client.post("/api/v1/auth/register-family", json={
        "email": email,
        "display_name": "Free Family",
        "guardian_name": "Free Guardian",
        "child_name": "Free Child",
        "password": "secure-password",
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def catalog(client, headers):
    response = client.get("/api/v1/play-plans", headers=headers)
    assert response.status_code == 200
    return response.json()


def has_steps(plan):
    return any(
        activity["instructions"] or activity["instructions_html"] or activity["video_url"]
        for dose in plan["play_doses"]
        for activity in dose["activities"]
    )


def make_plan_with_steps(client, admin, name):
    plan = client.post(
        "/api/v1/play-plans", headers=admin, json={"name": name, "slug": name.lower().replace(" ", "-")}
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses", headers=admin, json={"level": "rookie", "title": "Rookie"}
    ).json()
    assert client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=admin,
        json={"sequence": 0, "title": "Tap", "instructions": ["Do the thing"]},
    ).status_code == 201
    return plan["id"]


def test_free_family_sees_names_but_no_steps_until_they_choose_one_plan(client, platform_admin):
    first = make_plan_with_steps(client, platform_admin, "Pinch Free")
    second = make_plan_with_steps(client, platform_admin, "Bilateral Free")
    family = register_family(client)
    plans = {plan["id"]: plan for plan in catalog(client, family)}
    assert plans[first]["access_locked"] and plans[second]["access_locked"]
    assert plans[first]["name"] == "Pinch Free"
    assert not has_steps(plans[first])

    child = client.get("/api/v1/children", headers=family).json()[0]
    chosen = client.put(f"/api/v1/children/{child['id']}/free-play-plan", headers=family, json={"play_plan_id": first})
    assert chosen.status_code == 200
    assert chosen.json()["free_play_plan_id"] == first

    plans = {plan["id"]: plan for plan in catalog(client, family)}
    assert not plans[first]["access_locked"] and has_steps(plans[first])
    assert plans[second]["access_locked"] and not has_steps(plans[second])


def test_the_free_choice_cannot_be_changed_by_the_family(client, platform_admin):
    first = make_plan_with_steps(client, platform_admin, "Choice One")
    second = make_plan_with_steps(client, platform_admin, "Choice Two")
    family = register_family(client, "once@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    url = f"/api/v1/children/{child['id']}/free-play-plan"
    assert client.put(url, headers=family, json={"play_plan_id": first}).status_code == 200
    assert client.put(url, headers=family, json={"play_plan_id": first}).status_code == 200
    assert client.put(url, headers=family, json={"play_plan_id": second}).status_code == 409
    assert client.put(url, headers=family, json={"play_plan_id": None}).status_code == 403


def test_platform_staff_can_change_or_clear_the_free_choice(client, platform_admin):
    first = make_plan_with_steps(client, platform_admin, "Staff One")
    second = make_plan_with_steps(client, platform_admin, "Staff Two")
    family = register_family(client, "staff@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    url = f"/api/v1/children/{child['id']}/free-play-plan"
    assert client.put(url, headers=family, json={"play_plan_id": first}).status_code == 200
    assert client.put(url, headers=platform_admin, json={"play_plan_id": second}).json()["free_play_plan_id"] == second
    assert client.put(url, headers=platform_admin, json={"play_plan_id": None}).json()["free_play_plan_id"] is None


def test_a_subscribed_family_sees_every_plan_in_full(client, platform_admin):
    plan = make_plan_with_steps(client, platform_admin, "Paid Plan")
    family = register_family(client, "paid@example.com")
    child_id = client.get("/api/v1/children", headers=family).json()[0]["id"]
    with TestingSession() as db:
        sub = db.query(Subscription).filter_by(child_id=child_id).one()
        sub.status = SubscriptionStatus.ACTIVE
        sub.started_on = date.today()
        sub.ends_on = date.today() + timedelta(days=90)
        db.commit()
    plans = {p["id"]: p for p in catalog(client, family)}
    assert not plans[plan]["access_locked"] and has_steps(plans[plan])


def test_an_expired_subscription_falls_back_to_the_free_choice(client, platform_admin):
    plan = make_plan_with_steps(client, platform_admin, "Expired Plan")
    family = register_family(client, "expired@example.com")
    child_id = client.get("/api/v1/children", headers=family).json()[0]["id"]
    with TestingSession() as db:
        sub = db.query(Subscription).filter_by(child_id=child_id).one()
        sub.status = SubscriptionStatus.ACTIVE
        sub.started_on = date.today() - timedelta(days=100)
        sub.ends_on = date.today() - timedelta(days=1)
        db.commit()
        assert not db.get(Child, child_id).has_full_access
    assert {p["id"]: p for p in catalog(client, family)}[plan]["access_locked"]


def test_only_the_account_holder_chooses_and_only_published_plans(client, platform_admin):
    plan = make_plan_with_steps(client, platform_admin, "Hidden Plan")
    assert client.patch(
        f"/api/v1/play-plans/{plan}", headers=platform_admin, json={"publication_status": "locked"}
    ).status_code == 200
    family = register_family(client, "holder@example.com")
    other = register_family(client, "other@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    url = f"/api/v1/children/{child['id']}/free-play-plan"
    assert client.put(url, headers=other, json={"play_plan_id": plan}).status_code == 403
    assert client.put(url, headers=family, json={"play_plan_id": plan}).status_code == 409
