"""A Super Admin can correct anyone's name and sign-in email, and an organisation's name and type."""
from tests.conftest import register_family

API = "/api/v1"


def _me(client, headers):
    return client.get(f"{API}/auth/me", headers=headers).json()


def test_super_admin_renames_a_user_and_changes_their_sign_in_email(client, platform_admin):
    family = register_family(client, "old.address@example.com")
    user_id = _me(client, family)["id"]
    response = client.patch(f"{API}/users/{user_id}", headers=platform_admin,
                            json={"display_name": "Renamed Parent", "email": " New.Address@Example.com "})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Renamed Parent"
    assert response.json()["email"] == "new.address@example.com"
    login = client.post(f"{API}/auth/login", json={"email": "new.address@example.com", "password": "secure-password"})
    assert login.status_code == 200


def test_an_email_already_in_use_is_refused(client, platform_admin):
    register_family(client, "taken@example.com")
    other = register_family(client, "other@example.com")
    response = client.patch(f"{API}/users/{_me(client, other)['id']}", headers=platform_admin,
                            json={"email": "taken@example.com"})
    assert response.status_code == 409


def test_only_a_super_admin_changes_a_sign_in_email(client):
    family = register_family(client, "self@example.com")
    response = client.patch(f"{API}/users/{_me(client, family)['id']}", headers=family,
                            json={"email": "elsewhere@example.com"})
    assert response.status_code == 403


def test_super_admin_renames_an_organisation_and_changes_its_type(client, platform_admin):
    created = client.post(f"{API}/organisations", headers=platform_admin,
                          json={"name": "Old School Name", "kind": "school", "seat_limit": 5})
    assert created.status_code == 201
    response = client.patch(f"{API}/organisations/{created.json()['id']}", headers=platform_admin,
                            json={"name": "New Clinic Name", "kind": "clinic"})
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["kind"]) == ("New Clinic Name", "clinic")
