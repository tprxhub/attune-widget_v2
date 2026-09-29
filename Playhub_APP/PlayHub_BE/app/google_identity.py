"""Server-side verification for Google Identity Services credentials."""
from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings


class GoogleIdentityError(ValueError):
    pass


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    name: str
    authoritative_email: bool


def verify_google_credential(credential: str, settings: Settings) -> GoogleIdentity:
    if not settings.google_client_id:
        raise GoogleIdentityError("Google sign-in is not configured")
    try:
        from google.auth.transport import requests
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(
            credential,
            requests.Request(),
            settings.google_client_id,
        )
    except (ImportError, ValueError, TypeError) as exc:
        raise GoogleIdentityError("Google credential is invalid or expired") from exc

    subject = str(claims.get("sub") or "")
    email = str(claims.get("email") or "").strip().lower()
    verified = claims.get("email_verified") is True
    issuer = claims.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleIdentityError("Google credential has an invalid issuer")
    if not subject or not email or not verified:
        raise GoogleIdentityError("Google account must provide a verified email")
    authoritative = email.endswith("@gmail.com") or bool(claims.get("hd"))
    return GoogleIdentity(
        subject=subject,
        email=email,
        name=str(claims.get("name") or email.split("@", 1)[0]),
        authoritative_email=authoritative,
    )
