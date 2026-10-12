from sqlalchemy import func, select

from conftest import TEST_ENGINE, TestingSession

from app import seed as seed_module
from app.config import get_settings
from app.models import PlayPlan, User


def run_seed(monkeypatch, demo: bool):
    monkeypatch.setattr(get_settings(), "seed_demo_data", demo)
    monkeypatch.setattr(seed_module, "SessionLocal", TestingSession)
    monkeypatch.setattr(seed_module, "engine", TEST_ENGINE)
    seed_module.seed()


def test_production_seed_keeps_content_but_creates_no_demo_logins(monkeypatch):
    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        assert db.scalar(select(func.count(PlayPlan.id))) > 0
        assert db.scalar(select(func.count(User.id))) == 0


def test_a_disabled_demo_login_stays_disabled_when_demo_data_is_off(monkeypatch):
    run_seed(monkeypatch, demo=True)
    with TestingSession() as db:
        admin = db.scalar(select(User).where(User.email == "admin@playhub.local"))
        admin.is_active = False
        db.commit()
    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        assert db.scalar(select(User).where(User.email == "admin@playhub.local")).is_active is False
