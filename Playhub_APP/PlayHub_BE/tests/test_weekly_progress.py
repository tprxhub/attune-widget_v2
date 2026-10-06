from datetime import date, timedelta


def test_new_child_defaults_to_the_first_active_starter_dose(client, platform_admin):
    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Starter default", "slug": "starter-default"},
    ).json()
    client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "rookie", "title": "Rookie", "sort_order": 0},
    )
    starter = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "starter", "title": "Starter", "sort_order": 1},
    ).json()

    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={"name": "Starter Child", "account_scope": "individual"},
    )

    assert child.status_code == 201
    assert child.json()["current_play_dose_id"] == starter["id"]
    assert child.json()["plan_started_at"] == str(date.today())


def test_starter_week_passes_with_four_qualifying_kit_days_and_real_life_try(client, platform_admin):
    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Weekly pass test", "slug": "weekly-pass-test"},
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "starter", "title": "Functional goal"},
    ).json()
    activities = []
    for day in range(1, 7):
        activities.append(
            client.post(
                f"/api/v1/play-doses/{dose['id']}/activities",
                headers=platform_admin,
                json={
                    "sequence": day,
                    "day": day,
                    "title": "Real-Life Try" if day == 6 else f"Kit day {day}",
                    "is_real_life_try": day == 6,
                },
            ).json()
        )
    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={"name": "Weekly Child", "account_scope": "individual", "current_play_dose_id": dose["id"]},
    ).json()
    start = date.today() - timedelta(days=5)
    for index, activity in enumerate(activities):
        response = client.post(
            f"/api/v1/children/{child['id']}/attempts",
            headers=platform_admin,
            json={
                "play_dose_id": dose["id"],
                "activity_id": activity["id"],
                "occurred_on": str(start + timedelta(days=index)),
                "completion_status": "finished",
                "help_level": "one_reminder",
                "mood_score": 4,
                "big_win": "Needed less help today.",
            },
        )
        assert response.status_code == 201

    summary = client.get(
        f"/api/v1/children/{child['id']}/progress?play_plan_id={plan['id']}",
        headers=platform_admin,
    ).json()
    week = summary["weekly_points"][0]
    assert week["support_score"] == 33
    assert week["finished_count"] == 5
    assert week["real_life_try_passed"] is True
    assert week["passed"] is True
    # The old plan score is gone from the API.
    assert "gas_score" not in week
    assert "plan_score" not in summary
    assert "plan_complete" not in summary


def test_real_life_try_passes_with_one_reminder_at_any_level_and_completes_the_dose(client, platform_admin):
    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Pro pass test", "slug": "pro-pass-test"},
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "pro", "title": "Pro goal"},
    ).json()
    real_try = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={"sequence": 6, "day": 6, "title": "Pro Try", "is_real_life_try": True},
    ).json()
    child = client.post(
        "/api/v1/children",
        headers=platform_admin,
        json={"name": "Pro Child", "account_scope": "individual", "current_play_dose_id": dose["id"]},
    ).json()
    logged = client.post(
        f"/api/v1/children/{child['id']}/attempts",
        headers=platform_admin,
        json={
            "play_dose_id": dose["id"],
            "activity_id": real_try["id"],
            "occurred_on": str(date.today()),
            "completion_status": "finished",
            "help_level": "one_reminder",
            "mood_score": 5,
        },
    )
    assert logged.status_code == 201
    assert logged.json()["is_real_life_try"] is True
    summary = client.get(
        f"/api/v1/children/{child['id']}/progress", headers=platform_admin
    ).json()
    week = summary["weekly_points"][0]
    # Spec: the Try passes at one reminder or less at every level, and finishing it completes the dose.
    assert week["real_life_try_passed"] is True
    assert week["complete"] is True
    assert week["passed"] is False  # fewer than 4 practice days finished easily
    assert week["support_score"] == 33
    assert week["days"][-1]["is_try"] is True


def test_check_in_without_finishing_has_no_help_level_or_score(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Unfinished", "slug": "unfinished"}).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={"level": "starter", "title": "S"}).json()
    activity = client.post(f"/api/v1/play-doses/{dose['id']}/activities", headers=platform_admin, json={"sequence": 1, "day": 1, "title": "Day 1"}).json()
    child = client.post("/api/v1/children", headers=platform_admin, json={"name": "U Child", "account_scope": "individual", "current_play_dose_id": dose["id"]}).json()
    base = {"play_dose_id": dose["id"], "activity_id": activity["id"], "occurred_on": str(date.today()), "mood_score": 3}
    no = client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin,
                     json={**base, "completion_status": "stopped_early", "help_level": "hands_on"})
    assert no.status_code == 201
    assert no.json()["help_level"] is None and no.json()["completion_status"] == "stopped_early"
    partly = client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin, json={**base, "completion_status": "partly"})
    assert partly.json()["completion_status"] == "stopped_early"
    missing = client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin, json={**base, "completion_status": "finished"})
    assert missing.status_code == 422
    week = client.get(f"/api/v1/children/{child['id']}/progress", headers=platform_admin).json()["weekly_points"][0]
    assert week["support_score"] is None and week["finished_count"] == 0
