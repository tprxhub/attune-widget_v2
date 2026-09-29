import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "sqlite:///./test_playhub.db"
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256"
_TEST_UPLOADS = tempfile.TemporaryDirectory(prefix="playhub-test-uploads-")
os.environ["STORAGE_LOCAL_ROOT"] = _TEST_UPLOADS.name
os.environ["STORAGE_BACKEND"] = "local"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401
from app.database import Base, get_db
from app.main import app

TEST_ENGINE = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(TEST_ENGINE)
    Base.metadata.create_all(TEST_ENGINE)
    def override():
        db = TestingSession()
        try: yield db
        finally: db.close()
    app.dependency_overrides[get_db] = override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def platform_admin(client):
    response = client.post("/api/v1/auth/register", json={"email": "admin@example.com", "display_name": "Platform Admin", "password": "A-secure-password", "role": "super_admin", "account_scope": "platform"})
    assert response.status_code == 201
    token = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "A-secure-password"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
