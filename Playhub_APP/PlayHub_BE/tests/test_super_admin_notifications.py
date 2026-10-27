"""A Super Admin can switch on email notifications: their own account emails plus platform alerts."""
from app.mailer import SENT

API = "/api/v1"


def sent_to(email):
    return [message for message in SENT if message.to == email]


def switch(client, headers, enabled):
    return client.put(f"{API}/auth/me/notifications", headers=headers, json={"enabled": enabled})


def school(client, admin):
    return client.post(f"{API}/organisations", headers=admin, json={"name": "Alert School", "seat_limit": 5}).json()


def test_notifications_are_off_by_default_and_only_a_super_admin_can_switch_them(client, platform_admin):
    assert client.get(f"{API}/auth/me", headers=platform_admin).json()["email_notifications"] is False
    saved = switch(client, platform_admin, True)
    assert saved.status_code == 200 and saved.json()["email_notifications"] is True
    family = client.post(f"{API}/auth/register-family", json={
        "email": "fam@example.com", "display_name": "Fam", "guardian_name": "Fam", "child_name": "Kid", "password": "secure-password",
    }).json()
    assert switch(client, {"Authorization": f"Bearer {family['access_token']}"}, True).status_code == 403


def test_with_notifications_off_a_super_admin_gets_no_alerts(client, platform_admin):
    org = school(client, platform_admin)
    SENT.clear()
    client.post(f"{API}/invitations", headers=platform_admin, json={
        "email": "new.mod@example.com", "display_name": "New Mod", "role": "moderator",
        "account_scope": "organisation", "organisation_id": org["id"],
    })
    assert sent_to("admin@example.com") == []
    assert len(sent_to("new.mod@example.com")) == 1


def test_an_opted_in_super_admin_is_told_about_invitations_without_the_activation_link(client, platform_admin):
    switch(client, platform_admin, True)
    org = school(client, platform_admin)
    SENT.clear()
    invite = client.post(f"{API}/invitations", headers=platform_admin, json={
        "email": "new.admin@example.com", "display_name": "New Admin", "role": "admin",
        "account_scope": "organisation", "organisation_id": org["id"],
    }).json()
    [alert] = sent_to("admin@example.com")
    assert alert.subject == "Play Hub alert: Admin invited at Alert School"
    assert "New Admin (new.admin@example.com)" in alert.text
    assert invite["acceptance_token"] not in alert.text
    SENT.clear()
    client.post(f"{API}/invitations/accept", json={"token": invite["acceptance_token"], "password": "A-secure-password"})
    [accepted] = sent_to("admin@example.com")
    assert "activated their account" in accepted.subject


def test_an_opted_in_super_admin_hears_about_sign_ups_and_play_pulse_leads(client, platform_admin):
    switch(client, platform_admin, True)
    SENT.clear()
    client.post(f"{API}/auth/register-family", json={
        "email": "newfam@example.com", "display_name": "New Fam", "guardian_name": "New Fam", "child_name": "Zoe", "password": "secure-password",
    })
    assert any("new family sign-up" in m.subject and "Zoe" in m.text for m in sent_to("admin@example.com"))
    SENT.clear()
    from test_play_pulse import check
    lead = client.post(f"{API}/play-pulse/results", json={
        "contact": {"name": "Lead Parent", "email": "lead@example.com", "phone": "+971501234567"}, **check(),
    })
    assert lead.status_code == 201, lead.text
    [alert] = sent_to("admin@example.com")
    assert "new Play Pulse lead" in alert.subject and "Needs practice" in alert.text


def test_switching_off_stops_alerts_and_a_disabled_super_admin_gets_none(client, platform_admin):
    switch(client, platform_admin, True)
    switch(client, platform_admin, False)
    SENT.clear()
    client.post(f"{API}/auth/register-family", json={
        "email": "quiet@example.com", "display_name": "Quiet", "guardian_name": "Quiet", "child_name": "Q", "password": "secure-password",
    })
    assert sent_to("admin@example.com") == []
