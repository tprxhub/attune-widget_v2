"""An organisation's billing schedule: periods in a row, shared by its Admin and Super Admins."""
import io
import zipfile
from datetime import date, timedelta

from app.mailer import SENT

API = "/api/v1"


def school(client, admin, name="Billing School"):
    return client.post(f"{API}/organisations", headers=admin, json={"name": name, "seat_limit": 10}).json()


def org_admin(client, platform_admin, org, email="head@example.com"):
    invite = client.post(f"{API}/invitations", headers=platform_admin, json={
        "email": email, "display_name": "Head Teacher", "role": "admin",
        "account_scope": "organisation", "organisation_id": org["id"],
    }).json()
    client.post(f"{API}/invitations/accept", json={"token": invite["acceptance_token"], "password": "A-secure-password"})
    token = client.post(f"{API}/auth/login", json={"email": email, "password": "A-secure-password"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def add(client, headers, org, **body):
    return client.post(f"{API}/organisations/{org['id']}/billing", headers=headers, json=body)


def test_periods_line_up_one_after_another(client, platform_admin):
    org = school(client, platform_admin)
    empty = client.get(f"{API}/organisations/{org['id']}/billing", headers=platform_admin).json()
    assert (empty["suggested_months"], empty["suggested_licenses"]) == (12, 10)
    first = add(client, platform_admin, org, starts_on="2026-01-01", months=4, licenses=10, license_price=3750, amount=150000)
    assert first.status_code == 201
    schedule = add(client, platform_admin, org, months=6, licenses=10, license_price=3334).json()
    one, two = schedule["periods"]
    assert (one["starts_on"], one["ends_on"], one["amount"]) == ("2026-01-01", "2026-04-30", 150000)
    # Billing 2 starts the day after Billing 1 ends; its total is licences × price × months.
    assert (two["sequence"], two["starts_on"], two["ends_on"], two["amount"]) == (2, "2026-05-01", "2026-10-31", 200040)
    assert schedule["total_months"] == 10 and schedule["total_amount"] == 350040
    assert schedule["starts_on"] == "2026-01-01" and schedule["next_starts_on"] == "2026-11-01"

    # Lengthening Billing 1 moves Billing 2 along with it.
    changed = client.patch(f"{API}/organisations/{org['id']}/billing/{one['id']}", headers=platform_admin, json={"months": 5}).json()
    assert changed["periods"][1]["starts_on"] == "2026-06-01"
    assert changed["periods"][0]["amount"] == 10 * 3750 * 5


def test_the_organisation_admin_sees_and_adds_and_super_admins_are_told(client, platform_admin):
    client.put(f"{API}/auth/me/notifications", headers=platform_admin, json={"enabled": True})
    org = school(client, platform_admin)
    head = org_admin(client, platform_admin, org)
    add(client, platform_admin, org, starts_on="2020-01-01", months=12, licenses=5, license_price=1000)
    SENT.clear()
    added = add(client, head, org, months=6, licenses=8, license_price=2000)
    assert added.status_code == 201
    [alert] = [m for m in SENT if m.to == "admin@example.com"]
    assert alert.subject == "Play Hub alert: Billing 2 added for Billing School"
    assert "AED 960.00 in total" in alert.text

    # The Super Admin sees what the Admin added, and who added it.
    seen = client.get(f"{API}/organisations/{org['id']}/billing", headers=platform_admin).json()
    assert [p["added_by_name"] for p in seen["periods"]] == ["Platform Admin", "Head Teacher"]

    # A period that has already started is the Super Admin's to change; the Admin's own upcoming one is not.
    mine = client.get(f"{API}/organisations/{org['id']}/billing", headers=head).json()["periods"]
    assert [(p["can_edit"], p["can_remove"]) for p in mine] == [(False, False), (False, False)]
    assert client.patch(f"{API}/organisations/{org['id']}/billing/{mine[0]['id']}", headers=head, json={"months": 1}).status_code == 403


def test_an_admin_can_fix_an_upcoming_period_and_only_the_latest_comes_off(client, platform_admin):
    org = school(client, platform_admin)
    head = org_admin(client, platform_admin, org)
    start = (date.today() + timedelta(days=30)).isoformat()
    add(client, head, org, starts_on=start, months=3, licenses=4, license_price=1000)
    first, second = add(client, head, org, months=3, licenses=4, license_price=1000).json()["periods"]
    assert first["status"] == "upcoming" and first["can_edit"] and not first["can_remove"] and second["can_remove"]
    fixed = client.patch(f"{API}/organisations/{org['id']}/billing/{second['id']}", headers=head, json={"licenses": 6, "note": "Extra class"})
    assert fixed.json()["periods"][1]["amount"] == 6 * 1000 * 3
    assert client.delete(f"{API}/organisations/{org['id']}/billing/{first['id']}", headers=head).status_code == 409
    left = client.delete(f"{API}/organisations/{org['id']}/billing/{second['id']}", headers=head).json()
    assert [p["sequence"] for p in left["periods"]] == [1]


def test_other_organisations_and_staff_cannot_see_the_schedule(client, platform_admin):
    org = school(client, platform_admin)
    other = school(client, platform_admin, "Other School")
    head = org_admin(client, platform_admin, other, "other.head@example.com")
    assert client.get(f"{API}/organisations/{org['id']}/billing", headers=head).status_code == 403
    assert add(client, head, org, months=1).status_code == 403
    assert client.get(f"{API}/billing/organisations/export", headers=head).status_code == 403


def test_billing_exports_as_an_excel_file(client, platform_admin):
    org = school(client, platform_admin)
    add(client, platform_admin, org, starts_on="2026-01-01", months=4, licenses=10, license_price=3750, amount=150000, note="Term 1 & 2")
    for path in (f"organisations/{org['id']}/billing/export", "billing/organisations/export"):
        response = client.get(f"{API}/{path}", headers=platform_admin)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml")
        assert ".xlsx" in response.headers["content-disposition"]
        sheet = zipfile.ZipFile(io.BytesIO(response.content)).read("xl/worksheets/sheet1.xml").decode()
        assert "Billing School" in sheet and "Billing 1" in sheet and "Term 1 &amp; 2" in sheet
        assert "<v>1500.0</v>" in sheet  # the total in dirhams
        assert f"<v>{(date(2026, 1, 1) - date(1899, 12, 30)).days}</v>" in sheet  # the start date as a real date


def test_deleting_the_organisation_removes_its_billing(client, platform_admin):
    org = school(client, platform_admin)
    add(client, platform_admin, org, months=2, licenses=1, license_price=100)
    client.patch(f"{API}/organisations/{org['id']}", headers=platform_admin, json={"is_active": False})
    deleted = client.delete(f"{API}/organisations/{org['id']}", headers=platform_admin, params={"confirm_name": org["name"]})
    assert deleted.status_code == 200
    assert client.get(f"{API}/organisations/{org['id']}/billing", headers=platform_admin).status_code == 404


def test_a_later_start_can_be_picked_but_periods_never_overlap(client, platform_admin):
    org = school(client, platform_admin)
    add(client, platform_admin, org, starts_on="2026-01-01", months=4, licenses=1, license_price=100)
    early = add(client, platform_admin, org, starts_on="2026-04-15", months=6)
    assert early.status_code == 422 and "1 May 2026" in early.json()["detail"]
    schedule = add(client, platform_admin, org, starts_on="2026-06-01", months=6).json()
    one, two = schedule["periods"]
    assert (two["starts_on"], two["ends_on"], two["earliest_start"]) == ("2026-06-01", "2026-11-30", "2026-05-01")
    assert schedule["next_starts_on"] == "2026-12-01"
    # The gap stays while Billing 1 grows into it; once they would overlap, Billing 2 moves on.
    url = f"{API}/organisations/{org['id']}/billing"
    assert client.patch(f"{url}/{one['id']}", headers=platform_admin, json={"months": 5}).json()["periods"][1]["starts_on"] == "2026-06-01"
    assert client.patch(f"{url}/{one['id']}", headers=platform_admin, json={"months": 6}).json()["periods"][1]["starts_on"] == "2026-07-01"
    assert client.patch(f"{url}/{two['id']}", headers=platform_admin, json={"starts_on": "2026-06-15"}).status_code == 422
    assert client.patch(f"{url}/{two['id']}", headers=platform_admin, json={"starts_on": "2026-08-01"}).json()["periods"][1]["starts_on"] == "2026-08-01"
