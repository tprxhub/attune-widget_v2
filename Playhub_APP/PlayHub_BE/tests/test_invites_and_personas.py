def test_invitation_acceptance_and_audit(client, platform_admin):
    organisation = client.post("/api/v1/organisations", headers=platform_admin, json={"name": "Test Organisation"}).json()
    invitation = client.post("/api/v1/invitations", headers=platform_admin, json={
        "email": "moderator@example.com", "display_name": "Test Moderator", "role": "moderator",
        "account_scope": "organisation", "organisation_id": organisation["id"],
    })
    assert invitation.status_code == 201
    token = invitation.json()["acceptance_token"]
    listed = client.get("/api/v1/invitations", headers=platform_admin).json()
    assert "acceptance_token" not in listed[0]
    accepted = client.post("/api/v1/invitations/accept", json={"token": token, "password": "A-secure-password"})
    assert accepted.status_code == 200
    assert client.get("/api/v1/users", headers=platform_admin).status_code == 200
    audit = client.get("/api/v1/audit-events", headers=platform_admin)
    assert audit.status_code == 200
    assert any(event["action"] == "invitation.accepted" for event in audit.json())


def test_pending_invitation_activation_link_can_be_securely_regenerated(client, platform_admin):
    organisation = client.post(
        "/api/v1/organisations", headers=platform_admin, json={"name": "Link Recovery School"}
    ).json()
    invitation = client.post(
        "/api/v1/invitations",
        headers=platform_admin,
        json={
            "email": "recover-moderator@example.com",
            "display_name": "Recovery Moderator",
            "role": "moderator",
            "account_scope": "organisation",
            "organisation_id": organisation["id"],
        },
    ).json()
    old_token = invitation["acceptance_token"]

    regenerated = client.post(
        f"/api/v1/invitations/{invitation['id']}/activation", headers=platform_admin
    )
    assert regenerated.status_code == 200
    new_token = regenerated.json()["acceptance_token"]
    assert new_token and new_token != old_token

    assert client.post(
        "/api/v1/invitations/accept",
        json={"token": old_token, "password": "A-secure-password"},
    ).status_code == 422
    assert client.post(
        "/api/v1/invitations/accept",
        json={"token": new_token, "password": "A-secure-password"},
    ).status_code == 200

    audit = client.get("/api/v1/audit-events", headers=platform_admin).json()
    assert any(event["action"] == "invitation.activation_regenerated" for event in audit)


def test_dedicated_tester_switches_among_test_personas(client):
    tester = client.post("/api/v1/auth/register", json={
        "email": "tester@playhub.local", "display_name": "Tester", "password": "A-secure-password",
        "role": "super_admin", "account_scope": "platform",
    })
    assert tester.status_code == 201
    target = client.post("/api/v1/auth/register", json={
        "email": "moderator@playhub.local", "display_name": "Moderator", "password": "A-secure-password",
        "role": "moderator", "account_scope": "individual",
    }).json()
    tester_token = client.post("/api/v1/auth/login", json={"email": "tester@playhub.local", "password": "A-secure-password"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {tester_token}"}
    personas = client.get("/api/v1/developer/personas", headers=headers)
    assert personas.status_code == 200 and len(personas.json()) == 2
    switched = client.post(f"/api/v1/developer/personas/{target['id']}/switch", headers=headers)
    assert switched.status_code == 200
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {switched.json()['access_token']}"})
    assert me.json()["role"] == "moderator"


def test_child_invitation_links_the_accepted_parent(client, platform_admin):
    child = client.post("/api/v1/children", headers=platform_admin, json={
        "name": "Linked Child", "account_scope": "individual",
    }).json()
    invitation = client.post("/api/v1/invitations", headers=platform_admin, json={
        "email": "linked-parent@example.com", "role": "member",
        "account_scope": "individual", "child_id": child["id"],
    }).json()
    accepted = client.post("/api/v1/invitations/accept", json={
        "token": invitation["acceptance_token"], "password": "secure-password",
    })
    assert accepted.status_code == 200
    headers = {"Authorization": f"Bearer {accepted.json()['access_token']}"}
    visible = client.get("/api/v1/children", headers=headers).json()
    assert [item["id"] for item in visible] == [child["id"]]


def test_organisation_parent_sees_only_their_invited_child(client, platform_admin):
    organisation = client.post("/api/v1/organisations", headers=platform_admin, json={
        "name": "Private School",
    }).json()
    first = client.post("/api/v1/children", headers=platform_admin, json={
        "name": "First Child", "account_scope": "organisation",
        "organisation_id": organisation["id"],
    }).json()
    client.post("/api/v1/children", headers=platform_admin, json={
        "name": "Second Child", "account_scope": "organisation",
        "organisation_id": organisation["id"],
    })
    invitation = client.post("/api/v1/invitations", headers=platform_admin, json={
        "email": "org-parent@example.com", "role": "member",
        "account_scope": "organisation", "organisation_id": organisation["id"],
        "child_id": first["id"],
    }).json()
    accepted = client.post("/api/v1/invitations/accept", json={
        "token": invitation["acceptance_token"], "password": "secure-password",
    }).json()
    visible = client.get("/api/v1/children", headers={
        "Authorization": f"Bearer {accepted['access_token']}"
    }).json()
    assert [item["id"] for item in visible] == [first["id"]]
