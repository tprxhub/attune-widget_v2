def org(client, admin, **body):
    response = client.post("/api/v1/organisations", headers=admin, json={"name": "Licence School", **body})
    assert response.status_code == 201, response.text
    return response.json()


def invite(client, admin, organisation_id, email):
    return client.post("/api/v1/invitations", headers=admin, json={
        "email": email, "display_name": email.split("@")[0], "role": "moderator",
        "account_scope": "organisation", "organisation_id": organisation_id,
    })


def child(client, admin, organisation_id, name):
    return client.post("/api/v1/children", headers=admin, json={
        "name": name, "account_scope": "organisation", "organisation_id": organisation_id,
    })


def listed(client, admin, organisation_id):
    return next(o for o in client.get("/api/v1/organisations", headers=admin).json() if o["id"] == organisation_id)


def test_child_licences_are_the_default_and_leave_moderators_unlimited(client, platform_admin):
    school = org(client, platform_admin, seat_limit=1)
    assert school["license_type"] == "children" and school["licenses_used"] == 0
    assert child(client, platform_admin, school["id"], "Ada").status_code == 201
    refused = child(client, platform_admin, school["id"], "Ben")
    assert refused.status_code == 409 and "1 child licence" in refused.json()["detail"]
    for i in range(3):  # Moderators don't use child licences
        assert invite(client, platform_admin, school["id"], f"mod{i}@example.com").status_code == 201
    assert listed(client, platform_admin, school["id"])["licenses_used"] == 1


def test_moderator_licences_count_accounts_and_pending_invitations(client, platform_admin):
    clinic = org(client, platform_admin, seat_limit=2, license_type="moderators")
    assert clinic["license_type"] == "moderators"
    first = invite(client, platform_admin, clinic["id"], "first@example.com")
    assert first.status_code == 201
    assert invite(client, platform_admin, clinic["id"], "second@example.com").status_code == 201
    third = invite(client, platform_admin, clinic["id"], "third@example.com")
    assert third.status_code == 409 and "2 Moderator licences" in third.json()["detail"]
    assert listed(client, platform_admin, clinic["id"])["licenses_used"] == 2

    # Accepting an invitation keeps its own licence rather than needing another.
    accepted = client.post("/api/v1/invitations/accept",
                           json={"token": first.json()["acceptance_token"], "password": "A-secure-password"})
    assert accepted.status_code == 200
    assert listed(client, platform_admin, clinic["id"])["licenses_used"] == 2

    # Children are unlimited under Moderator licences.
    for name in ("Ada", "Ben", "Cy"):
        assert child(client, platform_admin, clinic["id"], name).status_code == 201

    # Deactivating a Moderator frees a licence; reactivating needs one back.
    moderator = next(u for u in client.get("/api/v1/users", headers=platform_admin).json() if u["email"] == "first@example.com")
    assert client.patch(f"/api/v1/users/{moderator['id']}", headers=platform_admin, json={"is_active": False}).status_code == 200
    assert invite(client, platform_admin, clinic["id"], "third@example.com").status_code == 201
    back = client.patch(f"/api/v1/users/{moderator['id']}", headers=platform_admin, json={"is_active": True})
    assert back.status_code == 409


def test_changing_the_type_or_count_must_cover_what_is_in_use(client, platform_admin):
    school = org(client, platform_admin, seat_limit=5)
    for name in ("Ada", "Ben", "Cy"):
        assert child(client, platform_admin, school["id"], name).status_code == 201
    too_few = client.patch(f"/api/v1/organisations/{school['id']}", headers=platform_admin, json={"seat_limit": 2})
    assert too_few.status_code == 409 and "3 children are active" in too_few.json()["detail"]

    # Switching to Moderator licences counts Moderators instead (none yet), so 1 is enough.
    switched = client.patch(f"/api/v1/organisations/{school['id']}", headers=platform_admin,
                            json={"license_type": "moderators", "seat_limit": 1})
    assert switched.status_code == 200
    assert (switched.json()["license_type"], switched.json()["licenses_used"]) == ("moderators", 0)
    assert invite(client, platform_admin, school["id"], "only@example.com").status_code == 201
    # Back to child licences with fewer than the 3 active children is refused.
    back = client.patch(f"/api/v1/organisations/{school['id']}", headers=platform_admin,
                        json={"license_type": "children", "seat_limit": 2})
    assert back.status_code == 409
    assert client.patch(f"/api/v1/organisations/{school['id']}", headers=platform_admin,
                        json={"license_type": "children", "seat_limit": 3}).status_code == 200
    assert client.patch(f"/api/v1/organisations/{school['id']}", headers=platform_admin,
                        json={"license_type": "seats"}).status_code == 422


def test_no_limit_means_unlimited_for_either_type(client, platform_admin):
    clinic = org(client, platform_admin, seat_limit=0, license_type="moderators")
    for i in range(4):
        assert invite(client, platform_admin, clinic["id"], f"free{i}@example.com").status_code == 201
