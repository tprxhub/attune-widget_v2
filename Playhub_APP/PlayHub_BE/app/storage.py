"""Object storage adapters shared by local development and production S3."""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path, PurePosixPath
from tempfile import SpooledTemporaryFile
from typing import BinaryIO, Protocol
from urllib.parse import quote, unquote, urlparse
from uuid import uuid4

from fastapi import UploadFile

from app.config import Settings, get_settings


CACHE_CONTROL = "public, max-age=31536000, immutable"


class UploadRejected(ValueError):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


class StorageUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class MediaPolicy:
    extensions: dict[str, str]
    max_bytes: int | None = None


POLICIES = {
    "thumbnails": MediaPolicy(
        extensions={".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    ),
    "avatars": MediaPolicy(
        extensions={".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"},
        max_bytes=5 * 1024 * 1024,
    ),
    "homepage": MediaPolicy(
        extensions={".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"},
        max_bytes=10 * 1024 * 1024,
    ),
    "videos": MediaPolicy(
        extensions={".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime"}
    ),
}


class ObjectStorage(Protocol):
    def put(self, key: str, source: BinaryIO, content_type: str) -> None: ...
    def delete(self, key: str) -> None: ...
    def public_url(self, key: str) -> str: ...
    def key_from_url(self, url: str) -> str | None: ...
    def check_health(self) -> None: ...


def _normalise_key(key: str) -> str:
    path = PurePosixPath(unquote(key).lstrip("/"))
    if not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise StorageUnavailable("Invalid object key")
    return str(path)


class LocalObjectStorage:
    def __init__(self, root: str | Path, url_prefix: str = "/uploads"):
        self.root = Path(root).resolve()
        self.url_prefix = "/" + url_prefix.strip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        destination = (self.root / _normalise_key(key)).resolve()
        if destination != self.root and self.root not in destination.parents:
            raise StorageUnavailable("Object key escapes the storage root")
        return destination

    def put(self, key: str, source: BinaryIO, content_type: str) -> None:
        del content_type  # StaticFiles derives the same validated MIME type from the extension.
        destination = self._path(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid4().hex}.part")
        try:
            source.seek(0)
            with temporary.open("wb") as target:
                shutil.copyfileobj(source, target, length=1024 * 1024)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary, destination)
        except OSError as exc:
            temporary.unlink(missing_ok=True)
            raise StorageUnavailable("Local object storage write failed") from exc

    def delete(self, key: str) -> None:
        try:
            self._path(key).unlink(missing_ok=True)
        except OSError as exc:
            raise StorageUnavailable("Local object storage delete failed") from exc

    def public_url(self, key: str) -> str:
        return f"{self.url_prefix}/{quote(_normalise_key(key), safe='/')}"

    def key_from_url(self, url: str) -> str | None:
        parsed = urlparse(url)
        if parsed.scheme or parsed.netloc:
            return None
        prefix = self.url_prefix + "/"
        return _normalise_key(parsed.path[len(prefix):]) if parsed.path.startswith(prefix) else None

    def check_health(self) -> None:
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            if not os.access(self.root, os.W_OK):
                raise OSError("storage root is not writable")
        except OSError as exc:
            raise StorageUnavailable("Local object storage is unavailable") from exc


class S3ObjectStorage:
    def __init__(
        self,
        bucket: str,
        region: str,
        public_base_url: str,
        *,
        endpoint_url: str | None = None,
        server_side_encryption: str = "AES256",
        kms_key_id: str | None = None,
        client=None,
    ):
        if not bucket or not region or not public_base_url:
            raise StorageUnavailable("S3 bucket, region, and public base URL are required")
        if client is None:
            try:
                import boto3
                from botocore.config import Config
            except ImportError as exc:  # pragma: no cover - guarded by production dependencies
                raise StorageUnavailable("boto3 is required when STORAGE_BACKEND=s3") from exc
            client = boto3.client(
                "s3",
                region_name=region,
                endpoint_url=endpoint_url,
                config=Config(
                    connect_timeout=5,
                    read_timeout=60,
                    retries={"max_attempts": 3, "mode": "standard"},
                    # S3-compatible local services do not provide wildcard bucket DNS.
                    s3={"addressing_style": "path" if endpoint_url else "auto"},
                ),
            )
        self.client = client
        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/")
        self.server_side_encryption = server_side_encryption
        self.kms_key_id = kms_key_id

    def put(self, key: str, source: BinaryIO, content_type: str) -> None:
        extra = {
            "ContentType": content_type,
            "CacheControl": CACHE_CONTROL,
            "ContentDisposition": "inline",
            "ServerSideEncryption": self.server_side_encryption,
        }
        if self.server_side_encryption == "aws:kms" and self.kms_key_id:
            extra["SSEKMSKeyId"] = self.kms_key_id
        try:
            source.seek(0)
            self.client.upload_fileobj(source, self.bucket, _normalise_key(key), ExtraArgs=extra)
        except Exception as exc:
            raise StorageUnavailable("S3 object upload failed") from exc

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=_normalise_key(key))
        except Exception as exc:
            raise StorageUnavailable("S3 object delete failed") from exc

    def public_url(self, key: str) -> str:
        return f"{self.public_base_url}/{quote(_normalise_key(key), safe='/')}"

    def key_from_url(self, url: str) -> str | None:
        base = urlparse(self.public_base_url)
        parsed = urlparse(url)
        base_path = base.path.rstrip("/") + "/"
        if parsed.scheme != base.scheme or parsed.netloc != base.netloc or not parsed.path.startswith(base_path):
            return None
        return _normalise_key(parsed.path[len(base_path):])

    def check_health(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception as exc:
            raise StorageUnavailable("S3 object storage is unavailable") from exc


def _signature_matches(content_type: str, header: bytes) -> bool:
    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    if content_type == "image/webp":
        return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    if content_type == "video/webm":
        return header.startswith(b"\x1a\x45\xdf\xa3")
    if content_type in {"video/mp4", "video/quicktime"}:
        return len(header) >= 12 and header[4:8] == b"ftyp"
    return False


class StorageService:
    def __init__(
        self,
        backend: ObjectStorage,
        max_bytes: int,
        key_prefix: str = "media",
        legacy_backends: tuple[ObjectStorage, ...] = (),
    ):
        self.backend = backend
        self.url_backends = (backend, *legacy_backends)
        self.max_bytes = max_bytes
        self.key_prefix = key_prefix.strip("/")

    def upload(self, upload: UploadFile, category: str) -> str:
        if not upload.filename:
            raise UploadRejected("A file is required")
        policy = POLICIES.get(category)
        if policy is None:
            raise UploadRejected("Unsupported upload category")
        suffix = Path(upload.filename).suffix.lower()
        expected_type = policy.extensions.get(suffix)
        if not expected_type:
            raise UploadRejected("Unsupported file type", 415)
        declared_type = (upload.content_type or "").split(";", 1)[0].strip().lower()
        if declared_type != expected_type:
            raise UploadRejected(f"File extension and content type do not match; expected {expected_type}", 415)

        staged = SpooledTemporaryFile(max_size=min(self.max_bytes, 8 * 1024 * 1024), mode="w+b")
        try:
            size = 0
            max_bytes = min(self.max_bytes, policy.max_bytes or self.max_bytes)
            while chunk := upload.file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise UploadRejected("File exceeds the upload limit", 413)
                staged.write(chunk)
            if size == 0:
                raise UploadRejected("Uploaded file is empty")
            staged.seek(0)
            if not _signature_matches(expected_type, staged.read(16)):
                raise UploadRejected("File contents do not match the declared media type", 415)
            staged.seek(0)
            key = "/".join(part for part in (self.key_prefix, category, f"{uuid4().hex}{suffix}") if part)
            self.backend.put(key, staged, expected_type)
            return self.backend.public_url(key)
        finally:
            staged.close()
            upload.file.close()

    def delete_url(self, url: str | None) -> bool:
        if not url:
            return False
        for backend in self.url_backends:
            key = backend.key_from_url(url)
            if key:
                backend.delete(key)
                return True
        return False

    def check_health(self) -> None:
        self.backend.check_health()


def build_storage(settings: Settings) -> StorageService:
    legacy_backends: tuple[ObjectStorage, ...] = ()
    if settings.storage_backend == "s3":
        backend: ObjectStorage = S3ObjectStorage(
            bucket=settings.s3_bucket_name or "",
            region=settings.s3_region or "",
            public_base_url=settings.storage_public_base_url or "",
            endpoint_url=settings.s3_endpoint_url,
            server_side_encryption=settings.s3_server_side_encryption,
            kms_key_id=settings.s3_kms_key_id,
        )
        if settings.environment.lower() == "development":
            # Keep pre-switch development URLs working while all new writes use S3.
            legacy_backends = (
                LocalObjectStorage(settings.storage_local_root, settings.storage_local_url_prefix),
            )
    else:
        backend = LocalObjectStorage(settings.storage_local_root, settings.storage_local_url_prefix)
    return StorageService(
        backend=backend,
        max_bytes=settings.upload_max_megabytes * 1024 * 1024,
        key_prefix=settings.storage_key_prefix,
        legacy_backends=legacy_backends,
    )


@lru_cache
def get_storage() -> StorageService:
    return build_storage(get_settings())
