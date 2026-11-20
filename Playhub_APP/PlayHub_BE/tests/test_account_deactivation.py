"""Deactivating your own account: nothing is deleted, signing in again offers to reactivate it."""
from app import mailer
from conftest import register_family

API = "/api/v1"
EMAIL = "family@example.com"


def login(client, reactivate=False, password="secure-password"):
    return client.post(f"{API}/auth/login", json={"email": EMAIL, "password": password, "reactivate": reactivate})


def test_deactivate_signs_out_and_reactivate_keeps_everything(client):
    family = register_family(client)
    child = client.get(f"{API}/children", headers=family).json()[0]
    mailer.SENT.clear()

    assert client.post(f"{API}/auth/me/deactivate", headers=family, json={"password": "wrong-password"}).status_code == 422
    assert client.post(f"{API}/auth/me/deactivate", headers=family, json={}).status_code == 422
    done = client.post(f"{API}/auth/me/deactivate", headers=family,
                       json={"password": "secure-password", "reason": "Taking a break"})
    assert done.status_code == 200
    assert any("deactivated" in m.subject for m in mailer.SENT if m.to == EMAIL)

    # Signed out everywhere at once.
    assert client.get(f"{API}/auth/me", headers=family).status_code == 401
    # The right password is told the account is deactivated; a wrong one learns nothing.
    assert login(client).status_code == 423
    assert login(client, password="wrong-password").status_code == 401

    back = login(client, reactivate=True)
    assert back.status_code == 200
    again = {"Authorization": f"Bearer {back.json()['access_token']}"}
    assert client.get(f"{API}/children", headers=again).json()[0]["id"] == child["id"]
    assert login(client).status_code == 200


def test_super_admin_sees_who_deactivated_and_an_admin_switch_off_cannot_be_undone_by_the_owner(client, platform_admin):
    family = register_family(client)
    me = client.get(f"{API}/auth/me", headers=family).json()
    client.post(f"{API}/auth/me/deactivate", headers=family, json={"password": "secure-password"})

    row = next(u for u in client.get(f"{API}/users", headers=platform_admin).json() if u["id"] == me["id"])
    assert row["is_active"] is False and row["deactivated_by_self"] is True and row["deactivated_at"]
    child = client.get(f"{API}/children", headers=platform_admin).json()[0]
    assert child["owner_active"] is False and child["owner_deactivated_by_self"] is True

    # A Super Admin reactivates it, then switches it off themselves: now the owner can't undo that.
    assert client.patch(f"{API}/users/{me['id']}", headers=platform_admin, json={"is_active": True}).status_code == 200
    assert login(client).status_code == 200
    assert client.patch(f"{API}/users/{me['id']}", headers=platform_admin, json={"is_active": False}).status_code == 200
    row = next(u for u in client.get(f"{API}/users", headers=platform_admin).json() if u["id"] == me["id"])
    assert row["deactivated_by_self"] is False
    assert login(client, reactivate=True).status_code == 401


def test_platform_and_organisation_accounts_cannot_deactivate_themselves(client, platform_admin):
    assert client.post(f"{API}/auth/me/deactivate", headers=platform_admin,
                       json={"password": "A-secure-password"}).status_code == 403


def test_a_deactivated_family_is_closed_to_its_moderators(client):
    from app.models import Child, User
    from app.database import get_db
    from app.main import app

    family = register_family(client)
    child_id = client.get(f"{API}/children", headers=family).json()[0]["id"]
    # Give the family a Moderator directly.
    db = next(app.dependency_overrides[get_db]())
    from app.security import hash_password
    from app.models import AccountScope, Role
    moderator = User(email="mod@example.com", display_name="Mod", password_hash=hash_password("secure-password"),
                     role=Role.MODERATOR, account_scope=AccountScope.INDIVIDUAL)
    db.add(moderator)
    db.flush()
    child = db.get(Child, child_id)
    child.moderators = [moderator]
    db.commit()
    token = client.post(f"{API}/auth/login", json={"email": "mod@example.com", "password": "secure-password"}).json()["access_token"]
    mod = {"Authorization": f"Bearer {token}"}
    assert client.get(f"{API}/children/{child_id}/attempts", headers=mod).status_code == 200
    client.post(f"{API}/auth/me/deactivate", headers=family, json={"password": "secure-password"})
    assert client.get(f"{API}/children/{child_id}/attempts", headers=mod).status_code == 403
