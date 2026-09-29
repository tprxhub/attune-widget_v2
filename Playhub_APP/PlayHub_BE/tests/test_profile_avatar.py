def test_user_can_choose_upload_replace_and_remove_avatar(client):
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": "avatar@example.com",
            "display_name": "Avatar User",
            "password": "A-secure-password",
        },
    )
    assert registration.status_code == 201
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "avatar@example.com", "password": "A-secure-password"},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    sticker = client.put("/api/v1/auth/me/avatar", headers=headers, json={"sticker": "bunny"})
    assert sticker.status_code == 200
    assert sticker.json()["avatar_sticker"] == "bunny"
    assert sticker.json()["avatar_url"] is None

    invalid = client.put("/api/v1/auth/me/avatar", headers=headers, json={"sticker": "unknown"})
    assert invalid.status_code == 422

    uploaded = client.post(
        "/api/v1/auth/me/avatar",
        headers=headers,
        files={"file": ("profile.png", b"\x89PNG\r\n\x1a\nplayhub-avatar", "image/png")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["avatar_sticker"] is None
    photo_url = uploaded.json()["avatar_url"]
    assert "/uploads/media/avatars/" in photo_url
    assert client.get(photo_url).status_code == 200

    removed = client.delete("/api/v1/auth/me/avatar", headers=headers)
    assert removed.status_code == 204
    assert client.get(photo_url).status_code == 404
    profile = client.get("/api/v1/auth/me", headers=headers).json()
    assert profile["avatar_url"] is None
    assert profile["avatar_sticker"] is None


def test_avatar_upload_rejects_non_images(client):
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": "avatar-invalid@example.com",
            "display_name": "Avatar User",
            "password": "A-secure-password",
        },
    )
    assert registration.status_code == 201
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "avatar-invalid@example.com", "password": "A-secure-password"},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/auth/me/avatar",
        headers=headers,
        files={"file": ("profile.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415
