import copy

import pytest

URL = "/api/v1/site-content/homepage"


def homepage(**overrides):
    content = {
        "hero": {
            "eyebrow": "The Toy Pharmacy",
            "title": "Small doses of play,",
            "title_highlight": "real skill change",
            "description": "Play Hub turns one child-development goal into a one-week Play Plan.",
            "primary_cta": "For families",
            "secondary_cta": "For schools & clinics",
            "footnote": "Families start free.",
            "image_url": "",
        },
        "journey": {
            "eyebrow": "How it works",
            "title": "Your play journey",
            "steps": [
                {"title": "Pick a Play Plan", "body": "Choose a skill area and a level.", "image_url": ""},
                {"title": "Run a Play Dose", "body": "Guided play each day.", "image_url": ""},
                {"title": "Log the Attempt", "body": "Record finish, help and Mood.", "image_url": ""},
            ],
        },
        "skills": {
            "title": "Three skill areas, one Play Kit",
            "description": "Choose a skill area.",
            "button_label": "Browse Play Plans",
            "all_plans_label": "View all 21 Play Plans",
        },
        "week": {
            "eyebrow": "The Play Plan week",
            "title": "A week that",
            "title_highlight": "builds over time",
            "description": "Nine entries, fixed order, no guesswork.",
            "button_label": "Daily Check-In",
            "image_url": "",
            "steps": [
                {"when": "Day 0", "title": "Introduction", "body": "Watch the short intro."},
                {"when": "Days 1–2", "title": "Finding the rhythm", "body": "Two more Play Doses."},
                {"when": "Days 3–5", "title": "Redo Day", "body": "The same Activity comes back."},
                {"when": "Week end", "title": "Level-Up Prompt", "body": "The Final Redo Day closes the week."},
            ],
            "stats": [
                {"value": "9", "label": "entries in every Play Plan week"},
                {"value": "7", "label": "loggable sessions, scored 1–5"},
                {"value": "3", "label": "levels for every skill area"},
                {"value": "1", "label": "Fine Motor Play Kit throughout"},
            ],
        },
        "levels": {
            "eyebrow": "Levels",
            "title": "Start at Starter.",
            "descriptions": ["Simple.", "Medium and the default.", "Complex."],
        },
        "stories": {
            "title": "Real Play Hub stories",
            "subtitle": "Families, schools and clinics run the same week.",
            "quotes": [
                {"quote": "A short routine after breakfast.", "name": "Amira's mum", "role": "Family account"},
                {"quote": "The Progress narrative writes my notes.", "name": "Esther M.", "role": "Paediatric therapist"},
            ],
        },
        "families": {"title": "Families", "body": "Sign up free.", "button_label": "Create a free account"},
        "schools": {"title": "Schools & clinics", "body": "Created by The Toy Pharmacy.", "button_label": "Log in"},
        "footer": {
            "title": "Start this week's Play Plan",
            "description": "A little play each day.",
            "button_label": "Get started free",
            "blurb": "Play Plans, Play Doses and honest progress tracking.",
            "copyright": "The Toy Pharmacy · Play Hub",
        },
    }
    for path, value in overrides.items():
        target = content
        *parents, last = path.split(".")
        for part in parents:
            target = target[int(part)] if part.isdigit() else target[part]
        target[int(last) if last.isdigit() else last] = value
    return content


@pytest.fixture
def family(client):
    response = client.post(
        "/api/v1/auth/register-family",
        json={
            "email": "family@example.com",
            "password": "secure-password",
            "guardian_name": "A Parent",
            "child_name": "A Child",
            "child_date_of_birth": "2021-05-10",
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_homepage_content_is_public_and_empty_until_saved(client):
    response = client.get(URL)

    assert response.status_code == 200
    assert response.json() == {"content": None, "updated_at": None}


def test_only_a_super_admin_can_change_the_homepage(client, family, platform_admin):
    assert client.put(URL, json=homepage()).status_code == 401
    assert client.put(URL, headers=family, json=homepage()).status_code == 403
    assert client.delete(URL).status_code == 401
    assert client.delete(URL, headers=family).status_code == 403

    assert client.get(URL).json()["content"] is None
    assert client.put(URL, headers=platform_admin, json=homepage()).status_code == 200


def test_saved_copy_is_served_to_everyone_and_replaced_on_the_next_save(client, platform_admin):
    saved = client.put(URL, headers=platform_admin, json=homepage(**{"hero.title": "Play, a little every day"}))

    assert saved.status_code == 200
    assert saved.json()["content"]["hero"]["title"] == "Play, a little every day"
    assert saved.json()["updated_at"]

    public = client.get(URL).json()
    assert public["content"]["hero"]["title"] == "Play, a little every day"
    assert public["content"]["stories"]["quotes"][1]["name"] == "Esther M."

    client.put(URL, headers=platform_admin, json=homepage(**{"hero.title": "Second version"}))
    assert client.get(URL).json()["content"]["hero"]["title"] == "Second version"


def test_reset_removes_the_saved_copy_and_can_be_repeated(client, platform_admin):
    client.put(URL, headers=platform_admin, json=homepage())

    assert client.delete(URL, headers=platform_admin).status_code == 204
    assert client.get(URL).json()["content"] is None
    assert client.delete(URL, headers=platform_admin).status_code == 204


def test_text_is_trimmed_before_it_is_stored(client, platform_admin):
    saved = client.put(URL, headers=platform_admin, json=homepage(**{"hero.eyebrow": "   The Toy Pharmacy   "}))

    assert saved.json()["content"]["hero"]["eyebrow"] == "The Toy Pharmacy"


def test_stories_can_be_added_and_removed_within_limits(client, platform_admin):
    quote = {"quote": "Lovely.", "name": "A parent", "role": "Family account"}
    one = homepage(**{"stories.quotes": [quote]})
    six = homepage(**{"stories.quotes": [quote] * 6})

    assert client.put(URL, headers=platform_admin, json=one).status_code == 200
    assert client.put(URL, headers=platform_admin, json=six).status_code == 200
    assert client.put(URL, headers=platform_admin, json=homepage(**{"stories.quotes": []})).status_code == 422
    assert client.put(URL, headers=platform_admin, json=homepage(**{"stories.quotes": [quote] * 7})).status_code == 422


@pytest.mark.parametrize(
    "path, value",
    [
        ("hero.title", ""),
        ("hero.title", "   "),
        ("hero.title", "x" * 161),
        ("hero.description", "x" * 601),
        ("hero.primary_cta", "x" * 81),
        ("week.stats.0.value", "x" * 13),
        ("journey.steps", homepage()["journey"]["steps"][:2]),
        ("week.steps", homepage()["week"]["steps"] + homepage()["week"]["steps"][:1]),
        ("levels.descriptions", ["only one"]),
    ],
)
def test_invalid_copy_is_rejected_and_nothing_is_saved(client, platform_admin, path, value):
    response = client.put(URL, headers=platform_admin, json=homepage(**{path: value}))

    assert response.status_code == 422
    assert client.get(URL).json()["content"] is None


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD4=",
        "//evil.example/pic.jpg",
        "ftp://example.com/pic.jpg",
        "https://example.com/a b.jpg",
        "pic.jpg",
    ],
)
def test_unsafe_image_urls_are_rejected(client, platform_admin, url):
    for path in ("hero.image_url", "week.image_url", "journey.steps.0.image_url"):
        assert client.put(URL, headers=platform_admin, json=homepage(**{path: url})).status_code == 422


@pytest.mark.parametrize("url", ["", "https://images.example.com/hero.jpg?q=80&w=2000", "http://cdn.example.com/a.png", "/uploads/media/hero.jpg"])
def test_http_https_and_site_relative_image_urls_are_accepted(client, platform_admin, url):
    response = client.put(URL, headers=platform_admin, json=homepage(**{"hero.image_url": url}))

    assert response.status_code == 200
    assert response.json()["content"]["hero"]["image_url"] == url


def test_unknown_or_missing_sections_are_rejected(client, platform_admin):
    extra = homepage()
    extra["hero"]["html"] = "<script>alert(1)</script>"
    missing = homepage()
    del missing["footer"]

    assert client.put(URL, headers=platform_admin, json=extra).status_code == 422
    assert client.put(URL, headers=platform_admin, json=missing).status_code == 422
    assert client.put(URL, headers=platform_admin, json={}).status_code == 422


def test_markup_is_stored_verbatim_as_text(client, platform_admin):
    saved = client.put(URL, headers=platform_admin, json=homepage(**{"hero.title": "<b>Bold</b> & <script>x</script>"}))

    # The API never interprets it; the frontend renders every field as plain text.
    assert saved.json()["content"]["hero"]["title"] == "<b>Bold</b> & <script>x</script>"


def test_saving_and_resetting_are_audited(client, platform_admin):
    client.put(URL, headers=platform_admin, json=copy.deepcopy(homepage()))
    client.delete(URL, headers=platform_admin)

    events = client.get("/api/v1/audit-events", headers=platform_admin).json()
    actions = [event["action"] for event in events if event["resource_type"] == "site_content"]

    assert "site_content.updated" in actions
    assert "site_content.reset" in actions
