from app.rich_text import clean_rich_text


def test_formatting_survives_and_scripts_do_not():
    dirty = (
        '<h3>Goal</h3><p><strong>Bold</strong> <em>soft</em> <u>under</u></p>'
        '<ol><li>One</li><li>Two<ul><li>Sub</li></ul></li></ol>'
        '<p onclick="steal()">x</p><script>alert(1)</script><img src=x onerror=alert(1)>'
        '<a href="javascript:alert(1)">bad</a><a href="https://thetoypharmacy.com">ok</a>'
    )
    cleaned = clean_rich_text(dirty)
    for kept in ("<h3>Goal</h3>", "<strong>Bold</strong>", "<em>soft</em>", "<u>under</u>", "<ol>", "<ul>", "<li>Sub</li>"):
        assert kept in cleaned
    for gone in ("script", "onclick", "onerror", "<img", "javascript:"):
        assert gone not in cleaned
    assert 'href="https://thetoypharmacy.com"' in cleaned and 'rel="noopener noreferrer nofollow"' in cleaned
    assert clean_rich_text("<p><br></p>  ") is None
    assert clean_rich_text(None) is None


def test_activity_saves_formatted_steps_cleaned(client, platform_admin):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Rich", "slug": "rich"}).json()
    dose = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={"level": "rookie", "title": "Rookie"}
    ).json()
    created = client.post(
        f"/api/v1/play-doses/{dose['id']}/activities",
        headers=platform_admin,
        json={"sequence": 0, "title": "Tap", "instructions": ["Goal"], "instructions_html": "<p><b>Goal</b><script>x</script></p>"},
    )
    assert created.status_code == 201
    assert created.json()["instructions_html"] == "<p><b>Goal</b></p>"
    updated = client.patch(
        f"/api/v1/activities/{created.json()['id']}", headers=platform_admin, json={"instructions_html": "<p> </p>"}
    )
    assert updated.status_code == 200 and updated.json()["instructions_html"] is None
