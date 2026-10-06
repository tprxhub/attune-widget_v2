from app.mailer import SENT


def register(client, email="reset@example.com"):
    response = client.post("/api/v1/auth/register", json={"email": email, "display_name": "Reset Parent", "password": "Original-pass-1", "role": "admin", "account_scope": "individual"})
    assert response.status_code == 201, response.text


def token_from_last_email():
    link = next(line for line in SENT[-1].text.splitlines() if "reset-password?token=" in line)
    return link.split("token=", 1)[1].strip()


def test_forgot_password_emails_a_one_time_link_that_sets_a_new_password(client):
    register(client)
    SENT.clear()
    reply = client.post("/api/v1/auth/password/forgot", json={"email": "Reset@Example.com"})
    assert reply.status_code == 202
    assert SENT and SENT[-1].to == "reset@example.com"
    token = token_from_last_email()

    assert client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": "short"}).status_code == 422
    done = client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": "Brand-new-pass-2"})
    assert done.status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": "reset@example.com", "password": "Original-pass-1"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "reset@example.com", "password": "Brand-new-pass-2"}).status_code == 200
    # The link works once.
    again = client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": "Another-pass-3"})
    assert again.status_code == 400


def test_unknown_emails_get_the_same_reply_and_no_email(client):
    SENT.clear()
    reply = client.post("/api/v1/auth/password/forgot", json={"email": "nobody@example.com"})
    assert reply.status_code == 202
    assert reply.json()["detail"].startswith("If an account uses that email")
    assert SENT == []


def test_only_the_newest_link_works_and_requests_are_throttled(client):
    register(client, "throttle@example.com")
    SENT.clear()
    client.post("/api/v1/auth/password/forgot", json={"email": "throttle@example.com"})
    first = token_from_last_email()
    client.post("/api/v1/auth/password/forgot", json={"email": "throttle@example.com"})
    second = token_from_last_email()
    assert client.post("/api/v1/auth/password/reset", json={"token": first, "new_password": "Brand-new-pass-2"}).status_code == 400
    client.post("/api/v1/auth/password/forgot", json={"email": "throttle@example.com"})
    client.post("/api/v1/auth/password/forgot", json={"email": "throttle@example.com"})
    assert len(SENT) == 3  # the fourth request in an hour sends nothing
    assert client.post("/api/v1/auth/password/reset", json={"token": second, "new_password": "Brand-new-pass-2"}).status_code == 400
