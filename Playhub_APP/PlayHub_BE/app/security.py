from __future__ import annotations

import hashlib
import hmac
import os
from uuid import uuid4
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return f"pbkdf2_sha256$600000${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, rounds, salt_hex, digest_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, AttributeError):
        return False


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "jti": str(uuid4()),
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> str | None:
    try:
        settings = get_settings()
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "iat", "exp", "iss", "aud", "jti"]},
        )
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
