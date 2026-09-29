from datetime import date, timedelta


def create_catalog(client, headers):
    plan = client.post(
        "/api/v1/play-plans",
        headers=headers,
        json={"name": "Check-In Integrity", "slug": "check-in-integrity"},
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=headers,
        json={"level": "rookie", "title": "Assigned Dose", "sort_order": 0},
    ).json()
    intro = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=headers,
        json={"sequence": 0, "title": "Introduction", "kind": "introduction", "is_loggable": False},
    ).json()
    activity = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=headers,
        json={"sequence": 1, "title": "Tracked Activity", "is_loggable": True},
    ).json()
    other_dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=headers,
        json={"level": "starter", "title": "Unassigned Dose", "sort_order": 1},
    ).json()
    return plan, dose, intro, activity, other_dose


def test_checkin_is_persisted_and_progress_is_calculated_from_authoritative_data(client, platform_admin):
    plan, dose, intro, activity, other_dose = create_catalog(client, platform_admin)
    token = client.post(
        "/api/v1/auth/register-family",
        json={
            "email": "checkin-family@example.com",
            "password": "secure-password",
            "guardian_name": "Check-In Parent",
            "child_name": "Check-In Child",
        },
    ).json()["access_token"]
    family = {"Authorization": f"Bearer {token}"}
    child = client.get("/api/v1/children", headers=family).json()[0]
    # Every child starts at Starter unless a consultation explicitly assigns another level.
    assert child["current_play_dose_id"] == other_dose["id"]
    client.put(
        f"/api/v1/children/{child['id']}/subscription",
        headers=platform_admin,
        json={
            "status": "active",
            "plan_name": "test",
            "started_on": str(date.today() - timedelta(days=10)),
            "ends_on": str(date.today() + timedelta(days=30)),
        },
    )

    dates = [date.today() - timedelta(days=2), date.today() - timedelta(days=1), date.today()]
    for index, (score, occurred_on) in enumerate(zip((2, 3, 5), dates)):
        response = client.post(
            f"/api/v1/children/{child['id']}/attempts",
            headers=family,
            json={
                "play_dose_id": dose["id"],
                "activity_id": activity["id"],
                "occurred_on": str(occurred_on),
                "completion_score": score,
                "mood_score": 4,
                "big_win": f"Observable win {index}",
                "source": "daily_check_in" if index < 2 else "play_dose",
            },
        )
        assert response.status_code == 201
        assert response.json()["logged_by_name"] == "Check-In Parent"

    history = client.get(f"/api/v1/children/{child['id']}/attempts", headers=family)
    assert history.status_code == 200
    assert [row["completion_score"] for row in history.json()] == [5, 3, 2]

    progress = client.get(f"/api/v1/children/{child['id']}/progress", headers=family)
    assert progress.status_code == 200
    summary = progress.json()
    assert summary["total_attempts"] == 3
    assert summary["check_in_count"] == 2
    assert summary["activities_completed"] == 1
    assert summary["average_completion_score"] == 3.33
    assert summary["average_mood_score"] == 4
    assert summary["support_score"] == 56
    assert summary["last_check_in"] == str(date.today() - timedelta(days=1))
    assert summary["trend"] == "progress"
    assert [point["source"] for point in summary["points"]] == [
        "daily_check_in",
        "daily_check_in",
        "play_dose",
    ]
    assert all(point["attempt_id"] for point in summary["points"])

    future = client.post(
        f"/api/v1/children/{child['id']}/attempts",
        headers=family,
        json={
            "play_dose_id": dose["id"],
            "activity_id": activity["id"],
            "occurred_on": str(date.today() + timedelta(days=1)),
            "completion_score": 3,
            "mood_score": 3,
        },
    )
    assert future.status_code == 422

    non_loggable = client.post(
        f"/api/v1/children/{child['id']}/attempts",
        headers=family,
        json={
            "play_dose_id": dose["id"],
            "activity_id": intro["id"],
            "occurred_on": str(date.today()),
            "completion_score": 3,
            "mood_score": 3,
        },
    )
    assert non_loggable.status_code == 422

    selected_other_dose = client.post(
        f"/api/v1/children/{child['id']}/attempts",
        headers=family,
        json={
            "play_dose_id": other_dose["id"],
            "occurred_on": str(date.today()),
            "completion_score": 3,
            "mood_score": 3,
        },
    )
    assert selected_other_dose.status_code == 201
    assert selected_other_dose.json()["play_dose_id"] == other_dose["id"]
    assert selected_other_dose.json()["play_plan_id"] == plan["id"]

    invalid_range = client.get(
        f"/api/v1/children/{child['id']}/progress?from_date={date.today()}&to_date={dates[0]}",
        headers=family,
    )
    assert invalid_range.status_code == 422

    audit = client.get("/api/v1/audit-events", headers=platform_admin).json()
    assert len([event for event in audit if event["action"] == "attempt.created"]) == 4

    client.put(
        f"/api/v1/children/{child['id']}/subscription",
        headers=platform_admin,
        json={"status": "expired", "plan_name": "test", "started_on": str(dates[0]), "ends_on": str(dates[1])},
    )
    expired = client.post(
        f"/api/v1/children/{child['id']}/attempts",
        headers=family,
        json={
            "play_dose_id": dose["id"],
            "activity_id": activity["id"],
            "occurred_on": str(date.today()),
            "completion_score": 3,
            "mood_score": 3,
        },
    )
    assert expired.status_code == 403


def test_recent_eight_attempts_drive_the_current_trend(client, platform_admin):
    _, dose, _, activity, _ = create_catalog(client, platform_admin)
    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={"name": "Trend Child", "account_scope": "individual", "current_play_dose_id": dose["id"]},
    ).json()
    # Old high scores must not mask a current decline.
    scores = [5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 3, 2]
    start = date.today() - timedelta(days=len(scores))
    for index, score in enumerate(scores):
        assert client.post(
            f"/api/v1/children/{child['id']}/attempts",
            headers=platform_admin,
            json={
                "play_dose_id": dose["id"],
                "activity_id": activity["id"],
                "occurred_on": str(start + timedelta(days=index)),
                "completion_score": score,
                "mood_score": 3,
            },
        ).status_code == 201
    assert client.get(
        f"/api/v1/children/{child['id']}/progress", headers=platform_admin
    ).json()["trend"] == "decline"
