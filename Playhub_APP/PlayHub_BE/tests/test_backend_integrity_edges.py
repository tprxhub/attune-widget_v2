from datetime import date, timedelta


def register(client, email, role, scope, organisation_id=None):
    return client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "display_name": email.split("@", 1)[0],
            "password": "secure-password",
            "role": role,
            "account_scope": scope,
            "organisation_id": organisation_id,
        },
    )


def test_user_role_scope_and_suspended_organisation_are_validated(client, platform_admin):
    organisation = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "Suspended School"}
    ).json()

    assert register(client, "bad-platform@example.com", "member", "platform").status_code == 422
    assert register(client, "bad-admin@example.com", "super_admin", "individual").status_code == 422
    assert register(
        client, "missing-org@example.com", "member", "organisation", "missing-organisation"
    ).status_code == 422
    assert register(
        client,
        "bad-family@example.com",
        "admin",
        "individual",
        organisation["id"],
    ).status_code == 422

    client.patch(
        f"/api/v1/organisations/{organisation['id']}",
        headers=platform_admin,
        json={"is_active": False},
    )
    assert register(
        client,
        "suspended@example.com",
        "admin",
        "organisation",
        organisation["id"],
    ).status_code == 409

    current = client.get("/api/v1/auth/me", headers=platform_admin).json()
    assert client.patch(
        f"/api/v1/users/{current['id']}", headers=platform_admin, json={"role": "admin"}
    ).status_code == 422


def test_invitation_child_scope_role_and_duplicate_pending_invites_are_validated(
    client, platform_admin
):
    first_org = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "First Invitation Org"}
    ).json()
    second_org = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "Second Invitation Org"}
    ).json()
    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={
            "name": "Invitation Child",
            "account_scope": "organisation",
            "organisation_id": first_org["id"],
        },
    ).json()

    mismatched = client.post(
        "/api/v1/invitations",
        headers=platform_admin,
        json={
            "email": "cross-tenant@example.com",
            "role": "member",
            "account_scope": "organisation",
            "organisation_id": second_org["id"],
            "child_id": child["id"],
        },
    )
    assert mismatched.status_code == 422

    wrong_role = client.post(
        "/api/v1/invitations",
        headers=platform_admin,
        json={
            "email": "child-admin@example.com",
            "role": "admin",
            "account_scope": "organisation",
            "organisation_id": first_org["id"],
            "child_id": child["id"],
        },
    )
    assert wrong_role.status_code == 422

    invitation_payload = {
        "email": "pending@example.com",
        "role": "moderator",
        "account_scope": "organisation",
        "organisation_id": first_org["id"],
        "child_id": child["id"],
    }
    invitation = client.post(
        "/api/v1/invitations", headers=platform_admin, json=invitation_payload
    )
    assert invitation.status_code == 201
    assert client.post(
        "/api/v1/invitations", headers=platform_admin, json=invitation_payload
    ).status_code == 409

    client.patch(
        f"/api/v1/children/{child['id']}",
        headers=platform_admin,
        json={"is_active": False},
    )
    assert client.post(
        "/api/v1/invitations/accept",
        json={
            "token": invitation.json()["acceptance_token"],
            "password": "secure-password",
        },
    ).status_code == 409


def test_only_dedicated_tester_can_switch_personas(client):
    admin = register(client, "admin@playhub.local", "super_admin", "platform")
    assert admin.status_code == 201
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@playhub.local", "password": "secure-password"},
    ).json()["access_token"]
    response = client.get(
        "/api/v1/developer/personas", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


def test_unique_updates_return_conflicts_instead_of_database_errors(client, platform_admin):
    first_org = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "Unique Org One"}
    ).json()
    second_org = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "Unique Org Two"}
    ).json()
    assert client.patch(
        f"/api/v1/organisations/{second_org['id']}",
        headers=platform_admin,
        json={"name": first_org["name"]},
    ).status_code == 409

    first_plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Unique Plan One", "slug": "unique-plan-one"},
    ).json()
    second_plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Unique Plan Two", "slug": "unique-plan-two"},
    ).json()
    assert client.patch(
        f"/api/v1/play-plans/{second_plan['id']}",
        headers=platform_admin,
        json={"slug": first_plan["slug"]},
    ).status_code == 409

    dose = client.post(
        f"/api/v1/play-plans/{first_plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "rookie", "title": "Sequence Dose"},
    ).json()
    first_activity = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={"sequence": 1, "title": "First Activity"},
    ).json()
    assert client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={"sequence": 1, "title": "Duplicate Activity"},
    ).status_code == 409
    second_activity = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={"sequence": 2, "title": "Second Activity"},
    ).json()
    assert client.patch(
        f"/api/v1/activities/{second_activity['id']}",
        headers=platform_admin,
        json={"sequence": first_activity["sequence"]},
    ).status_code == 409


def test_activity_video_updates_and_subscription_dates_cannot_create_invalid_state(
    client, platform_admin
):
    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Validation Plan", "slug": "validation-plan"},
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "rookie", "title": "Validation Dose"},
    ).json()
    activity = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={
            "sequence": 1,
            "title": "Validation Activity",
            "video_source_type": "link",
            "video_url": "https://example.test/video.mp4",
        },
    ).json()
    assert client.patch(
        f"/api/v1/activities/{activity['id']}",
        headers=platform_admin,
        json={"video_source_type": None, "video_url": "https://example.test/video.mp4"},
    ).status_code == 422
    assert client.patch(
        f"/api/v1/activities/{activity['id']}",
        headers=platform_admin,
        json={"video_source_type": "link", "video_url": None},
    ).status_code == 422

    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={"name": "Subscription Child", "account_scope": "individual"},
    ).json()
    assert client.put(
        f"/api/v1/children/{child['id']}/subscription",
        headers=platform_admin,
        json={
            "status": "active",
            "started_on": str(date.today() + timedelta(days=1)),
            "ends_on": str(date.today() + timedelta(days=30)),
        },
    ).status_code == 422
