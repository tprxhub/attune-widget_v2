import pytest

from tests.test_google_and_billing import _ttp_employee, register_family


@pytest.mark.parametrize("permission", ["children", "progress"])
def test_report_references_work_without_content_or_billing_access(client, platform_admin, permission):
    org = client.post("/api/v1/organisations", headers=platform_admin, json={"name": "Reference School", "seat_limit": 12}).json()
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Reference Plan", "slug": "reference-plan"}).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin, json={"title": "Reference Dose", "level": "starter"}).json()
    client.post(f"/api/v1/play-doses/{dose['id']}/activities", headers=platform_admin, json={"name": "Private steps", "sequence": 0, "instructions": ["Content should not leak"], "video_url": "https://example.com/private.mp4"})
    headers = _ttp_employee(client, platform_admin, [permission])
    response = client.get("/api/v1/admin/references", headers=headers)
    assert response.status_code == 200
    refs = response.json()
    assert refs["organisations"] == [{"id": org["id"], "name": "Reference School", "kind": "school"}]
    reference = next(row for row in refs["plans"] if row["id"] == plan["id"])
    assert reference["play_doses"] == [{"id": dose["id"], "title": "Reference Dose", "level": "starter", "is_active": True}]
    assert "Content should not leak" not in response.text
    assert "video_url" not in response.text and "seat_limit" not in response.text
    assert client.get("/api/v1/play-plans", headers=headers).status_code == 403
    assert client.get("/api/v1/invitations", headers=headers).status_code == 403


def test_reference_endpoint_rejects_unrelated_roles(client, platform_admin):
    employee = _ttp_employee(client, platform_admin, ["audit", "audit_activity"])
    family = register_family(client, "family@example.com")
    assert client.get("/api/v1/admin/references", headers=employee).status_code == 403
    assert client.get("/api/v1/admin/references", headers=family).status_code == 403
    assert client.get("/api/v1/admin/references").status_code == 401
