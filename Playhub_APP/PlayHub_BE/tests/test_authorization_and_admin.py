def register_user(client, *, email, role, scope, organisation_id=None):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "display_name": email.split("@")[0].title(),
            "password": "secure-password",
            "role": role,
            "account_scope": scope,
            "organisation_id": organisation_id,
        },
    )
    assert response.status_code == 201
    token = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secure-password"}
    ).json()["access_token"]
    return response.json(), {"Authorization": f"Bearer {token}"}


def test_org_scope_seats_suspension_and_role_escalation_are_enforced(client, platform_admin):
    org = client.post(
        "/api/v1/organisations",
        headers=platform_admin,
        json={"name": "Secure School", "seat_limit": 1},
    ).json()
    admin, org_admin = register_user(
        client,
        email="admin@secure-school.example",
        role="admin",
        scope="organisation",
        organisation_id=org["id"],
    )
    moderator, _ = register_user(
        client,
        email="moderator@secure-school.example",
        role="moderator",
        scope="organisation",
        organisation_id=org["id"],
    )
    member, _ = register_user(
        client,
        email="parent@secure-school.example",
        role="member",
        scope="organisation",
        organisation_id=org["id"],
    )

    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Secure Plan", "slug": "secure-plan"},
    ).json()
    active_dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "rookie", "title": "Visible Dose"},
    ).json()
    inactive_dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "starter", "title": "Hidden Dose"},
    ).json()
    client.patch(
        f"/api/v1/play-doses/{inactive_dose['id']}",
        headers=platform_admin,
        json={"is_active": False},
    )

    public_catalog = client.get("/api/v1/play-plans", headers=org_admin)
    secure_plan = next(row for row in public_catalog.json() if row["id"] == plan["id"])
    assert [dose["id"] for dose in secure_plan["play_doses"]] == [active_dose["id"]]
    assert client.get("/api/v1/play-plans?include_inactive=true", headers=org_admin).status_code == 403
    admin_catalog = client.get(
        "/api/v1/play-plans?include_inactive=true", headers=platform_admin
    ).json()
    assert {dose["id"] for row in admin_catalog if row["id"] == plan["id"] for dose in row["play_doses"]} == {
        active_dose["id"],
        inactive_dose["id"],
    }

    first = client.post(
        "/api/v1/children",
        headers=org_admin,
        json={
            "name": "First Seat",
            "account_scope": "individual",
            "owner_id": member["id"],
            "moderator_id": moderator["id"],
            "current_play_dose_id": active_dose["id"],
        },
    )
    assert first.status_code == 201
    assert first.json()["account_scope"] == "organisation"
    assert first.json()["organisation_id"] == org["id"]
    assert first.json()["admin_id"] == admin["id"]
    second = client.post(
        "/api/v1/children",
        headers=org_admin,
        json={"name": "No Seat", "account_scope": "organisation", "current_play_dose_id": active_dose["id"]},
    )
    assert second.status_code == 409

    escalation = client.patch(
        f"/api/v1/users/{moderator['id']}", headers=org_admin, json={"role": "super_admin"}
    )
    assert escalation.status_code == 403
    assert client.patch(
        f"/api/v1/users/{moderator['id']}", headers=platform_admin, json={"is_active": False}
    ).status_code == 200
    assert client.patch(
        f"/api/v1/users/{moderator['id']}", headers=platform_admin, json={"is_active": True}
    ).status_code == 200

    client.patch(
        f"/api/v1/organisations/{org['id']}", headers=platform_admin, json={"is_active": False}
    )
    suspended_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@secure-school.example", "password": "secure-password"},
    )
    assert suspended_login.status_code == 403
    assert client.get("/api/v1/auth/me", headers=org_admin).status_code == 403


def test_child_assignment_rejects_cross_account_users(client, platform_admin):
    first_org = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "First Org", "seat_limit": 5}
    ).json()
    second_org = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "Second Org", "seat_limit": 5}
    ).json()
    foreign_moderator, _ = register_user(
        client,
        email="moderator@second-org.example",
        role="moderator",
        scope="organisation",
        organisation_id=second_org["id"],
    )
    response = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={
            "name": "Invalid Assignment",
            "account_scope": "organisation",
            "organisation_id": first_org["id"],
            "moderator_id": foreign_moderator["id"],
        },
    )
    assert response.status_code == 422


def test_admin_data_mutations_are_captured_in_the_audit_log(client, platform_admin):
    org = client.post(
        "/api/v1/organisations",
        headers=platform_admin,
        json={"name": "Tracked Organisation", "seat_limit": 5},
    ).json()
    assert client.patch(
        f"/api/v1/organisations/{org['id']}",
        headers=platform_admin,
        json={"seat_limit": 6},
    ).status_code == 200

    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Tracked Plan", "slug": "tracked-plan"},
    ).json()
    assert client.patch(
        f"/api/v1/play-plans/{plan['id']}",
        headers=platform_admin,
        json={"short_description": "Updated"},
    ).status_code == 200
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "rookie", "title": "Tracked Dose"},
    ).json()
    assert client.patch(
        f"/api/v1/play-doses/{dose['id']}",
        headers=platform_admin,
        json={"summary": "Updated"},
    ).status_code == 200
    activity = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={"sequence": 0, "title": "Tracked Activity"},
    ).json()
    assert client.patch(
        f"/api/v1/activities/{activity['id']}",
        headers=platform_admin,
        json={"title": "Updated Activity"},
    ).status_code == 200
    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={"name": "Tracked Child", "account_scope": "individual"},
    ).json()
    assert client.patch(
        f"/api/v1/children/{child['id']}",
        headers=platform_admin,
        json={"notes": "Updated notes"},
    ).status_code == 200
    assert client.delete(f"/api/v1/activities/{activity['id']}", headers=platform_admin).status_code == 204
    assert client.delete(f"/api/v1/play-doses/{dose['id']}", headers=platform_admin).status_code == 204

    actions = {event["action"] for event in client.get("/api/v1/audit-events", headers=platform_admin).json()}
    assert {
        "organisation.created",
        "organisation.updated",
        "play_plan.created",
        "play_plan.updated",
        "play_dose.created",
        "play_dose.updated",
        "play_dose.deleted",
        "activity.created",
        "activity.updated",
        "activity.deleted",
        "child.created",
        "child.updated",
    } <= actions
