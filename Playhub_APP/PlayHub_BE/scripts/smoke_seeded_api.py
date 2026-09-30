#!/usr/bin/env python3
"""Read-only smoke test for a running API populated by ``python -m app.seed``."""
from __future__ import annotations

import argparse
import json
from datetime import date
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class SmokeClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.checks = 0

    def request(self, path: str, *, token: str | None = None, method: str = "GET", body=None, expected=200):
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        request = Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=10) as response:
                status = response.status
                payload = response.read()
        except HTTPError as error:
            status = error.code
            payload = error.read()
        allowed = expected if isinstance(expected, tuple) else (expected,)
        assert status in allowed, f"{method} {path}: expected {expected}, got {status}: {payload.decode()}"
        self.checks += 1
        return json.loads(payload) if payload else None

    def login(self, email: str) -> str:
        response = self.request(
            "/api/v1/auth/login",
            method="POST",
            body={"email": email, "password": "ChangeMe123!"},
        )
        return response["access_token"]


def exercise_child_reads(client: SmokeClient, token: str, children: list[dict]) -> None:
    for child in children:
        client.request(f"/api/v1/children/{child['id']}/attempts", token=token)
        client.request(f"/api/v1/children/{child['id']}/progress", token=token)


def run(base_url: str) -> None:
    client = SmokeClient(base_url)
    client.request("/health")
    client.request("/ready")

    admin = client.login("admin@playhub.local")
    client.request("/api/v1/auth/me", token=admin)
    plans = client.request("/api/v1/play-plans", token=admin)
    admin_children = client.request("/api/v1/children", token=admin)
    organisations = client.request("/api/v1/organisations", token=admin)
    client.request("/api/v1/users", token=admin)
    client.request("/api/v1/invitations", token=admin)
    client.request("/api/v1/audit-events", token=admin)
    client.request("/api/v1/admin/progress", token=admin)
    for organisation in organisations:
        client.request(f"/api/v1/organisations/{organisation['id']}", token=admin)
    exercise_child_reads(client, admin, admin_children)

    for email in (
        "esther@sunrise.local",
        "moderator@playhub.local",
        "parent@playhub.local",
        "free.parent@playhub.local",
    ):
        token = client.login(email)
        client.request("/api/v1/auth/me", token=token)
        client.request("/api/v1/play-plans", token=token)
        children = client.request("/api/v1/children", token=token)
        assert children, f"{email} should have at least one visible child"
        exercise_child_reads(client, token, children)

    org_admin = client.login("esther@sunrise.local")
    me = client.request("/api/v1/auth/me", token=org_admin)
    client.request("/api/v1/users", token=org_admin)
    client.request("/api/v1/invitations", token=org_admin)
    client.request(f"/api/v1/organisations/{me['organisation_id']}", token=org_admin)

    # Persona endpoints answer 404 when ENABLE_TEST_PERSONAS=false (staging/production).
    tester = client.login("tester@playhub.local")
    personas = client.request("/api/v1/developer/personas", token=tester, expected=(200, 404))
    if personas is None or isinstance(personas, dict):
        personas = []
    else:
        assert len(personas) >= 5

    free = client.login("free.parent@playhub.local")
    free_child = client.request("/api/v1/children", token=free)[0]
    free_dose = next(
        dose
        for plan in plans
        for dose in plan["play_doses"]
        if dose["id"] == free_child["current_play_dose_id"]
    )
    activity = next(item for item in free_dose["activities"] if item["is_loggable"])
    client.request(
        f"/api/v1/children/{free_child['id']}/attempts",
        token=free,
        method="POST",
        expected=403,
        body={
            "play_dose_id": free_dose["id"],
            "activity_id": activity["id"],
            "occurred_on": str(date.today()),
            "completion_score": 4,
            "mood_score": 4,
        },
    )

    print(
        json.dumps(
            {
                "status": "passed",
                "checks": client.checks,
                "plans": len(plans),
                "doses": sum(len(plan["play_doses"]) for plan in plans),
                "children": len(admin_children),
                "organisations": len(organisations),
                "developer_personas": len(personas),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    run(parser.parse_args().base_url)
