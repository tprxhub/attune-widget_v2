import csv
import io

from test_free_play_plan import register_family

GUEST = {"name": "  Sara   Khan ", "email": "Sara@Example.com", "phone": "+971 50 123 4567"}


def check(**overrides):
    body = {
        "child_name": "Zayd",
        "age_band": "preschool",
        "goal_id": "colour-lines",
        "support_score": 53,
        "tier": "practice",
        "areas_on_track": 2,
        "areas_assessed": 4,
        "domain_tiers": {"Sensory": "help", "Motor": "practice", "Cognition": "ontrack", "Engagement": "ontrack"},
        "answers": {"Sensory": [15, 40], "Motor": [65, "skipped"], "Cognition": [90, 90], "Engagement": [65, 90]},
    }
    return {**body, **overrides}


def submit(client, headers=None, **body):
    return client.post("/api/v1/play-pulse/results", headers=headers or {}, json=body)


def test_a_guest_saves_checks_with_the_form_and_is_kept_once(client, platform_admin):
    assert submit(client, **check()).status_code == 422  # guests must fill in the form
    first = submit(client, contact=GUEST, **check())
    assert first.status_code == 201
    again = submit(client, contact={**GUEST, "phone": "050 999 8888", "email": "sara@example.com"},
                   **check(child_name="Mia", goal_id="scissors"))
    assert again.status_code == 201

    page = client.get("/api/v1/admin/play-pulse/results", headers=platform_admin).json()
    assert page["total"] == 2 and page["pages"] == 1
    newest = page["items"][0]
    assert newest["child_name"] == "Mia" and newest["goal_name"] == "Learn to Use Scissors"
    # One contact per email: the second check updated the phone, and both rows show it.
    assert {row["phone"] for row in page["items"]} == {"050 999 8888"}
    assert newest["name"] == "Sara Khan" and newest["email"] == "sara@example.com"
    assert newest["source"] == "guest"
    assert newest["domain_tiers"]["Sensory"] == "help"


def test_signed_in_people_skip_the_form_and_show_their_name_and_role(client, platform_admin):
    family = register_family(client, "pulse-family@example.com")
    assert submit(client, family, **check()).status_code == 201
    row = client.get("/api/v1/admin/play-pulse/results", headers=platform_admin).json()["items"][0]
    assert row["source"] == "admin"
    assert row["email"] == "pulse-family@example.com" and row["phone"] is None
    # Details typed into the form are kept even when the browser is also signed in.
    assert submit(client, family, contact={**GUEST, "email": "typed@example.com"}, **check()).status_code == 201
    typed = client.get("/api/v1/admin/play-pulse/results", headers=platform_admin, params={"q": "typed@"}).json()
    assert [(r["name"], r["phone"], r["source"]) for r in typed["items"]] == [("Sara Khan", "+971 50 123 4567", "admin")]
    # A stale token is treated as a guest, who then needs the form.
    assert submit(client, {"Authorization": "Bearer nonsense"}, **check()).status_code == 422


def test_submissions_are_validated(client):
    bad = [
        {"contact": {**GUEST, "email": "not-an-email"}},
        {"contact": {**GUEST, "phone": "12"}},
        {"contact": {**GUEST, "name": " "}},
        {"contact": GUEST, "goal_id": "unknown-goal"},
        {"contact": GUEST, "support_score": 140},
        {"contact": GUEST, "answers": {**check()["answers"], "Motor": [65, None]}},
        {"contact": GUEST, "areas_on_track": 4},  # does not match the domain results
        {"contact": GUEST, "age_band": "teen"},
    ]
    for override in bad:
        assert submit(client, **{**check(), **override}).status_code == 422, override
    # Bots filling the hidden field get a quiet success and nothing is saved.
    assert submit(client, contact=GUEST, website="spam.example", **check()).json() == {"id": "ignored"}


def test_only_the_super_admin_sees_and_exports_results(client, platform_admin):
    family = register_family(client, "nosy@example.com")
    for path in ("/api/v1/admin/play-pulse/results", "/api/v1/admin/play-pulse/results/export"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=family).status_code == 403
        assert client.get(path, headers=platform_admin).status_code == 200


def test_filters_search_and_pagination(client, platform_admin):
    people = [
        ("Amal Hassan", "amal@example.com", "+971 55 111 2222", "reading", "help", "toddler"),
        ("Ben Ortiz", "ben@example.com", "+44 7700 900123", "scissors", "ontrack", "school"),
        ("Chen Li", "chen@example.com", "+971 50 333 4444", "reading", "practice", "preschool"),
    ]
    for name, email, phone, goal, tier, band in people:
        tiers = {"ontrack": "ontrack", "practice": "practice", "help": "help"}[tier]
        body = check(goal_id=goal, tier=tier, age_band=band, areas_on_track=4 if tier == "ontrack" else 0,
                     domain_tiers={d: tiers for d in ("Sensory", "Motor", "Cognition", "Engagement")})
        assert submit(client, contact={"name": name, "email": email, "phone": phone}, **body).status_code == 201

    def names(**params):
        response = client.get("/api/v1/admin/play-pulse/results", headers=platform_admin, params=params)
        assert response.status_code == 200, response.text
        return sorted(row["name"] for row in response.json()["items"])

    assert names(q="amal") == ["Amal Hassan"]
    assert names(q="BEN@") == ["Ben Ortiz"]
    assert names(q="7700900") == ["Ben Ortiz"]  # phone digits match across spaces
    assert names(q="971 50") == ["Chen Li"]
    assert names(goal_id="reading") == ["Amal Hassan", "Chen Li"]
    assert names(tier="ontrack") == ["Ben Ortiz"]
    assert names(age_band="toddler") == ["Amal Hassan"]
    assert names(source="account") == []
    assert names(goal_id="reading", tier="practice") == ["Chen Li"]
    assert names(date_from="2000-01-01", date_to="2000-01-02") == []

    assert client.get("/api/v1/admin/play-pulse/results", headers=platform_admin,
                      params={"page_size": 25}).status_code == 422
    for i in range(9):
        submit(client, contact={"name": f"Extra {i}", "email": f"extra{i}@example.com", "phone": "+971 50 000 0000"},
               **check())
    first = client.get("/api/v1/admin/play-pulse/results", headers=platform_admin, params={"page_size": 10}).json()
    second = client.get("/api/v1/admin/play-pulse/results", headers=platform_admin,
                        params={"page_size": 10, "page": 2}).json()
    assert (first["total"], first["pages"], len(first["items"]), len(second["items"])) == (12, 2, 10, 2)
    assert not {r["id"] for r in first["items"]} & {r["id"] for r in second["items"]}
    # A page past the end shows the last page rather than nothing.
    assert client.get("/api/v1/admin/play-pulse/results", headers=platform_admin,
                      params={"page_size": 10, "page": 9}).json()["page"] == 2


def test_export_follows_filters_or_takes_everything_and_is_formula_safe(client, platform_admin):
    submit(client, contact={"name": "=HYPERLINK(\"x\")", "email": "evil@example.com", "phone": "+971 50 000 0001"},
           **check(goal_id="reading"))
    submit(client, contact={"name": "Plain Person", "email": "plain@example.com", "phone": "+971 50 000 0002"},
           **check(goal_id="scissors"))

    def export(**params):
        response = client.get("/api/v1/admin/play-pulse/results/export", headers=platform_admin, params=params)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert "attachment" in response.headers["content-disposition"]
        return list(csv.reader(io.StringIO(response.text.lstrip("﻿"))))

    filtered = export(scope="filtered", goal_id="scissors")
    assert filtered[0][:4] == ["Submitted (UTC)", "Name", "Email", "Phone"]
    assert [row[1] for row in filtered[1:]] == ["Plain Person"]
    assert filtered[1][4] == "Guest" and filtered[1][9] == "Needs Practice" and filtered[1][10] == "2 of 4"
    everything = export(scope="all", goal_id="scissors")  # "all" ignores the filters
    assert len(everything) == 3
    assert any(row[1] == "'=HYPERLINK(\"x\")" for row in everything)
