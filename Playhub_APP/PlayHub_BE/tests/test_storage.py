from io import BytesIO

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.storage import LocalObjectStorage, S3ObjectStorage, StorageService, UploadRejected


PNG = b"\x89PNG\r\n\x1a\nvalid-test-image"
MP4 = b"\x00\x00\x00\x18ftypmp42valid-test-video"


def upload(name: str, content: bytes, content_type: str) -> UploadFile:
    return UploadFile(filename=name, file=BytesIO(content), headers=Headers({"content-type": content_type}))


def test_local_storage_uses_production_style_keys_and_cleans_up(tmp_path):
    service = StorageService(LocalObjectStorage(tmp_path, "/uploads"), max_bytes=1024, key_prefix="media")
    url = service.upload(upload("card.png", PNG, "image/png"), "thumbnails")

    assert url.startswith("/uploads/media/thumbnails/")
    assert service.delete_url(url) is True
    assert list(tmp_path.rglob("*.png")) == []
    assert service.delete_url("https://external.example/image.png") is False


@pytest.mark.parametrize(
    ("name", "content", "content_type", "status_code"),
    [
        ("card.svg", b"<svg/>", "image/svg+xml", 415),
        ("card.png", b"not-a-png", "image/png", 415),
        ("card.png", PNG, "image/jpeg", 415),
        ("empty.png", b"", "image/png", 422),
    ],
)
def test_upload_validation_rejects_unsafe_or_invalid_media(tmp_path, name, content, content_type, status_code):
    service = StorageService(LocalObjectStorage(tmp_path), max_bytes=1024)
    with pytest.raises(UploadRejected) as error:
        service.upload(upload(name, content, content_type), "thumbnails")
    assert error.value.status_code == status_code


def test_upload_limit_is_enforced_before_object_is_written(tmp_path):
    service = StorageService(LocalObjectStorage(tmp_path), max_bytes=12)
    with pytest.raises(UploadRejected) as error:
        service.upload(upload("video.mp4", MP4, "video/mp4"), "videos")
    assert error.value.status_code == 413
    assert list(tmp_path.rglob("*.mp4")) == []


class FakeS3:
    def __init__(self):
        self.uploaded = None
        self.deleted = None
        self.health_bucket = None

    def upload_fileobj(self, source, bucket, key, ExtraArgs):
        self.uploaded = (source.read(), bucket, key, ExtraArgs)

    def delete_object(self, **kwargs):
        self.deleted = kwargs

    def head_bucket(self, **kwargs):
        self.health_bucket = kwargs


def test_s3_storage_sets_secure_metadata_and_round_trips_public_url():
    client = FakeS3()
    backend = S3ObjectStorage(
        "playhub-media",
        "ap-south-1",
        "https://media.playhub.example",
        server_side_encryption="AES256",
        client=client,
    )
    service = StorageService(backend, max_bytes=1024, key_prefix="media")

    url = service.upload(upload("session.mp4", MP4, "video/mp4"), "videos")

    assert url.startswith("https://media.playhub.example/media/videos/")
    body, bucket, key, metadata = client.uploaded
    assert body == MP4
    assert bucket == "playhub-media" and key.startswith("media/videos/")
    assert metadata == {
        "ContentType": "video/mp4",
        "CacheControl": "public, max-age=31536000, immutable",
        "ContentDisposition": "inline",
        "ServerSideEncryption": "AES256",
    }
    assert service.delete_url(url) is True
    assert client.deleted == {"Bucket": "playhub-media", "Key": key}
    service.check_health()
    assert client.health_bucket == {"Bucket": "playhub-media"}


def test_s3_service_can_clean_up_a_legacy_local_development_url(tmp_path):
    local = LocalObjectStorage(tmp_path, "/uploads")
    old = StorageService(local, max_bytes=1024, key_prefix="media")
    old_url = old.upload(upload("card.png", PNG, "image/png"), "thumbnails")
    client = FakeS3()
    s3 = S3ObjectStorage(
        "playhub-media",
        "ap-south-1",
        "https://media.playhub.example",
        client=client,
    )
    switched = StorageService(s3, max_bytes=1024, key_prefix="media", legacy_backends=(local,))

    assert switched.delete_url(old_url) is True
    assert list(tmp_path.rglob("*.png")) == []
    assert client.deleted is None
