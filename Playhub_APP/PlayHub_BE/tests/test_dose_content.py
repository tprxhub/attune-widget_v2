"""Saving a Play Dose and all its activities at once: everything is saved, or nothing is."""
from datetime import date

from tests.conftest import register_family

API = "/api/v1"
VIDEO = ("activity.mp4", b"\x00\x00\x00\x18ftypmp42playhub-video", "video/mp4")


def dose_with_activities(client, admin, count=3, slug="grip-plan"):
    plan = client.post(f"{API}/play-plans", headers=admin, json={"name": f"Plan {slug}", "slug": slug}).json()
    dose = client.post(f"{API}/play-plans/{plan['id']}/play-doses", headers=admin, json={"level": "rookie", "title": "Grip"}).json()
    activities = [
        client.post(f"{API}/play-doses/{dose['id']}/activities", headers=admin, json={
            "sequence": index, "day": index, "title": f"Activity {index}", "instructions": [f"Step {index}"],
        }).json()
        for index in range(count)
    ]
    return dose, activities


def item(activity, **changes):
    return {
        "id": activity["id"], "day": activity["day"], "kind": activity["kind"], "title": activity["title"],
        "instructions": activity["instructions"], "instructions_html": activity["instructions_html"],
        "keep_video": True, "is_loggable": activity["is_loggable"], "is_real_life_try": activity["is_real_life_try"],
        **changes,
    }


def test_every_activity_and_video_is_saved_in_one_request(client, platform_admin):
    dose, (first, second, third) = dose_with_activities(client, platform_admin)
    uploaded = client.post(f"{API}/activities/{first['id']}/video", headers=platform_admin, files={"file": VIDEO}).json()

    saved = client.put(f"{API}/play-doses/{dose['id']}/content", headers=platform_admin, json={
        "dose": {"title": "Grip, renamed", "safety_note": "Supervise."},
        "activities": [
            item(third, title="Third, now first", instructions=["New step"], instructions_html="<p>New step</p>",
                 keep_video=False, video_source_type="link", video_url="https://videos.example.com/3.mp4"),
            item(first, title="First, video kept"),
            item(second, title="Second, edited"),
            {"day": 4, "title": "Brand new", "instructions": ["Fresh"], "keep_video": False},
        ],
    })
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["title"] == "Grip, renamed" and body["safety_note"] == "Supervise."
    titles = [(a["sequence"], a["title"]) for a in body["activities"]]
    assert titles == [(0, "Third, now first"), (1, "First, video kept"), (2, "Second, edited"), (3, "Brand new")]
    by_title = {a["title"]: a for a in body["activities"]}
    assert by_title["Third, now first"]["video_url"] == "https://videos.example.com/3.mp4"
    assert by_title["Third, now first"]["instructions_html"] == "<p>New step</p>"
    # An uploaded video the editor didn't touch stays exactly as it was, and its file is kept.
    kept = by_title["First, video kept"]
    assert kept["video_source_type"] == "upload" and kept["video_url"] == uploaded["video_url"]
    assert client.get(uploaded["video_url"]).status_code == 200


def test_left_out_activities_are_removed_and_their_videos_discarded(client, platform_admin):
    dose, (first, second, _third) = dose_with_activities(client, platform_admin)
    uploaded = client.post(f"{API}/activities/{second['id']}/video", headers=platform_admin, files={"file": VIDEO}).json()
    saved = client.put(f"{API}/play-doses/{dose['id']}/content", headers=platform_admin, json={"activities": [item(first)]})
    assert saved.status_code == 200
    assert [a["id"] for a in saved.json()["activities"]] == [first["id"]]
    assert client.get(uploaded["video_url"]).status_code == 404


def test_a_rejected_save_changes_nothing(client, platform_admin):
    dose, (first, second, _third) = dose_with_activities(client, platform_admin)
    org = client.post(f"{API}/organisations", headers=platform_admin, json={"name": "Grip School", "seat_limit": 5}).json()
    child = client.post(f"{API}/children", headers=platform_admin, json={
        "name": "Ada", "account_scope": "organisation", "organisation_id": org["id"], "current_play_dose_id": dose["id"],
    }).json()
    logged = client.post(f"{API}/children/{child['id']}/attempts", headers=platform_admin, json={
        "play_dose_id": dose["id"], "activity_id": second["id"], "occurred_on": str(date.today()),
        "completion_score": 4, "mood_score": 4,
    })
    assert logged.status_code == 201, logged.text
    # The second activity has a session logged, so it can't be removed: the whole save is refused.
    refused = client.put(f"{API}/play-doses/{dose['id']}/content", headers=platform_admin, json={
        "dose": {"title": "Should not stick"}, "activities": [item(first, title="Should not stick")],
    })
    assert refused.status_code == 409
    # An activity from another dose is refused too.
    _other, (stranger,) = dose_with_activities(client, platform_admin, count=1, slug="other-plan")
    refused = client.put(f"{API}/play-doses/{dose['id']}/content", headers=platform_admin, json={
        "dose": {"title": "Should not stick"},
        "activities": [item(first, title="Should not stick"), item(second), item(stranger)],
    })
    assert refused.status_code == 422
    catalog = client.get(f"{API}/play-plans?include_inactive=true", headers=platform_admin).json()
    current = next(d for p in catalog for d in p["play_doses"] if d["id"] == dose["id"])
    assert current["title"] == "Grip"
    assert [a["title"] for a in current["activities"]] == ["Activity 0", "Activity 1", "Activity 2"]


def test_only_a_super_admin_can_remove_activities(client, platform_admin):
    dose, activities = dose_with_activities(client, platform_admin, count=2)
    invited = client.post(f"{API}/invitations", headers=platform_admin, json={
        "email": "plans.editor@example.com", "display_name": "Plans Editor", "role": "ttp_employee",
        "account_scope": "platform", "organisation_id": None, "permissions": ["plans"],
    }).json()
    token = client.post(f"{API}/invitations/accept", json={"token": invited["acceptance_token"], "password": "A-secure-password"}).json()["access_token"]
    editor = {"Authorization": f"Bearer {token}"}
    edited = client.put(f"{API}/play-doses/{dose['id']}/content", headers=editor, json={
        "activities": [item(a, title=f"{a['title']} edited") for a in activities],
    })
    assert edited.status_code == 200
    removed = client.put(f"{API}/play-doses/{dose['id']}/content", headers=editor, json={"activities": [item(activities[0])]})
    assert removed.status_code == 403


def test_a_new_activity_without_a_sequence_goes_last(client, platform_admin):
    dose, activities = dose_with_activities(client, platform_admin, count=2)
    added = client.post(f"{API}/play-doses/{dose['id']}/activities", headers=platform_admin, json={"title": "Appended"})
    assert added.status_code == 201 and added.json()["sequence"] == 2


def test_a_video_uploaded_ahead_is_attached_by_the_save(client, platform_admin):
    dose, (first, second, _third) = dose_with_activities(client, platform_admin)
    stored = client.post(f"{API}/media/videos", headers=platform_admin, files={"file": VIDEO})
    assert stored.status_code == 201 and stored.json()["video_source_type"] == "upload"
    url = stored.json()["video_url"]
    saved = client.put(f"{API}/play-doses/{dose['id']}/content", headers=platform_admin, json={
        "activities": [item(first, keep_video=False, video_source_type="upload", video_url=url), item(second), item(_third)],
    })
    assert saved.status_code == 200
    assert saved.json()["activities"][0]["video_url"] == url
    assert client.get(url).status_code == 200


def test_only_plan_editors_can_upload_videos(client):
    family = register_family(client, "no.uploads@example.com")
    assert client.post(f"{API}/media/videos", headers=family, files={"file": VIDEO}).status_code == 403
