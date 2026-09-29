"""SMART goals and GAS scoring have been retired; the API must not accept or return them."""


def _play_dose(client, platform_admin, **extra):
    plan = client.post(
        "/api/v1/play-plans", headers=platform_admin, json={"name": "Retired fields", "slug": "retired-fields"}
    ).json()
    response = client.post(
        f"/api/v1/play-plans/{plan['id']}/play-doses",
        headers=platform_admin,
        json={"level": "starter", "title": "A dose", "safety_note": "Supervise small parts.", **extra},
    )
    assert response.status_code == 201
    return response.json()


RETIRED = [
    "smart_goal",
    "real_life_try_title",
    "real_life_try_instructions",
    "real_life_try_items",
    "builds_on",
    "passed_if",
    "gas_score",
]


def test_a_play_dose_carries_no_smart_or_gas_fields(client, platform_admin):
    dose = _play_dose(client, platform_admin)

    assert dose["safety_note"] == "Supervise small parts."
    for field in RETIRED:
        assert field not in dose


def test_old_clients_that_still_send_the_fields_are_not_rejected_and_nothing_is_stored(client, platform_admin):
    dose = _play_dose(
        client,
        platform_admin,
        smart_goal="By day 7 the child will...",
        passed_if="Finished with one reminder",
        gas_score=1,
        builds_on=["Another dose"],
    )
    updated = client.patch(
        f"/api/v1/play-doses/{dose['id']}",
        headers=platform_admin,
        json={"title": "Renamed", "smart_goal": "New goal", "gas_score": -1},
    )

    assert updated.status_code == 200
    assert updated.json()["title"] == "Renamed"
    for field in RETIRED:
        assert field not in updated.json()
