from datetime import date


def test_attempt_and_filtered_progress(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Bilateral Coordination", "slug": "bilateral-coordination"}).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={"level": "starter", "title": "Learn to Button a Shirt"}).json()
    child = client.post("/api/v1/children", headers=platform_admin, json={"name": "Amira", "account_scope": "individual", "current_play_dose_id": dose["id"]}).json()
    for score in (2, 3, 4):
        response = client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin, json={"play_dose_id": dose["id"], "occurred_on": str(date.today()), "completion_score": score, "mood_score": 4})
        assert response.status_code == 201
    progress = client.get(f"/api/v1/children/{child['id']}/progress?play_plan_id={plan['id']}", headers=platform_admin)
    assert progress.status_code == 200
    assert progress.json()["total_attempts"] == 3
    # No dose has a finished Real-Life Try yet, so there is no trend to read.
    assert progress.json()["trend"] == "insufficient_data"


def test_free_family_cannot_bypass_attempt_entitlement(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={
        "name": "Free Gate", "slug": "free-gate",
    }).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={
        "level": "rookie", "title": "Preview Dose",
    }).json()
    registered = client.post("/api/v1/auth/register-family", json={
        "email": "free-family@example.com", "password": "secure-password",
        "guardian_name": "Free Parent", "child_name": "Free Child",
    }).json()
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    child = client.get("/api/v1/children", headers=headers).json()[0]
    response = client.post(f"/api/v1/children/{child['id']}/attempts", headers=headers, json={
        "play_dose_id": dose["id"], "occurred_on": str(date.today()),
        "completion_score": 4, "mood_score": 4,
    })
    assert response.status_code == 403


def test_session_correction_preserves_count_and_audits_original_values(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Corrections", "slug": "corrections"}).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={"level": "starter", "title": "Practice"}).json()
    child = client.post("/api/v1/children", headers=platform_admin, json={"name": "Amira", "account_scope": "individual", "current_play_dose_id": dose["id"]}).json()
    payload = {"play_dose_id": dose["id"], "occurred_on": str(date.today()), "completion_score": 2, "mood_score": 2, "big_win": "Original win"}
    row = client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin, json=payload).json()
    url = f"/api/v1/children/{child['id']}/attempts/{row['id']}"
    corrected = client.patch(url, headers=platform_admin, json={**payload, "completion_score": 5, "mood_score": 5, "big_win": "Corrected win"})
    assert corrected.status_code == 200
    assert corrected.json()["help_level"] == "independent"
    assert corrected.json()["logged_by_name"] == row["logged_by_name"]
    summary = client.get(f"/api/v1/children/{child['id']}/progress", headers=platform_admin).json()
    assert summary["total_attempts"] == 1
    assert summary["average_mood_score"] == 5
    events = client.get("/api/v1/audit-events", headers=platform_admin).json()
    event = next(event for event in events if event["action"] == "attempt.corrected")
    assert event["metadata_json"]["before"]["big_win"] == "Original win"
    assert event["metadata_json"]["after"]["big_win"] == "Corrected win"
    assert client.patch(url, headers=platform_admin, json={**payload, "mood_score": 9}).status_code == 422
    assert client.patch(url, json=payload).status_code in (401, 403)
    other = client.post("/api/v1/children", headers=platform_admin, json={"name": "Other", "account_scope": "individual"}).json()
    assert client.patch(f"/api/v1/children/{other['id']}/attempts/{row['id']}", headers=platform_admin, json=payload).status_code == 404
