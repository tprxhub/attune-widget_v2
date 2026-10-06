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
