"""End-to-end coverage of every currently registered API endpoint."""
from datetime import date


def test_complete_api_surface(client, platform_admin):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["status"] == "ready"
    assert client.get("/api/v1/play-plans").status_code == 401

    organisation = client.post("/api/v1/organisations", headers=platform_admin, json={
        "name": "Harbour Kids Nursery", "kind": "nursery", "seat_limit": 20, "billing_cycle": "monthly",
    })
    assert organisation.status_code == 201
    organisation_id = organisation.json()["id"]
    assert client.get("/api/v1/organisations", headers=platform_admin).status_code == 200
    assert client.get(f"/api/v1/organisations/{organisation_id}", headers=platform_admin).status_code == 200
    assert client.patch(f"/api/v1/organisations/{organisation_id}", headers=platform_admin, json={"seat_limit": 25}).json()["seat_limit"] == 25

    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={
        "name": "Visual-Motor Integration", "slug": "visual-motor-integration", "colour": "blue",
    })
    assert plan.status_code == 201
    plan_id = plan.json()["id"]
    assert client.patch(f"/api/v1/play-plans/{plan_id}", headers=platform_admin, json={"short_description": "Eye and hand coordination"}).status_code == 200
    dose = client.post(f"/api/v1/play-plans/{plan_id}/play-doses", headers=platform_admin, json={
        "level": "rookie", "title": "Eye-Hand Basics", "sort_order": 1,
    })
    assert dose.status_code == 201
    dose_id = dose.json()["id"]
    assert client.patch(f"/api/v1/play-doses/{dose_id}", headers=platform_admin, json={"age_guidance": "Ages 3+"}).status_code == 200

    disposable_dose = client.post(f"/api/v1/play-plans/{plan_id}/play-doses", headers=platform_admin, json={
        "level": "pro", "title": "Disposable Dose", "sort_order": 9,
    }).json()
    assert client.delete(f"/api/v1/play-doses/{disposable_dose['id']}", headers=platform_admin).status_code == 204

    activity = client.post(f"/api/v1/play-doses/{dose_id}/activities", headers=platform_admin, json={
        "sequence": 1, "day": 1, "title": "Track the Trail", "instructions": ["Follow the path."],
    })
    assert activity.status_code == 201
    activity_id = activity.json()["id"]
    assert client.patch(f"/api/v1/activities/{activity_id}", headers=platform_admin, json={
        "video_source_type": "link", "video_url": "https://example.test/track.mp4",
    }).status_code == 200
    disposable_activity = client.post(f"/api/v1/play-doses/{dose_id}/activities", headers=platform_admin, json={
        "sequence": 99, "title": "Disposable Activity",
    }).json()
    assert client.delete(f"/api/v1/activities/{disposable_activity['id']}", headers=platform_admin).status_code == 204

    thumbnail_bytes = b"\x89PNG\r\n\x1a\nplayhub-thumbnail"
    thumbnail = client.post(f"/api/v1/play-doses/{dose_id}/thumbnail", headers=platform_admin,
                            files={"file": ("thumbnail.png", thumbnail_bytes, "image/png")})
    assert thumbnail.status_code == 200 and "/uploads/media/thumbnails/" in thumbnail.json()["thumbnail_url"]
    thumbnail_asset = client.get(thumbnail.json()["thumbnail_url"])
    assert thumbnail_asset.status_code == 200 and thumbnail_asset.content == thumbnail_bytes
    assert thumbnail_asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    old_thumbnail_url = thumbnail.json()["thumbnail_url"]
    replacement = client.post(
        f"/api/v1/play-doses/{dose_id}/thumbnail",
        headers=platform_admin,
        files={"file": ("replacement.png", b"\x89PNG\r\n\x1a\nreplacement", "image/png")},
    )
    assert replacement.status_code == 200
    assert replacement.json()["thumbnail_url"] != old_thumbnail_url
    assert client.get(old_thumbnail_url).status_code == 404
    video = client.post(f"/api/v1/activities/{activity_id}/video", headers=platform_admin,
                        files={"file": ("activity.mp4", b"\x00\x00\x00\x18ftypmp42playhub-video", "video/mp4")})
    assert video.status_code == 200 and video.json()["video_source_type"] == "upload"

    child = client.post("/api/v1/children", headers=platform_admin, json={
        "name": "Noah", "account_scope": "organisation", "organisation_id": organisation_id,
        "current_play_dose_id": dose_id,
    })
    assert child.status_code == 201
    child_id = child.json()["id"]
    assert client.get("/api/v1/children", headers=platform_admin).status_code == 200
    assert client.patch(f"/api/v1/children/{child_id}", headers=platform_admin, json={"notes": "Prefers morning sessions."}).status_code == 200
    assert client.put(f"/api/v1/children/{child_id}/subscription", headers=platform_admin, json={
        "status": "active", "plan_name": "Monthly", "started_on": str(date.today()),
    }).status_code == 200

    attempt = client.post(f"/api/v1/children/{child_id}/attempts", headers=platform_admin, json={
        "play_dose_id": dose_id, "activity_id": activity_id, "occurred_on": str(date.today()),
        "completion_score": 4, "mood_score": 5,
    })
    assert attempt.status_code == 201
    assert client.get(f"/api/v1/children/{child_id}/attempts?play_plan_id={plan_id}", headers=platform_admin).status_code == 200
    progress = client.get(f"/api/v1/children/{child_id}/progress?play_plan_id={plan_id}&from_date={date.today()}", headers=platform_admin)
    assert progress.status_code == 200 and progress.json()["total_attempts"] == 1
    platform_progress = client.get("/api/v1/admin/progress", headers=platform_admin)
    assert platform_progress.status_code == 200
    assert any(item["child_id"] == child_id and item["total_attempts"] == 1 for item in platform_progress.json())

    users = client.get("/api/v1/users", headers=platform_admin).json()
    current_admin = next(item for item in users if item["email"] == "admin@example.com")
    updated_user = client.patch(f"/api/v1/users/{current_admin['id']}", headers=platform_admin, json={
        "display_name": "Updated Platform Admin",
    })
    assert updated_user.status_code == 200
    assert client.get("/api/v1/invitations", headers=platform_admin).status_code == 200
