"""A Super Admin can delete an Admin, Moderator or Member account, delete a member, and clear the
email linked to a member."""
from datetime import date

from sqlalchemy import func, select

from conftest import TestingSession, register_family

from app.models import Attempt, AttuneConversation, AuditEvent, Child, Invitation, InvitationStatus, User

API = "/api/v1"
PASSWORD = "A-secure-password"


def school_with_member(client, admin, name="Delete School"):
    org = client.post(f"{API}/organisations", headers=admin, json={"name": name, "seat_limit": 10}).json()
    child = client.post(f"{API}/children", headers=admin, json={
        "name": "Ada", "account_scope": "organisation", "organisation_id": org["id"],
    }).json()
    return org, child


def invited(client, admin, org, email, role="moderator", child_id=None, name=None):
    invite = client.post(f"{API}/invitations", headers=admin, json={
        "email": email, "display_name": name or email.split("@")[0], "role": role,
        "account_scope": "organisation", "organisation_id": org["id"], **({"child_id": child_id} if child_id else {}),
    }).json()
    token = client.post(f"{API}/invitations/accept", json={"token": invite["acceptance_token"], "password": PASSWORD}).json()
    headers = {"Authorization": f"Bearer {token['access_token']}"}
    return client.get(f"{API}/auth/me", headers=headers).json(), headers


def admin_id(client, admin):
    return client.get(f"{API}/auth/me", headers=admin).json()["id"]


def test_deleting_a_moderator_keeps_the_sessions_they_logged(client, platform_admin):
    org, child = school_with_member(client, platform_admin)
    mod, mod_headers = invited(client, platform_admin, org, "gone.mod@example.com", child_id=child["id"], name="Gone Mod")
    plan = client.post(f"{API}/play-plans", headers=platform_admin, json={"name": "Delete Plan", "slug": "delete-plan"}).json()
    dose = client.post(f"{API}/play-plans/{plan['id']}/play-doses", headers=platform_admin,
                       json={"level": "rookie", "title": "Rookie"}).json()
    activity = client.post(f"{API}/play-doses/{dose['id']}/activities", headers=platform_admin,
                           json={"sequence": 0, "title": "Tap", "instructions": ["Do it"]}).json()
    logged = client.post(f"{API}/children/{child['id']}/attempts", headers=mod_headers, json={
        "play_dose_id": dose["id"], "activity_id": activity["id"], "occurred_on": date.today().isoformat(),
        "completion_status": "finished", "completion_score": 5, "help_level": "independent", "mood_score": 4,
    })
    assert logged.status_code == 201

    preview = client.get(f"{API}/users/{mod['id']}/deletion-preview", headers=platform_admin).json()
    assert preview["moderator_assignments"] == 1 and preview["sessions_kept"] == 1 and preview["family_members"] == []

    assert client.delete(f"{API}/users/{mod['id']}", headers=platform_admin, params={"confirm_name": "wrong"}).status_code == 422
    deleted = client.delete(f"{API}/users/{mod['id']}", headers=platform_admin, params={"confirm_name": "gone mod"})
    assert deleted.status_code == 200
    with TestingSession() as db:
        assert db.get(User, mod["id"]) is None
        attempt = db.scalar(select(Attempt).where(Attempt.child_id == child["id"]))
        assert attempt.logged_by_id == admin_id(client, platform_admin)
        assert db.scalar(select(AuditEvent).where(AuditEvent.action == "user.deleted", AuditEvent.resource_id == mod["id"]))
    member = next(c for c in client.get(f"{API}/children", headers=platform_admin).json() if c["id"] == child["id"])
    assert member["moderator_ids"] == []
    assert client.get(f"{API}/auth/me", headers=mod_headers).status_code == 401


def test_only_a_super_admin_deletes_and_never_themselves_or_platform_staff(client, platform_admin):
    org, _ = school_with_member(client, platform_admin)
    org_admin, org_admin_headers = invited(client, platform_admin, org, "org.admin@example.com", role="admin", name="Org Admin")
    mod, _ = invited(client, platform_admin, org, "a.mod@example.com", name="A Mod")
    assert client.delete(f"{API}/users/{mod['id']}", headers=org_admin_headers, params={"confirm_name": "A Mod"}).status_code == 403
    me = admin_id(client, platform_admin)
    assert client.delete(f"{API}/users/{me}", headers=platform_admin, params={"confirm_name": "Platform Admin"}).status_code == 422
    with TestingSession() as db:
        db.add(User(email="staff@example.com", display_name="Staff", password_hash="x", role="ttp_employee", account_scope="platform"))
        db.commit()
        staff_id = db.scalar(select(User.id).where(User.email == "staff@example.com"))
    assert client.delete(f"{API}/users/{staff_id}", headers=platform_admin, params={"confirm_name": "Staff"}).status_code == 403
    # An organisation Admin can be deleted; the members they administered stay.
    assert client.delete(f"{API}/users/{org_admin['id']}", headers=platform_admin, params={"confirm_name": "Org Admin"}).status_code == 200


def test_a_family_account_holder_cannot_be_deleted_while_they_hold_members(client, platform_admin):
    family = register_family(client, "holder@example.com")
    holder = client.get(f"{API}/auth/me", headers=family).json()
    preview = client.get(f"{API}/users/{holder['id']}/deletion-preview", headers=platform_admin).json()
    assert preview["family_members"] == ["Family Child"]
    refused = client.delete(f"{API}/users/{holder['id']}", headers=platform_admin, params={"confirm_name": holder["display_name"]})
    assert refused.status_code == 409 and "Family Child" in refused.json()["detail"]
    # Once the member is deleted the account can go.
    child = client.get(f"{API}/children", headers=family).json()[0]
    assert client.delete(f"{API}/children/{child['id']}", headers=platform_admin, params={"confirm_name": "Family Child"}).status_code == 200
    with TestingSession() as db:
        assert db.get(User, holder["id"]) is not None  # the family Admin is not their own Member login
    assert client.delete(f"{API}/users/{holder['id']}", headers=platform_admin, params={"confirm_name": holder["display_name"]}).status_code == 200


def test_deleting_a_member_removes_their_data_and_their_own_login(client, platform_admin):
    org, child = school_with_member(client, platform_admin)
    login, _ = invited(client, platform_admin, org, "ada.parent@example.com", role="member", child_id=child["id"])
    with TestingSession() as db:
        db.add(AttuneConversation(user_id=login["id"], child_id=child["id"], title="About Ada"))
        db.commit()
    preview = client.get(f"{API}/children/{child['id']}/deletion-preview", headers=platform_admin).json()
    assert preview["member_login"] == "ada.parent@example.com" and preview["attune_conversations"] == 1
    assert client.delete(f"{API}/children/{child['id']}", headers=platform_admin, params={"confirm_name": "nope"}).status_code == 422
    assert client.delete(f"{API}/children/{child['id']}", headers=platform_admin, params={"confirm_name": "ada"}).status_code == 200
    with TestingSession() as db:
        assert db.get(Child, child["id"]) is None
        assert db.get(User, login["id"]) is None
        assert db.scalar(select(func.count(AttuneConversation.id))) == 0


def test_clearing_a_member_email_withdraws_the_invitation_or_removes_their_login(client, platform_admin):
    org, child = school_with_member(client, platform_admin)
    # A pending invitation: clearing withdraws it.
    client.post(f"{API}/invitations", headers=platform_admin, json={
        "email": "waiting@example.com", "display_name": "Waiting", "role": "member",
        "account_scope": "organisation", "organisation_id": org["id"], "child_id": child["id"],
    })
    member = next(c for c in client.get(f"{API}/children", headers=platform_admin).json() if c["id"] == child["id"])
    assert member["invited_member_email"] == "waiting@example.com"
    cleared = client.delete(f"{API}/children/{child['id']}/member-email", headers=platform_admin)
    assert cleared.status_code == 200 and cleared.json()["invited_member_email"] is None
    with TestingSession() as db:
        assert db.scalar(select(Invitation.status).where(Invitation.email == "waiting@example.com")) == InvitationStatus.REVOKED

    # A linked Member login: clearing unlinks it and deletes the now unused login.
    login, _ = invited(client, platform_admin, org, "linked@example.com", role="member", child_id=child["id"])
    cleared = client.delete(f"{API}/children/{child['id']}/member-email", headers=platform_admin)
    assert cleared.status_code == 200 and cleared.json()["owner_email"] is None
    with TestingSession() as db:
        assert db.get(User, login["id"]) is None


def test_a_super_admin_can_remove_a_family_account_holders_email_without_breaking_the_family(client, platform_admin):
    family = register_family(client, "keepme@example.com")
    holder = client.get(f"{API}/auth/me", headers=family).json()
    child = client.get(f"{API}/children", headers=family).json()[0]
    assert client.delete(f"{API}/children/{child['id']}/member-email", headers=family).status_code == 403
    cleared = client.delete(f"{API}/children/{child['id']}/member-email", headers=platform_admin)
    assert cleared.status_code == 200 and cleared.json()["owner_email"] is None
    # Their login stays, they remain the member's Account Admin and still see the member.
    with TestingSession() as db:
        assert db.get(User, holder["id"]) is not None
        assert db.get(Child, child["id"]).admin_id == holder["id"]
    assert [c["id"] for c in client.get(f"{API}/children", headers=family).json()] == [child["id"]]
