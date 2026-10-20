"""An individual (family) account has one member; Moderators are unlimited."""
from tests.conftest import register_family

API = "/api/v1"


def test_a_family_account_can_have_only_one_member(client):
    family = register_family(client, "one.member@example.com")
    assert len(client.get(f"{API}/children", headers=family).json()) == 1
    second = client.post(f"{API}/children", headers=family, json={"name": "Second", "account_scope": "individual"})
    assert second.status_code == 409
    assert "one member" in second.json()["detail"]
    assert len(client.get(f"{API}/children", headers=family).json()) == 1


def test_a_family_can_still_invite_several_moderators(client):
    family = register_family(client, "many.moderators@example.com")
    child = client.get(f"{API}/children", headers=family).json()[0]
    for index in range(3):
        invited = client.post(f"{API}/invitations", headers=family, json={
            "email": f"moderator{index}@example.com", "display_name": f"Moderator {index}", "role": "moderator",
            "account_scope": "individual", "child_id": child["id"],
        })
        assert invited.status_code == 201, invited.text


def test_organisations_still_enrol_many_members(client, platform_admin):
    org = client.post(f"{API}/organisations", headers=platform_admin, json={"name": "Many School", "seat_limit": 10}).json()
    for name in ("Ada", "Ben", "Cy"):
        created = client.post(f"{API}/children", headers=platform_admin, json={
            "name": name, "account_scope": "organisation", "organisation_id": org["id"],
        })
        assert created.status_code == 201
