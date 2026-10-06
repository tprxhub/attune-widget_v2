"""Server-side verification for "Sign in with Apple" and "Sign in with Microsoft" ID tokens.

Both providers issue OpenID Connect ID tokens signed with keys they publish (JWKS). We check the
signature, issuer, audience and expiry ourselves, then decide whether the email can be trusted
to match an existing Play Hub account — the same rule the Google sign-in uses.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

import jwt

from app.config import Settings

Provider = Literal["apple", "microsoft"]

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
# Apple is the owner of these mailboxes, so their address is proof of ownership.
APPLE_MAIL_DOMAINS = {"icloud.com", "me.com", "mac.com"}

MICROSOFT_JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
MICROSOFT_ISSUER = re.compile(r"^https://login\.microsoftonline\.com/([0-9a-f-]{36})/v2\.0$")
# The tenant every personal Microsoft account (Outlook.com, Hotmail, Live) belongs to.
MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"
MICROSOFT_MAIL_DOMAINS = {"outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.co.uk", "hotmail.co.uk", "live.co.uk"}

PROVIDER_LABEL = {"apple": "Apple", "microsoft": "Microsoft"}


class OidcIdentityError(ValueError):
    pass


@dataclass(frozen=True)
class OidcIdentity:
    provider: Provider
    subject: str
    email: str
    name: str
    # True when the provider owns the mailbox, so the email may link to an existing account.
    authoritative_email: bool


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    # Keys are cached in-process and refreshed when a token names an unknown key id.
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def _decode(token: str, jwks_url: str, audience: str, issuer: str | None) -> dict:
    try:
        key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
        options = {"require": ["exp", "iat", "sub", "aud", "iss"]}
        return jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            options=options,
            leeway=60,
        )
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise OidcIdentityError("Sign-in token is invalid or expired") from exc


def _truthy(value: object) -> bool:
    return value is True or value == "true"


def verify_apple_credential(credential: str, settings: Settings, name: str | None = None) -> OidcIdentity:
    if not settings.apple_client_id:
        raise OidcIdentityError("Apple sign-in is not configured")
    claims = _decode(credential, APPLE_JWKS_URL, settings.apple_client_id, APPLE_ISSUER)
    subject = str(claims.get("sub") or "")
    email = str(claims.get("email") or "").strip().lower()
    if not subject or not email or not _truthy(claims.get("email_verified")):
        raise OidcIdentityError("Apple account must share a verified email")
    domain = email.rsplit("@", 1)[-1]
    return OidcIdentity(
        provider="apple",
        subject=subject,
        email=email,
        # Apple sends the person's name to the browser only once, never inside the token.
        name=(name or "").strip()[:120] or email.split("@", 1)[0],
        authoritative_email=domain in APPLE_MAIL_DOMAINS,
    )


def verify_microsoft_credential(credential: str, settings: Settings) -> OidcIdentity:
    if not settings.microsoft_client_id:
        raise OidcIdentityError("Microsoft sign-in is not configured")
    claims = _decode(credential, MICROSOFT_JWKS_URL, settings.microsoft_client_id, None)
    match = MICROSOFT_ISSUER.match(str(claims.get("iss") or ""))
    tenant = str(claims.get("tid") or "")
    if not match or match.group(1) != tenant:
        raise OidcIdentityError("Microsoft token has an invalid issuer")
    # `oid` is stable for one person across apps in a tenant; with the tenant it is unique.
    subject = f"{tenant}:{claims.get('oid') or claims.get('sub') or ''}"
    email = str(claims.get("email") or claims.get("preferred_username") or "").strip().lower()
    if subject.endswith(":") or "@" not in email:
        raise OidcIdentityError("Microsoft account must share an email address")
    domain = email.rsplit("@", 1)[-1]
    consumer = tenant == MICROSOFT_CONSUMER_TENANT
    # Work and school accounts can type any address into their profile, so only trust it when
    # Microsoft says the tenant verified the domain (optional `xms_edov` claim).
    if not consumer and not _truthy(claims.get("xms_edov")):
        raise OidcIdentityError(
            "This work or school account doesn't share a verified email. Sign up with email instead."
        )
    return OidcIdentity(
        provider="microsoft",
        subject=subject,
        email=email,
        name=str(claims.get("name") or email.split("@", 1)[0])[:120],
        authoritative_email=(consumer and domain in MICROSOFT_MAIL_DOMAINS) or (not consumer),
    )
