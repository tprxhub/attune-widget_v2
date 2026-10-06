"""Guard the API contract so new or removed operations require an explicit test review."""

from app.main import app


EXPECTED_OPERATIONS = {
    ("GET", "/health"),
    ("GET", "/ready"),
    ("POST", "/api/v1/auth/register"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/google"),
    ("POST", "/api/v1/auth/google/register-family"),
    ("POST", "/api/v1/auth/apple"),
    ("POST", "/api/v1/auth/apple/register-family"),
    ("POST", "/api/v1/auth/microsoft"),
    ("POST", "/api/v1/auth/microsoft/register-family"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/register-family"),
    ("POST", "/api/v1/auth/change-password"),
    ("GET", "/api/v1/auth/me"),
    ("POST", "/api/v1/auth/password/forgot"),
    ("POST", "/api/v1/auth/password/reset"),
    ("POST", "/api/v1/auth/me/avatar"),
    ("PUT", "/api/v1/auth/me/avatar"),
    ("DELETE", "/api/v1/auth/me/avatar"),
    ("GET", "/api/v1/users"),
    ("PATCH", "/api/v1/users/{user_id}"),
    ("POST", "/api/v1/invitations"),
    ("GET", "/api/v1/invitations"),
    ("POST", "/api/v1/invitations/{invitation_id}/activation"),
    ("POST", "/api/v1/invitations/accept"),
    ("GET", "/api/v1/audit-events"),
    ("GET", "/api/v1/site-content/homepage"),
    ("PUT", "/api/v1/site-content/homepage"),
    ("DELETE", "/api/v1/site-content/homepage"),
    ("POST", "/api/v1/site-content/homepage/image"),
    ("GET", "/api/v1/admin/progress"),
    ("GET", "/api/v1/admin/overview"),
    ("GET", "/api/v1/organisations"),
    ("GET", "/api/v1/organisations/{organisation_id}"),
    ("POST", "/api/v1/organisations"),
    ("PATCH", "/api/v1/organisations/{organisation_id}"),
    ("GET", "/api/v1/play-plans"),
    ("POST", "/api/v1/play-plans"),
    ("PATCH", "/api/v1/play-plans/{plan_id}"),
    ("POST", "/api/v1/play-plans/{plan_id}/play-doses"),
    ("PUT", "/api/v1/play-plans/order"),
    ("PUT", "/api/v1/play-plans/{plan_id}/play-doses/order"),
    ("PATCH", "/api/v1/play-doses/{dose_id}"),
    ("DELETE", "/api/v1/play-doses/{dose_id}"),
    ("POST", "/api/v1/play-doses/{dose_id}/activities"),
    ("PATCH", "/api/v1/activities/{activity_id}"),
    ("DELETE", "/api/v1/activities/{activity_id}"),
    ("GET", "/api/v1/children"),
    ("POST", "/api/v1/children"),
    ("PATCH", "/api/v1/children/{child_id}"),
    ("PUT", "/api/v1/children/{child_id}/subscription"),
    ("POST", "/api/v1/billing/checkout"),
    ("POST", "/api/v1/billing/refund/{child_id}"),
    ("POST", "/api/v1/billing/webhook"),
    ("GET", "/api/v1/children/{child_id}/attempts"),
    ("POST", "/api/v1/children/{child_id}/attempts"),
    ("GET", "/api/v1/children/{child_id}/progress"),
    ("POST", "/api/v1/play-doses/{dose_id}/thumbnail"),
    ("POST", "/api/v1/activities/{activity_id}/video"),
    ("GET", "/api/v1/developer/personas"),
    ("POST", "/api/v1/developer/personas/{persona_id}/switch"),
}


def test_registered_api_operation_inventory_is_reviewed():
    schema_paths = app.openapi()["paths"]
    actual = {
        (method.upper(), path)
        for path, operations in schema_paths.items()
        if path in {"/health", "/ready"} or path.startswith("/api/v1")
        for method in operations
        if method.upper() not in {"HEAD", "OPTIONS", "PARAMETERS"}
    }
    assert actual == EXPECTED_OPERATIONS
