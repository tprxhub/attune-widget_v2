from datetime import datetime, timedelta, timezone

from app import mailer
from app.models import SignupEmailCode
from app.security import create_access_token, create_signup_token, decode_access_token
from app.database import get_db
from app.main import app

API = "/api/v1/auth"
EMAIL = "new.family@example.com"


def family(email=EMAIL, token=""):
    return {
        "email": email,
        "guardian_name": "New Family",
        "child_name": "Noor",
        "password": "secure-password",
        "email_token": token,
    }


def sent_code(email=EMAIL):
    message = [m for m in mailer.SENT if m.to == email][-1]
    return message.subject.rsplit(" ", 1)[-1]


def send(client, email=EMAIL):
    return client.post(f"{API}/signup/send-code", json={"email": email})


def verify(client, code, email=EMAIL):
    return client.post(f"{API}/signup/verify-code", json={"email": email, "code": code})


def test_a_code_is_emailed_and_the_right_one_lets_the_family_sign_up(client):
    mailer.SENT.clear()
    assert send(client, "New.Family@Example.com ").status_code == 202
    code = sent_code()
    assert len(code) == 6 and code.isdigit()
    assert code in [m for m in mailer.SENT if m.to == EMAIL][-1].text

    checked = verify(client, code)
    assert checked.status_code == 200
    token = checked.json()["email_token"]
    created = client.post(f"{API}/register-family", json=family(token=token))
    assert created.status_code == 201
    # A code works once.
    assert verify(client, code).status_code == 410


def test_signup_without_a_verified_email_is_refused(client):
    assert client.post(f"{API}/register-family", json=family(token="")).status_code == 403
    assert client.post(f"{API}/register-family", json=family(token="not-a-token")).status_code == 403
    # A token for a different email doesn't count.
    other = create_signup_token("someone.else@example.com")
    assert client.post(f"{API}/register-family", json=family(token=other)).status_code == 403
    # Nor does a login token.
    assert client.post(f"{API}/register-family", json=family(token=create_access_token("x"))).status_code == 403


def test_a_signup_token_never_signs_anyone_in(client):
    token = create_signup_token(EMAIL)
    assert decode_access_token(token) is None
    assert client.get(f"{API}/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_a_wrong_code_is_refused_and_too_many_tries_end_the_code(client):
    mailer.SENT.clear()
    send(client)
    code = sent_code()
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(4):
        response = verify(client, wrong)
        assert response.status_code == 422
        assert "isn't right" in response.json()["detail"]
    assert verify(client, wrong).status_code == 410
    # Even the right code no longer works; a new one is needed.
    assert verify(client, code).status_code == 410


def test_a_new_code_replaces_the_old_one(client):
    mailer.SENT.clear()
    send(client)
    first = sent_code()
    send(client)
    second = sent_code()
    if first != second:
        assert verify(client, first).status_code == 422  # checked against the new code
    assert verify(client, second).status_code == 200


def test_an_expired_code_is_refused(client):
    mailer.SENT.clear()
    send(client)
    code = sent_code()
    db = next(app.dependency_overrides[get_db]())
    row = db.query(SignupEmailCode).filter_by(email=EMAIL).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    db.close()
    assert verify(client, code).status_code == 410


def test_only_a_few_codes_an_hour(client):
    for _ in range(5):
        assert send(client).status_code == 202
    assert send(client).status_code == 429


def test_an_email_that_already_has_an_account_is_told_so(client):
    assert client.post(f"{API}/register-family", json=family(token=create_signup_token(EMAIL))).status_code == 201
    response = send(client)
    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered"


def test_codes_must_be_six_digits(client):
    send(client)
    for bad in ["12345", "1234567", "abcdef", ""]:
        assert verify(client, bad).status_code == 422


def test_a_server_without_email_shows_the_code_but_production_never_does(client, monkeypatch):
    from app import api as api_module

    monkeypatch.setattr(api_module, "delivery_configured", lambda: False)
    mailer.SENT.clear()
    response = send(client)
    assert response.json()["dev_code"] == sent_code()

    monkeypatch.setattr(api_module, "delivery_configured", lambda: True)
    assert "dev_code" not in send(client).json()

    real = api_module.get_settings()

    class Production:
        environment = "production"
        jwt_secret = real.jwt_secret
        signup_test_code = None

    monkeypatch.setattr(api_module, "delivery_configured", lambda: False)
    monkeypatch.setattr(api_module, "get_settings", lambda: Production())
    assert "dev_code" not in send(client, "other.family@example.com").json()
