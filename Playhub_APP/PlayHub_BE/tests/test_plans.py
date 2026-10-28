def test_plan_dose_activity_hierarchy(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Pinch & Grip Development", "slug": "pinch-grip-development", "short_description": "Grip skills"})
    assert plan.status_code == 201
    dose = client.post(f"/api/v1/play-plans/{plan.json()['id']}/play-doses", headers=platform_admin, json={"level": "rookie", "title": "Fix the Pencil Grip", "thumbnail_url": "https://example.com/thumb.jpg"})
    assert dose.status_code == 201
    activity = client.post(f"/api/v1/play-doses/{dose.json()['id']}/activities", headers=platform_admin, json={"sequence": 1, "title": "Peg Push Party", "instructions": ["Set up."], "video_source_type": "link", "video_url": "https://example.com/video.mp4"})
    assert activity.status_code == 201
    listed = client.get("/api/v1/play-plans", headers=platform_admin)
    assert listed.status_code == 200
    assert listed.json()[0]["play_doses"][0]["activities"][0]["title"] == "Peg Push Party"


def test_category_can_hold_multiple_plans_with_independent_doses(client, platform_admin):
    category = client.post(
        "/api/v1/play-categories", headers=platform_admin,
        json={"name": "Pinch & Grip Development"},
    )
    assert category.status_code == 201
    category_id = category.json()["id"]

    for name, slug in (("Fix the Pencil Grip", "fix-pencil-grip"),
                       ("Build Finger Strength", "build-finger-strength")):
        plan = client.post(
            "/api/v1/play-plans", headers=platform_admin,
            json={"name": name, "slug": slug, "category_id": category_id},
        )
        assert plan.status_code == 201
        assert plan.json()["category_id"] == category_id
        for level in ("rookie", "starter", "pro"):
            dose = client.post(
                f"/api/v1/play-plans/{plan.json()['id']}/play-doses",
                headers=platform_admin, json={"level": level, "title": name},
            )
            assert dose.status_code == 201

    catalog = client.get("/api/v1/play-plans", headers=platform_admin).json()
    assert len(catalog) == 2
    assert {plan["category_id"] for plan in catalog} == {category_id}
    assert {plan["category_name"] for plan in catalog} == {"Pinch & Grip Development"}
    assert all({dose["level"] for dose in plan["play_doses"]} == {"rookie", "starter", "pro"} for plan in catalog)

    family = client.post(
        "/api/v1/auth/register-family",
        json={"email": "same-category@example.com", "password": "secure-password",
              "guardian_name": "Family", "child_name": "Child", "child_date_of_birth": "2020-05-10"},
    ).json()
    family_headers = {"Authorization": f"Bearer {family['access_token']}"}
    child_id = client.get("/api/v1/children", headers=family_headers).json()[0]["id"]
    chosen_id = catalog[0]["id"]
    assert client.put(
        f"/api/v1/children/{child_id}/free-play-plan",
        headers=family_headers, json={"play_plan_id": chosen_id},
    ).status_code == 200
    family_catalog = client.get("/api/v1/play-plans", headers=family_headers).json()
    assert next(plan for plan in family_catalog if plan["id"] == chosen_id)["access_locked"] is False
    assert next(plan for plan in family_catalog if plan["id"] != chosen_id)["access_locked"] is True

    renamed = client.patch(
        f"/api/v1/play-categories/{category_id}", headers=platform_admin,
        json={"name": "Fine Motor Skills"},
    )
    assert renamed.status_code == 200
    assert {plan["category_name"] for plan in client.get("/api/v1/play-plans", headers=platform_admin).json()} == {"Fine Motor Skills"}

    other = client.post(
        "/api/v1/play-categories", headers=platform_admin,
        json={"name": "Everyday Skills"},
    ).json()
    moved = client.patch(
        f"/api/v1/play-plans/{catalog[1]['id']}", headers=platform_admin,
        json={"category_id": other["id"]},
    )
    assert moved.status_code == 200
    assert moved.json()["category_name"] == "Everyday Skills"

    reordered = client.put(
        "/api/v1/play-categories/order", headers=platform_admin,
        json={"ids": [other["id"], category_id]},
    )
    assert reordered.status_code == 200
    assert [item["id"] for item in reordered.json()] == [other["id"], category_id]
    assert client.get("/api/v1/play-plans", headers=platform_admin).json()[0]["id"] == moved.json()["id"]


def test_activity_requires_both_video_fields(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Visual Scanning", "slug": "visual-scanning"}).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={"level": "rookie", "title": "Scan"}).json()
    response = client.post(f"/api/v1/play-doses/{dose['id']}/activities", headers=platform_admin, json={"sequence": 1, "title": "Invalid", "video_url": "https://example.com/video.mp4"})
    assert response.status_code == 422


def test_invisible_plans_are_admin_only_and_locked_plans_stay_visible(client, platform_admin):
    invisible = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Old plan", "slug": "old-plan", "publication_status": "invisible"},
    ).json()
    locked = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Upcoming plan", "slug": "upcoming-plan", "publication_status": "locked"},
    ).json()

    member_catalog = client.get("/api/v1/play-plans", headers=platform_admin).json()
    assert invisible["id"] not in {plan["id"] for plan in member_catalog}
    assert next(plan for plan in member_catalog if plan["id"] == locked["id"])["publication_status"] == "locked"

    library = client.get("/api/v1/play-plans?include_inactive=true", headers=platform_admin).json()
    assert {invisible["id"], locked["id"]} <= {plan["id"] for plan in library}


def test_free_family_gets_every_instruction_and_video_of_the_plan_they_chose(client, platform_admin):
    plan = client.post(
        "/api/v1/play-plans",
        headers=platform_admin,
        json={"name": "Protected plan", "slug": "protected-plan"},
    ).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "rookie", "title": "Protected dose"},
    ).json()
    for sequence in (0, 2):
        created = client.post(
            f"/api/v1/play-doses/{dose['id']}/activities",
            headers=platform_admin,
            json={
                "sequence": sequence,
                "title": f"Activity {sequence}",
                "instructions": [f"Private instruction {sequence}"],
                "video_source_type": "link",
                "video_url": f"https://example.com/video-{sequence}.mp4",
            },
        )
        assert created.status_code == 201

    registered = client.post(
        "/api/v1/auth/register-family",
        json={
            "email": "catalog-family@example.com",
            "password": "secure-password",
            "guardian_name": "Catalog Parent",
            "child_name": "Catalog Child",
            "child_date_of_birth": "2020-05-10",
        },
    ).json()
    family_headers = {"Authorization": f"Bearer {registered['access_token']}"}
    child = client.get("/api/v1/children", headers=family_headers).json()[0]
    locked = client.get("/api/v1/play-plans", headers=family_headers).json()[0]
    assert locked["access_locked"] is True
    assert all(not a["instructions"] and not a["video_url"] for a in locked["play_doses"][0]["activities"])
    assert client.put(
        f"/api/v1/children/{child['id']}/free-play-plan", headers=family_headers, json={"play_plan_id": plan["id"]}
    ).status_code == 200

    activities = client.get("/api/v1/play-plans", headers=family_headers).json()[0]["play_doses"][0][
        "activities"
    ]
    assert activities[0]["instructions"] == ["Private instruction 0"]
    assert activities[1]["instructions"] == ["Private instruction 2"]
    assert activities[1]["video_url"] == "https://example.com/video-2.mp4"
