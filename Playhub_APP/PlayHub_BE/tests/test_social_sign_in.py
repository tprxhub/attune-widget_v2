import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app import oidc_identity
from app.config import get_settings

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
CONSUMER = oidc_identity.MICROSOFT_CONSUMER_TENANT
WORK = "11111111-2222-3333-4444-555555555555"


@pytest.fixture(autouse=True)
def providers(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "apple_client_id", "com.playhub.web")
    monkeypatch.setattr(settings, "microsoft_client_id", "ms-client-id")
    # Every token in these tests is signed with KEY; skip fetching the providers' real keys.
    signer = SimpleNamespace(get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=KEY.public_key()))
    monkeypatch.setattr(oidc_identity, "_jwks_client", lambda _url: signer)


def token(**claims) -> str:
    now = int(time.time())
    return jwt.encode({"iat": now, "exp": now + 600, **claims}, KEY, algorithm="RS256", headers={"kid": "k"})


def apple(email="parent@icloud.com", sub="apple-1", **extra):
    return token(iss=oidc_identity.APPLE_ISSUER, aud="com.playhub.web", sub=sub, email=email, email_verified="true", **extra)


def microsoft(email="parent@outlook.com", tenant=CONSUMER, oid="oid-1", **extra):
    return token(
        iss=f"https://login.microsoftonline.com/{tenant}/v2.0", aud="ms-client-id", sub="s", tid=tenant, oid=oid,
        email=email, name="Outlook Parent", **extra,
    )


def register(client, provider, credential, **extra):
    return client.post(
        f"/api/v1/auth/{provider}/register-family",
        json={"credential": credential, "child_name": "Kid", **extra},
    )


def test_apple_registers_a_family_then_signs_in(client):
    created = register(client, "apple", apple(), name="Apple Parent")
    assert created.status_code == 201
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {created.json()['access_token']}"}).json()
    assert me["email"] == "parent@icloud.com" and me["display_name"] == "Apple Parent"
    assert client.post("/api/v1/auth/apple", json={"credential": apple()}).status_code == 200
    assert register(client, "apple", apple()).status_code == 409


def test_microsoft_personal_account_registers_and_signs_in(client):
    assert register(client, "microsoft", microsoft()).status_code == 201
    assert client.post("/api/v1/auth/microsoft", json={"credential": microsoft()}).status_code == 200


def test_tokens_for_another_app_or_issuer_are_rejected(client):
    wrong_audience = token(iss=oidc_identity.APPLE_ISSUER, aud="someone-else", sub="x", email="a@icloud.com", email_verified=True)
    assert client.post("/api/v1/auth/apple", json={"credential": wrong_audience}).status_code == 401
    forged_tenant = microsoft(tenant=CONSUMER)
    claims = jwt.decode(forged_tenant, options={"verify_signature": False})
    mismatched = token(**{**claims, "tid": WORK})
    assert client.post("/api/v1/auth/microsoft", json={"credential": mismatched}).status_code == 401


def test_work_accounts_need_a_verified_email_domain(client):
    assert register(client, "microsoft", microsoft("me@school.example", tenant=WORK)).status_code == 401
    verified = microsoft("me@school.example", tenant=WORK, xms_edov=True)
    assert register(client, "microsoft", verified).status_code == 201


def test_existing_accounts_link_only_when_the_provider_owns_the_mailbox(client):
    for email in ("owner@icloud.com", "owner@custom.example"):
        assert client.post("/api/v1/auth/register-family", json={
            "email": email, "display_name": "Owner", "guardian_name": "Owner",
            "child_name": "Kid", "password": "secure-password",
        }).status_code == 201
    linked = client.post("/api/v1/auth/apple", json={"credential": apple("owner@icloud.com", sub="apple-owner")})
    assert linked.status_code == 200
    # Apple verified this address, but doesn't own custom.example, so no automatic linking.
    other = client.post("/api/v1/auth/apple", json={"credential": apple("owner@custom.example", sub="apple-2")})
    assert other.status_code == 409
    assert client.post("/api/v1/auth/apple", json={"credential": apple("nobody@icloud.com", sub="apple-3")}).status_code == 404
