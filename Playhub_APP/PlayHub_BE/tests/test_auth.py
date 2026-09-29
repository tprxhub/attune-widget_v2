def test_register_login_and_current_user(client):
    registered = client.post("/api/v1/auth/register", json={"email": "parent@example.com", "display_name": "A Parent", "password": "secure-password", "role": "admin", "account_scope": "individual"})
    assert registered.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "parent@example.com", "password": "secure-password"})
    assert token.status_code == 200
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token.json()['access_token']}"})
    assert me.json()["role"] == "admin"


def test_invalid_login_is_rejected(client):
    response = client.post("/api/v1/auth/login", json={"email": "none@example.com", "password": "secure-password"})
    assert response.status_code == 401


def test_family_registration_creates_authenticated_family_and_child(client):
    response = client.post("/api/v1/auth/register-family", json={
        "email": "family@example.com",
        "password": "secure-password",
        "guardian_name": "A Parent",
        "child_name": "A Child",
        "child_date_of_birth": "2021-05-10",
    })
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=headers).json()["role"] == "admin"
    children = client.get("/api/v1/children", headers=headers).json()
    assert len(children) == 1
    assert children[0]["name"] == "A Child"
    assert children[0]["subscription"]["status"] == "free"


def test_authenticated_user_can_change_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "password@example.com", "display_name": "Password User",
        "password": "old-password", "role": "member", "account_scope": "individual",
    })
    token = client.post("/api/v1/auth/login", json={
        "email": "password@example.com", "password": "old-password",
    }).json()["access_token"]
    changed = client.post("/api/v1/auth/change-password", headers={"Authorization": f"Bearer {token}"}, json={
        "current_password": "old-password", "new_password": "new-password",
    })
    assert changed.status_code == 200
    assert client.post("/api/v1/auth/login", json={
        "email": "password@example.com", "password": "new-password",
    }).status_code == 200
