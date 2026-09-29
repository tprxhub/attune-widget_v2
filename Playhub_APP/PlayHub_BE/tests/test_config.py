import pytest
from pydantic import ValidationError

from app.config import Settings


PRODUCTION_SETTINGS = {
    "environment": "production",
    "database_url": "postgresql+psycopg://user:password@database/playhub",
    "jwt_secret": "a-secure-random-production-secret-value",
    "enable_test_personas": False,
    "cors_origins": "https://app.playhub.example",
    "frontend_base_url": "https://app.playhub.example",
    "storage_backend": "s3",
    "s3_bucket_name": "playhub-production-media",
    "s3_region": "ap-south-1",
    "storage_public_base_url": "https://media.playhub.example",
    "google_client_id": "client.apps.googleusercontent.com",
    "stripe_secret_key": "sk_live_test",
    "stripe_webhook_secret": "whsec_test",
}


def test_production_requires_s3_storage():
    with pytest.raises(ValidationError, match="STORAGE_BACKEND must be s3"):
        Settings(**{**PRODUCTION_SETTINGS, "storage_backend": "local"})


def test_production_s3_configuration_is_accepted():
    settings = Settings(**PRODUCTION_SETTINGS)
    assert settings.storage_backend == "s3"
    assert settings.s3_bucket_name == "playhub-production-media"


def test_development_s3_requires_complete_bucket_configuration():
    with pytest.raises(ValidationError, match="S3_BUCKET_NAME and S3_REGION"):
        Settings(storage_backend="s3")


def test_development_s3_accepts_local_http_endpoint():
    settings = Settings(
        storage_backend="s3",
        s3_bucket_name="playhub-dev-media",
        s3_region="us-east-1",
        s3_endpoint_url="http://localhost:9000",
        storage_public_base_url="http://localhost:9000/playhub-dev-media",
    )
    assert settings.storage_backend == "s3"


def test_stripe_secrets_must_be_configured_as_a_pair():
    with pytest.raises(ValidationError, match="configured together"):
        Settings(stripe_secret_key="sk_test_only")


def test_kms_encryption_requires_a_key():
    with pytest.raises(ValidationError, match="S3_KMS_KEY_ID"):
        Settings(**{**PRODUCTION_SETTINGS, "s3_server_side_encryption": "aws:kms"})
