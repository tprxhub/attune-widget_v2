"""A Super Admin can delete an organisation with its staff, members, children and all their data."""
from datetime import date

from sqlalchemy import func, select

from app.database import get_db
from app.main import app
from app.models import Attempt, AuditEvent, Child, Invitation, Organisation, PlayPlan, User
from tests.conftest import register_family

API = "/api/v1"


def school_with_everything(client, admin, name="Doomed School"):
    org = client.post(f"{API}/organisations", headers=admin, json={"name": name, "seat_limit": 10}).json()
    # An Admin who accepted the invitation and created a Play Plan; a pending Moderator invitation.
    invited = client.post(f"{API}/invitations", headers=admin, json={
        "email": f"head@{org['id'][:8]}.example.com", "display_name": "Head", "role": "admin",
        "account_scope": "organisation", "organisation_id": org["id"],
    }).json()
    accepted = client.post(f"{API}/invitations/accept", json={"token": invited["acceptance_token"], "password": "A-secure-password"})
    staff = {"Authorization": f"Bearer {accepted.json()['access_token']}"}
    client.post(f"{API}/invitations", headers=admin, json={
        "email": f"mod@{org['id'][:8]}.example.com", "display_name": "Mod", "role": "moderator",
        "account_scope": "organisation", "organisation_id": org["id"],
    })
    plan = client.post(f"{API}/play-plans", headers=admin, json={"name": f"Plan {name}", "slug": f"plan-{org['id'][:8]}"}).json()
    dose = client.post(f"{API}/play-plans/{plan['id']}/play-doses", headers=admin, json={"level": "rookie", "title": "Rookie"}).json()
    child = client.post(f"{API}/children", headers=admin, json={
        "name": "Ada", "account_scope": "organisation", "organisation_id": org["id"],
    }).json()
    assert client.post(f"{API}/children/{child['id']}/attempts", headers=staff, json={
        "play_dose_id": dose["id"], "occurred_on": str(date.today()), "completion_score": 4, "mood_score": 5,
    }).status_code == 201
    return org, child, staff


def suspend(client, admin, org):
    assert client.patch(f"{API}/organisations/{org['id']}", headers=admin, json={"is_active": False}).status_code == 200


def ttp_employee(client, admin):
    invited = client.post(f"{API}/invitations", headers=admin, json={
        "email": "ttp.staff@example.com", "display_name": "TTP Staff", "role": "ttp_employee",
        "account_scope": "platform", "organisation_id": None, "permissions": ["organisations", "team", "children"],
    }).json()
    accepted = client.post(f"{API}/invitations/accept", json={"token": invited["acceptance_token"], "password": "A-secure-password"})
    return {"Authorization": f"Bearer {accepted.json()['access_token']}"}


def test_only_a_suspended_organisation_can_be_deleted(client, platform_admin):
    org, _, _ = school_with_everything(client, platform_admin)
    active = client.delete(f"{API}/organisations/{org['id']}", headers=platform_admin, params={"confirm_name": "Doomed School"})
    assert active.status_code == 409 and "Suspend" in active.json()["detail"]
    suspend(client, platform_admin, org)
    assert client.delete(f"{API}/organisations/{org['id']}", headers=platform_admin, params={"confirm_name": "Doomed School"}).status_code == 200


def test_a_ttp_employee_cannot_delete_even_with_organisations_access(client, platform_admin):
    org, _, _ = school_with_everything(client, platform_admin)
    suspend(client, platform_admin, org)
    ttp = ttp_employee(client, platform_admin)
    assert client.get(f"{API}/organisations", headers=ttp).status_code == 200  # they can manage organisations
    assert client.get(f"{API}/organisations/{org['id']}/deletion-preview", headers=ttp).status_code == 403
    assert client.delete(f"{API}/organisations/{org['id']}", headers=ttp, params={"confirm_name": "Doomed School"}).status_code == 403


def test_preview_lists_what_will_go_and_only_a_super_admin_can_see_it(client, platform_admin):
    org, _, staff = school_with_everything(client, platform_admin)
    preview = client.get(f"{API}/organisations/{org['id']}/deletion-preview", headers=platform_admin)
    assert preview.status_code == 200
    assert preview.json() == {
        "organisation": "Doomed School", "admins": 1, "moderators": 0, "members": 0, "children": 1,
        "sessions": 1, "subscriptions": 0, "attune_conversations": 0, "invitations": 2,
    }
    assert client.get(f"{API}/organisations/{org['id']}/deletion-preview", headers=staff).status_code == 403


def test_the_name_must_be_typed_and_only_a_super_admin_can_delete(client, platform_admin):
    org, _, staff = school_with_everything(client, platform_admin)
    suspend(client, platform_admin, org)
    wrong = client.delete(f"{API}/organisations/{org['id']}", headers=platform_admin, params={"confirm_name": "Other"})
    assert wrong.status_code == 422
    assert client.delete(f"{API}/organisations/{org['id']}", headers=staff, params={"confirm_name": "Doomed School"}).status_code == 403
    family = register_family(client, "bystander@example.com")
    assert client.delete(f"{API}/organisations/{org['id']}", headers=family, params={"confirm_name": "Doomed School"}).status_code == 403
    assert client.get(f"{API}/organisations/{org['id']}/deletion-preview", headers=platform_admin).status_code == 200


def test_deleting_removes_the_organisation_its_people_children_and_their_data(client, platform_admin):
    org, child, staff = school_with_everything(client, platform_admin)
    keep, keep_child, _ = school_with_everything(client, platform_admin, name="Safe School")
    suspend(client, platform_admin, org)

    deleted = client.delete(f"{API}/organisations/{org['id']}", headers=platform_admin, params={"confirm_name": " doomed school "})
    assert deleted.status_code == 200 and deleted.json()["children"] == 1 and deleted.json()["sessions"] == 1

    sessions = app.dependency_overrides[get_db]()
    db = next(sessions)
    try:
        assert db.get(Organisation, org["id"]) is None
        assert db.get(Child, child["id"]) is None
        assert db.scalar(select(func.count()).select_from(User).where(User.organisation_id == org["id"])) == 0
        assert db.scalar(select(func.count()).select_from(Attempt).where(Attempt.child_id == child["id"])) == 0
        assert db.scalar(select(func.count()).select_from(Invitation).where(Invitation.organisation_id == org["id"])) == 0
        # Shared content stays: the Play Plans remain, the audit log records the deletion.
        assert db.scalar(select(func.count()).select_from(PlayPlan)) == 2
        event = db.scalar(select(AuditEvent).where(AuditEvent.action == "organisation.deleted"))
        assert event.resource_id == org["id"] and event.metadata_json["admins"] == 1
        # The other organisation is untouched.
        assert db.get(Organisation, keep["id"]) is not None and db.get(Child, keep_child["id"]) is not None
    finally:
        sessions.close()

    # Its staff can no longer use their token or sign in.
    assert client.get(f"{API}/auth/me", headers=staff).status_code == 401
    assert client.get(f"{API}/organisations/{org['id']}/deletion-preview", headers=platform_admin).status_code == 404
