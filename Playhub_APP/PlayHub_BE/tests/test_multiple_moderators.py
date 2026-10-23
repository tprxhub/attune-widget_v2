"""A member can have several Moderators; each one can see and log for that member."""
from datetime import date

API = "/api/v1"


def school(client, admin):
    org = client.post(f"{API}/organisations", headers=admin, json={"name": "Two Mod School", "seat_limit": 10}).json()
    child = client.post(f"{API}/children", headers=admin, json={
        "name": "Ada", "account_scope": "organisation", "organisation_id": org["id"],
    }).json()
    return org, child


def moderator(client, admin, org, email, child_id=None):
    invited = client.post(f"{API}/invitations", headers=admin, json={
        "email": email, "display_name": email.split("@")[0], "role": "moderator",
        "account_scope": "organisation", "organisation_id": org["id"], **({"child_id": child_id} if child_id else {}),
    }).json()
    accepted = client.post(f"{API}/invitations/accept", json={"token": invited["acceptance_token"], "password": "A-secure-password"}).json()
    headers = {"Authorization": f"Bearer {accepted['access_token']}"}
    me = client.get(f"{API}/auth/me", headers=headers).json()
    return me["id"], headers


def test_a_member_can_have_two_moderators_who_both_see_them(client, platform_admin):
    org, child = school(client, platform_admin)
    first, first_headers = moderator(client, platform_admin, org, "first.mod@example.com")
    second, second_headers = moderator(client, platform_admin, org, "second.mod@example.com")
    saved = client.patch(f"{API}/children/{child['id']}", headers=platform_admin, json={"moderator_ids": [first, second]})
    assert saved.status_code == 200
    assert set(saved.json()["moderator_ids"]) == {first, second}
    assert saved.json()["moderator_id"] in {first, second}
    for headers in (first_headers, second_headers):
        assert [c["id"] for c in client.get(f"{API}/children", headers=headers).json()] == [child["id"]]
    # Removing one leaves the other, and the removed one loses access.
    client.patch(f"{API}/children/{child['id']}", headers=platform_admin, json={"moderator_ids": [second]})
    assert client.get(f"{API}/children", headers=first_headers).json() == []
    assert [c["id"] for c in client.get(f"{API}/children", headers=second_headers).json()] == [child["id"]]


def test_an_accepted_moderator_invitation_adds_rather_than_replaces(client, platform_admin):
    org, child = school(client, platform_admin)
    first, _ = moderator(client, platform_admin, org, "keep.mod@example.com", child["id"])
    second, _ = moderator(client, platform_admin, org, "add.mod@example.com", child["id"])
    listed = next(c for c in client.get(f"{API}/children", headers=platform_admin).json() if c["id"] == child["id"])
    assert set(listed["moderator_ids"]) == {first, second}


def test_moderators_from_another_organisation_are_refused(client, platform_admin):
    org, child = school(client, platform_admin)
    other = client.post(f"{API}/organisations", headers=platform_admin, json={"name": "Elsewhere", "seat_limit": 5}).json()
    outsider, _ = moderator(client, platform_admin, other, "outsider.mod@example.com")
    refused = client.patch(f"{API}/children/{child['id']}", headers=platform_admin, json={"moderator_ids": [outsider]})
    assert refused.status_code == 422


def test_older_clients_setting_one_moderator_still_work(client, platform_admin):
    org, child = school(client, platform_admin)
    only, _ = moderator(client, platform_admin, org, "only.mod@example.com")
    saved = client.patch(f"{API}/children/{child['id']}", headers=platform_admin, json={"moderator_id": only})
    assert saved.json()["moderator_ids"] == [only]
    cleared = client.patch(f"{API}/children/{child['id']}", headers=platform_admin, json={"moderator_id": None})
    assert cleared.json()["moderator_ids"] == [] and cleared.json()["moderator_id"] is None


def test_both_moderators_can_log_a_session(client, platform_admin):
    org, child = school(client, platform_admin)
    first, first_headers = moderator(client, platform_admin, org, "log.one@example.com")
    second, second_headers = moderator(client, platform_admin, org, "log.two@example.com")
    client.patch(f"{API}/children/{child['id']}", headers=platform_admin, json={"moderator_ids": [first, second]})
    dose = child["current_play_dose_id"]
    if dose:
        for headers in (first_headers, second_headers):
            logged = client.post(f"{API}/children/{child['id']}/attempts", headers=headers, json={
                "play_dose_id": dose, "occurred_on": str(date.today()), "completion_score": 4, "mood_score": 4,
            })
            assert logged.status_code in (201, 409), logged.text
