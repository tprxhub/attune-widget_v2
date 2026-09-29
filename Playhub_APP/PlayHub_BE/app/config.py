from __future__ import annotations

from functools import lru_cache
from typing import List, Literal
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Play Hub API"
    environment: str = "development"
    database_url: str = "sqlite:///./playhub.db"
    jwt_secret: str = "development-only-secret-change-before-production-32chars"
    jwt_issuer: str = "playhub-api"
    jwt_audience: str = "playhub-web"
    access_token_expire_minutes: int = 60
    frontend_base_url: str = "http://localhost:3000"
    google_client_id: str | None = None
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:8081,http://127.0.0.1:8081"
    )
    enable_test_personas: bool = True
    upload_max_megabytes: int = 100
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_root: str = "uploads"
    storage_local_url_prefix: str = "/uploads"
    storage_key_prefix: str = "media"
    storage_public_base_url: str | None = None
    s3_bucket_name: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_server_side_encryption: Literal["AES256", "aws:kms"] = "AES256"
    s3_kms_key_id: str | None = None

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.upload_max_megabytes < 1:
            raise ValueError("UPLOAD_MAX_MEGABYTES must be at least 1")
        if not self.storage_local_url_prefix.startswith("/") or self.storage_local_url_prefix == "/":
            raise ValueError("STORAGE_LOCAL_URL_PREFIX must be a non-root absolute URL path")
        if any(part in {".", ".."} for part in self.storage_key_prefix.split("/")):
            raise ValueError("STORAGE_KEY_PREFIX cannot contain relative path segments")
        if bool(self.stripe_secret_key) != bool(self.stripe_webhook_secret):
            raise ValueError("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be configured together")
        frontend_url = urlparse(self.frontend_base_url)
        if frontend_url.scheme not in {"http", "https"} or not frontend_url.netloc:
            raise ValueError("FRONTEND_BASE_URL must be an absolute HTTP(S) URL")
        if self.storage_backend == "s3":
            if not self.s3_bucket_name or not self.s3_region:
                raise ValueError("S3_BUCKET_NAME and S3_REGION are required when STORAGE_BACKEND=s3")
            public_url = urlparse(self.storage_public_base_url or "")
            if public_url.scheme not in {"http", "https"} or not public_url.netloc:
                raise ValueError(
                    "STORAGE_PUBLIC_BASE_URL must be an absolute HTTP(S) URL when STORAGE_BACKEND=s3"
                )
            if self.s3_server_side_encryption == "aws:kms" and not self.s3_kms_key_id:
                raise ValueError("S3_KMS_KEY_ID is required when S3_SERVER_SIDE_ENCRYPTION=aws:kms")
        if self.environment.lower() != "production":
            return self
        if len(self.jwt_secret.encode()) < 32 or "replace" in self.jwt_secret.lower():
            raise ValueError("Production JWT_SECRET must be a random value of at least 32 bytes")
        if self.database_url.startswith("sqlite"):
            raise ValueError("Production DATABASE_URL must use PostgreSQL")
        if self.enable_test_personas:
            raise ValueError("ENABLE_TEST_PERSONAS must be false in production")
        if "*" in self.cors_origin_list:
            raise ValueError("Production CORS_ORIGINS must list explicit trusted origins")
        if self.storage_backend != "s3":
            raise ValueError("Production STORAGE_BACKEND must be s3")
        if not self.google_client_id:
            raise ValueError("Production GOOGLE_CLIENT_ID is required")
        if not self.stripe_secret_key or not self.stripe_webhook_secret:
            raise ValueError("Production Stripe secrets are required")
        if not self.frontend_base_url.startswith("https://"):
            raise ValueError("Production FRONTEND_BASE_URL must use HTTPS")
        if not self.storage_public_base_url or not self.storage_public_base_url.startswith("https://"):
            raise ValueError("Production STORAGE_PUBLIC_BASE_URL must be an HTTPS CDN or S3 URL")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
