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


def test_a_redeploy_keeps_plans_library_edits(monkeypatch):
    """The seed runs on every deploy; it must never reset content edited in the app."""
    from app.models import Activity, PlayDose

    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        plan = db.scalars(select(PlayPlan).order_by(PlayPlan.slug)).first()
        plan.name = "Edited plan name"
        plan.description = "Edited description"
        dose = db.scalars(select(PlayDose).where(PlayDose.play_plan_id == plan.id)).first()
        dose.title = "Edited dose title"
        dose.summary = "Edited summary"
        dose.safety_note = None
        first = db.scalar(select(Activity).where(Activity.play_dose_id == dose.id, Activity.sequence == 1))
        first.title = "Edited activity"
        first.instructions = ["My own step"]
        first.duration_minutes = 25
        db.add(Activity(play_dose_id=dose.id, sequence=7, day=7, title="Extra activity", instructions=["x"]))
        removed = db.scalar(select(Activity).where(Activity.play_dose_id == dose.id, Activity.sequence == 3))
        db.delete(removed)
        removed_dose = db.scalars(select(PlayDose).where(PlayDose.play_plan_id == plan.id).order_by(PlayDose.sort_order.desc())).first()
        removed_dose_level = removed_dose.level
        db.delete(removed_dose)
        db.commit()
        plan_id, dose_id = plan.id, dose.id

    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        plan = db.get(PlayPlan, plan_id)
        dose = db.get(PlayDose, dose_id)
        assert (plan.name, plan.description) == ("Edited plan name", "Edited description")
        assert (dose.title, dose.summary, dose.safety_note) == ("Edited dose title", "Edited summary", None)
        activities = {a.sequence: a for a in db.scalars(select(Activity).where(Activity.play_dose_id == dose_id))}
        assert activities[1].title == "Edited activity"
        assert activities[1].instructions == ["My own step"]
        assert activities[1].duration_minutes == 25
        assert activities[7].title == "Extra activity"
        assert 3 not in activities
        assert not db.scalar(select(PlayDose).where(PlayDose.play_plan_id == plan_id, PlayDose.level == removed_dose_level))


def test_a_redeploy_keeps_demo_member_and_account_edits(monkeypatch):
    from app.models import Child, Organisation, Role

    run_seed(monkeypatch, demo=True)
    with TestingSession() as db:
        amira = db.scalar(select(Child).where(Child.name == "Amira"))
        extra = db.scalar(select(User).where(User.email == "supporter@brightsteps.local"))
        amira.moderators = [*amira.moderators, extra]
        amira.notes = "My notes"
        esther = db.scalar(select(User).where(User.email == "esther@sunrise.local"))
        esther.display_name = "Esther M."
        esther.role = Role.MODERATOR
        org = db.scalar(select(Organisation).where(Organisation.name == "Sunrise Montessori"))
        org.seat_limit = 99
        db.commit()

    run_seed(monkeypatch, demo=True)
    with TestingSession() as db:
        amira = db.scalar(select(Child).where(Child.name == "Amira"))
        assert len(amira.moderators) == 2 and amira.notes == "My notes"
        esther = db.scalar(select(User).where(User.email == "esther@sunrise.local"))
        assert (esther.display_name, esther.role) == ("Esther M.", Role.MODERATOR)
        assert db.scalar(select(Organisation).where(Organisation.name == "Sunrise Montessori")).seat_limit == 99


def test_a_deleted_demo_dose_does_not_break_the_seed(monkeypatch):
    from app.models import PlanLevel, PlayDose

    # The app only deletes a dose no member uses, so remove it before demo members exist.
    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        plan = db.scalar(select(PlayPlan).where(PlayPlan.slug == "bilateral-coordination"))
        db.delete(db.scalar(select(PlayDose).where(PlayDose.play_plan_id == plan.id, PlayDose.level == PlanLevel.PRO)))
        db.commit()
    run_seed(monkeypatch, demo=True)
    with TestingSession() as db:
        assert db.scalar(select(func.count(User.id))) > 0


def test_a_redeploy_never_brings_back_a_deleted_plan_or_renamed_category(monkeypatch):
    """Deleting a built-in plan, or renaming its category, must survive every deploy's seed."""
    from app.models import PlayCategory

    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        plans_before = db.scalar(select(func.count(PlayPlan.id)))
        deleted = db.scalars(select(PlayPlan).order_by(PlayPlan.slug)).first()
        deleted_slug, deleted_category = deleted.slug, deleted.category_id
        db.delete(deleted)
        db.delete(db.get(PlayCategory, deleted_category))
        db.flush()
        renamed = db.scalars(select(PlayCategory).order_by(PlayCategory.name.desc())).first()
        renamed.name = "Our own category name"
        db.commit()
        categories_before = db.scalar(select(func.count(PlayCategory.id)))

    run_seed(monkeypatch, demo=False)
    with TestingSession() as db:
        assert db.scalar(select(PlayPlan).where(PlayPlan.slug == deleted_slug)) is None
        assert db.scalar(select(func.count(PlayPlan.id))) == plans_before - 1
        assert db.scalar(select(func.count(PlayCategory.id))) == categories_before
        assert db.scalar(select(PlayCategory).where(PlayCategory.name == "Our own category name"))
