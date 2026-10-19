from datetime import date

from app.licenses import add_cycle


def make(client, admin, **body):
    response = client.post("/api/v1/organisations", headers=admin, json={"name": "Billing School", **body})
    assert response.status_code == 201, response.text
    return response.json()


def test_cycles_add_whole_months_or_years_and_clamp_month_ends():
    assert add_cycle(date(2026, 1, 15), "monthly") == date(2026, 2, 15)
    assert add_cycle(date(2026, 1, 31), "monthly") == date(2026, 2, 28)
    assert add_cycle(date(2026, 12, 10), "monthly") == date(2027, 1, 10)
    assert add_cycle(date(2028, 2, 29), "annual") == date(2029, 2, 28)
    assert add_cycle(date(2026, 3, 1), "annual") == date(2027, 3, 1)


def test_new_organisations_get_a_cycle_price_and_renewal_date(client, platform_admin):
    org = make(client, platform_admin, seat_limit=40, license_price=900, billing_cycle="monthly",
               billing_started_on="2026-01-31")
    assert org["billing_cycle"] == "monthly" and org["license_price"] == 900
    assert org["renews_on"] == "2026-02-28"
    assert org["amount_per_cycle"] == 36000  # 40 licences × AED 9
    assert org["annual_value"] == 432000     # 12 months
    assert org["renewal_status"] == "overdue"  # that date has passed

    defaults = make(client, platform_admin, name="Default School", seat_limit=10)
    assert defaults["billing_cycle"] == "annual" and defaults["license_price"] == 0
    assert defaults["billing_started_on"] == date.today().isoformat()
    assert defaults["renews_on"] == add_cycle(date.today(), "annual").isoformat()
    assert defaults["renewal_status"] == "active"
    assert client.post("/api/v1/organisations", headers=platform_admin,
                       json={"name": "Odd", "billing_cycle": "weekly"}).status_code == 422


def test_recording_a_renewal_moves_the_date_by_one_cycle(client, platform_admin):
    org = make(client, platform_admin, seat_limit=5, license_price=9900, billing_cycle="annual",
               billing_started_on="2025-03-01")
    renewed = client.post(f"/api/v1/organisations/{org['id']}/renewal", headers=platform_admin)
    assert renewed.status_code == 200
    assert renewed.json()["renews_on"] == "2027-03-01"

    # Switching to monthly keeps the paid-up date; the next renewal adds a month.
    switched = client.patch(f"/api/v1/organisations/{org['id']}", headers=platform_admin,
                            json={"billing_cycle": "monthly", "license_price": 900})
    assert switched.json()["renews_on"] == "2027-03-01" and switched.json()["annual_value"] == 5 * 900 * 12
    again = client.post(f"/api/v1/organisations/{org['id']}/renewal", headers=platform_admin).json()
    assert again["renews_on"] == "2027-04-01"

    # The renewal date can be set by hand, e.g. to match an invoice.
    soon = add_cycle(date.today(), "monthly")
    fixed = client.patch(f"/api/v1/organisations/{org['id']}", headers=platform_admin,
                         json={"renews_on": date.today().isoformat()}).json()
    assert fixed["renewal_status"] == "due_soon"
    assert client.post(f"/api/v1/organisations/{org['id']}/renewal", headers=platform_admin).json()["renews_on"] == soon.isoformat()


def test_only_organisation_managers_can_record_renewals(client, platform_admin):
    from test_free_play_plan import register_family

    org = make(client, platform_admin, seat_limit=5)
    family = register_family(client, "billing-family@example.com")
    assert client.post(f"/api/v1/organisations/{org['id']}/renewal", headers=family).status_code == 403
    assert client.post(f"/api/v1/organisations/{org['id']}/renewal").status_code == 401


def test_the_price_is_per_licence_per_month_and_annual_billing_charges_twelve_months(client, platform_admin):
    org = make(client, platform_admin, seat_limit=10, license_price=1875, billing_cycle="annual")
    assert org["amount_per_cycle"] == 10 * 1875 * 12   # AED 2,250 once a year
    assert org["annual_value"] == 10 * 1875 * 12
    monthly = client.patch(f"/api/v1/organisations/{org['id']}", headers=platform_admin, json={"billing_cycle": "monthly"}).json()
    assert monthly["amount_per_cycle"] == 10 * 1875      # AED 187.50 a month
    assert monthly["annual_value"] == 10 * 1875 * 12


def test_a_custom_cycle_of_ten_months_charges_ten_months_and_renews_ten_months_later(client, platform_admin):
    org = make(client, platform_admin, seat_limit=10, license_price=1875, billing_cycle="10_months",
               billing_started_on="2026-01-15")
    assert org["billing_cycle"] == "10_months"
    assert org["amount_per_cycle"] == 10 * 1875 * 10      # AED 1,875 every 10 months
    assert org["annual_value"] == 10 * 1875 * 12
    assert org["renews_on"] == "2026-11-15"
    renewed = client.post(f"/api/v1/organisations/{org['id']}/renewal", headers=platform_admin).json()
    assert renewed["renews_on"] == "2027-09-15"
    for bad in ("0_months", "61_months", "weekly"):
        response = client.patch(f"/api/v1/organisations/{org['id']}", headers=platform_admin, json={"billing_cycle": bad})
        assert response.status_code == 422, bad
