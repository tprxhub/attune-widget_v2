"""Starting content and development demo data. Run with ``python -m app.seed``.

The seed runs on every deploy against the live database, so it only ever adds what is missing:
a record that already exists is never changed or deleted. Edits made in the app (plan text,
activities, members, Moderators) must survive a deploy. Changes to existing content belong in
an Alembic migration, not here.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app import models  # noqa: F401
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import (
    AccountScope,
    Activity,
    ActivityKind,
    Attempt,
    AttemptSource,
    Child,
    CompletionStatus,
    HelpLevel,
    Invitation,
    InvitationStatus,
    Organisation,
    PlanLevel,
    PlayCategory,
    PlayDose,
    PlayPlan,
    Role,
    Subscription,
    SubscriptionStatus,
    User,
)
from app.licenses import add_cycle
from app.security import hash_password
from app.smart_catalog import SMART_CATALOG

DEMO_PASSWORD = "ChangeMe123!"


def organisation(db, *, name: str, kind: str, licenses: int, cycle: str) -> Organisation:
    item = db.scalar(select(Organisation).where(Organisation.name == name))
    if item:
        return item
    started = date.today().replace(day=1)
    # Prices are per licence per month (AED 9).
    item = Organisation(
        name=name,
        kind=kind,
        seat_limit=licenses,
        billing_cycle=cycle,
        is_active=True,
        license_price=900,
        billing_started_on=started,
        renews_on=add_cycle(started, cycle),
    )
    db.add(item)
    db.flush()
    return item


def user(
    db,
    *,
    email: str,
    name: str,
    role: Role,
    scope: AccountScope,
    org: Organisation | None = None,
) -> User:
    item = db.scalar(select(User).where(User.email == email))
    if item:
        return item
    item = User(
        email=email,
        display_name=name,
        password_hash=hash_password(DEMO_PASSWORD),
        role=role,
        account_scope=scope,
        organisation_id=org.id if org else None,
        is_active=True,
    )
    db.add(item)
    db.flush()
    return item


PLAN_SPECS = [
    {
        "name": "Pinch & Grip Development",
        "slug": "pinch-grip-development",
        "description": "Build finger strength, precision and a comfortable pencil grip.",
        "short": "Small-hand activities for controlled, confident grip.",
        "icon": "hand",
        "colour": "coral",
        "doses": {
            PlanLevel.ROOKIE: ("Pinch Foundations", "Begin with large objects and short rounds.", "Ages 3+"),
            PlanLevel.STARTER: ("Fix the Pencil Grip", "Build a stable three-finger grip through play.", "Ages 4+"),
            PlanLevel.PRO: ("Precision Grip Challenge", "Refine speed, pressure and accuracy.", "Ages 6+"),
        },
        "activity": "Peg Push Party",
    },
    {
        "name": "Bilateral Coordination",
        "slug": "bilateral-coordination",
        "description": "Help both hands work together for dressing, cutting and everyday play.",
        "short": "Two-hand activities for steadiness and coordination.",
        "icon": "hands",
        "colour": "blue",
        "doses": {
            PlanLevel.ROOKIE: ("Two Hands Together", "Introduce stabilising and working-hand roles.", "Ages 3+"),
            PlanLevel.STARTER: ("Button & Thread", "Coordinate both hands through practical play.", "Ages 5+"),
            PlanLevel.PRO: ("Cross-Body Control", "Build fluent crossing and complex hand patterns.", "Ages 7+"),
        },
        "activity": "Thread the Trail",
    },
    {
        "name": "Visual-Motor Integration",
        "slug": "visual-motor-integration",
        "description": "Connect visual attention with controlled hand movements.",
        "short": "Eye-and-hand games for tracking, copying and accuracy.",
        "icon": "eye",
        "colour": "amber",
        "doses": {
            PlanLevel.ROOKIE: ("Follow the Path", "Track simple lines and place large pieces.", "Ages 3+"),
            PlanLevel.STARTER: ("Copy the Pattern", "Match shapes, spacing and direction.", "Ages 5+"),
            PlanLevel.PRO: ("Precision Patterns", "Copy detailed sequences with controlled movement.", "Ages 7+"),
        },
        "activity": "Pattern Builder",
    },
]

# The approved catalogue supersedes the earlier three-plan demo
# catalogue while preserving the original slugs used by existing children.
PLAN_SPECS = SMART_CATALOG


def seed_plans(db) -> dict[tuple[str, PlanLevel], tuple[PlayPlan, PlayDose, Activity | None]]:
    """Add any catalogue plan that is missing, with its doses and activities.

    A plan that already exists is left exactly as it is, including doses or activities the
    Super Admin edited, added or deleted in the Plans library.
    """
    result: dict[tuple[str, PlanLevel], tuple[PlayPlan, PlayDose, Activity | None]] = {}
    for plan_order, spec in enumerate(PLAN_SPECS):
        plan = db.scalar(select(PlayPlan).where(PlayPlan.slug == spec["slug"]))
        if plan:
            for dose in db.scalars(select(PlayDose).where(PlayDose.play_plan_id == plan.id)):
                first = db.scalar(
                    select(Activity).where(Activity.play_dose_id == dose.id).order_by(Activity.sequence).limit(1)
                )
                result.setdefault((spec["slug"], dose.level), (plan, dose, first))
            continue

        category = db.scalar(select(PlayCategory).where(PlayCategory.name == spec["name"]))
        if category is None:
            category = PlayCategory(name=spec["name"], sort_order=plan_order)
            db.add(category)
            db.flush()
        plan = PlayPlan(
            category_id=category.id,
            name=spec["goal_title"],
            slug=spec["slug"],
            description=spec["description"],
            short_description=spec["description"],
            icon=spec["icon"],
            colour=spec["colour"],
            is_active=True,
        )
        db.add(plan)
        db.flush()
        for dose_order, level in enumerate((PlanLevel.ROOKIE, PlanLevel.STARTER, PlanLevel.PRO)):
            level_spec = spec["levels"][level.value]
            dose = PlayDose(
                play_plan_id=plan.id,
                level=level,
                title=spec["goal_title"],
                summary=level_spec["goal"],
                age_guidance="Ages 4–6",
                safety_note=level_spec.get("safety"),
                sort_order=plan_order * 10 + dose_order,
                is_active=True,
            )
            db.add(dose)
            db.flush()

            activity_specs = [
                (day, activity_title, ["Follow the activity card and video.", "Keep the session playful and short."], False)
                for day, activity_title in enumerate(level_spec["kit"], start=1)
            ]
            activity_specs.append((6, level_spec["try"], level_spec["steps"], True))
            first_activity = None
            for sequence, activity_title, instructions, is_real_life_try in activity_specs:
                activity = Activity(
                    play_dose_id=dose.id,
                    sequence=sequence,
                    day=sequence,
                    kind=ActivityKind.ACTIVITY,
                    title=activity_title,
                    instructions=instructions,
                    duration_minutes=10,
                    is_loggable=True,
                    is_real_life_try=is_real_life_try,
                )
                db.add(activity)
                db.flush()
                if sequence == 1:
                    first_activity = activity
            result[(spec["slug"], level)] = (plan, dose, first_activity)
    return result


def child(
    db,
    *,
    name: str,
    age: int,
    scope: AccountScope,
    dose: PlayDose,
    colour: str,
    owner: User | None = None,
    admin: User | None = None,
    moderator: User | None = None,
    org: Organisation | None = None,
    notes: str | None = None,
) -> Child:
    query = select(Child).where(Child.name == name, Child.account_scope == scope)
    query = query.where(Child.organisation_id == org.id) if org else query.where(Child.organisation_id.is_(None))
    item = db.scalar(query)
    if item:
        return item
    today = date.today()
    item = Child(
        name=name,
        account_scope=scope,
        date_of_birth=date(today.year - age, 6, 15),
        colour_token=colour,
        organisation_id=org.id if org else None,
        owner_id=owner.id if owner else None,
        admin_id=admin.id if admin else None,
        moderators=[moderator] if moderator else [],
        current_play_dose_id=dose.id,
        plan_started_at=today - timedelta(days=35),
        notes=notes,
        is_active=True,
    )
    db.add(item)
    db.flush()
    return item


def subscription(
    db,
    *,
    member: Child,
    status: SubscriptionStatus,
    plan_name: str,
    months: int | None = None,
) -> None:
    if db.scalar(select(Subscription).where(Subscription.child_id == member.id)):
        return
    item = Subscription(child_id=member.id)
    db.add(item)
    item.status = status
    item.plan_name = plan_name
    item.started_on = date.today() - timedelta(days=30) if status == SubscriptionStatus.ACTIVE else None
    item.ends_on = date.today() + timedelta(days=30 * months) if months else None


HELP_FOR_SCORE = {0: HelpLevel.INDEPENDENT, 33: HelpLevel.ONE_REMINDER, 67: HelpLevel.FEW_REMINDERS, 100: HelpLevel.HANDS_ON}
COMPLETION_FOR_SCORE = {0: 5, 33: 4, 67: 3, 100: 2}
WINS = [
    "Stayed with the activity for the full session.",
    "Asked to try one more round.",
    "Used less help than last time.",
    "Kept both hands in position.",
]

TRY_NOTE = "Real-Life Try observed. Grip loosened towards the end; offer a thicker crayon next week."

# One demo dose: (level, Day 1-5 support scores, Real-Life Try score or "skip", moods). A score is
# the help given (0 on their own ... 100 hands-on); None means the child did not finish in 15 min.
Dose = tuple[PlanLevel, list[int | None], int | None | str, list[int]]


def journey(db, *, member: Child, catalog, plan_slug: str, logger: User, doses: list[Dose]) -> None:
    """Log a realistic Play Progress history for a demo child, one dose after another."""
    if db.scalar(select(Attempt).where(Attempt.child_id == member.id)):
        return  # already seeded; never rewrite history
    sessions = sum(len(days) + (0 if try_score == "skip" else 1) for _, days, try_score, _ in doses)
    occurred = date.today() - timedelta(days=sessions)
    index = 0
    for level, days, try_score, moods in doses:
        plan, dose, _ = catalog[(plan_slug, level)]
        activities = {
            activity.sequence: activity
            for activity in db.scalars(select(Activity).where(Activity.play_dose_id == dose.id))
        }
        steps = [(activities[day], score) for day, score in enumerate(days, start=1) if day in activities]
        if try_score != "skip" and 6 in activities:
            steps.append((activities[6], try_score))
        for position, (activity, score) in enumerate(steps):
            finished = score is not None
            db.add(
                Attempt(
                    child_id=member.id,
                    play_plan_id=plan.id,
                    play_dose_id=dose.id,
                    activity_id=activity.id,
                    occurred_on=occurred,
                    logged_by_id=logger.id,
                    completion_score=COMPLETION_FOR_SCORE[score] if finished else 1,
                    completion_status=CompletionStatus.FINISHED if finished else CompletionStatus.STOPPED_EARLY,
                    help_level=HELP_FOR_SCORE[score] if finished else None,
                    is_real_life_try=activity.is_real_life_try,
                    week_number=1,
                    run_number=1,
                    mood_score=moods[position % len(moods)],
                    big_win=WINS[index % len(WINS)],
                    # Consult notes are occasional clinical observations, not on every session.
                    notes=TRY_NOTE if activity.is_real_life_try else None,
                    source=AttemptSource.DAILY_CHECK_IN,
                )
            )
            occurred += timedelta(days=1)
            index += 1


def seed() -> None:
    Base.metadata.create_all(engine)
    if not get_settings().seed_demo_data:
        with SessionLocal() as db:
            seed_plans(db)
            db.commit()
        print("Play Plans content seeded; demo data is switched off (SEED_DEMO_DATA=false).")
        return
    with SessionLocal() as db:
        sunrise = organisation(db, name="Sunrise Montessori", kind="school", licenses=40, cycle="annual")
        bright = organisation(db, name="Bright Steps Therapy Clinic", kind="clinic", licenses=24, cycle="monthly")

        platform_admin = user(db, email="admin@playhub.local", name="Play Hub Admin", role=Role.SUPER_ADMIN, scope=AccountScope.PLATFORM)
        user(db, email="tester@playhub.local", name="Tester Persona", role=Role.SUPER_ADMIN, scope=AccountScope.PLATFORM)
        # A TTP employee who supports families: children, progress and subscriptions, plus the
        # everyday audit log types. Organisations, staff, content and the home page stay locked.
        support = user(db, email="ttp@playhub.local", name="Tara Support", role=Role.TTP_EMPLOYEE, scope=AccountScope.PLATFORM)
        if not support.permissions:
            support.permissions = ["children", "progress", "billing", "audit", "audit_activity", "audit_billing"]
        esther = user(db, email="esther@sunrise.local", name="Esther Mwangi", role=Role.ADMIN, scope=AccountScope.ORGANISATION, org=sunrise)
        sunrise_mod = user(db, email="moderator@playhub.local", name="Priya Raman", role=Role.MODERATOR, scope=AccountScope.ORGANISATION, org=sunrise)
        hana = user(db, email="hana@sunrise.local", name="Hana Omar", role=Role.MEMBER, scope=AccountScope.ORGANISATION, org=sunrise)
        daniel = user(db, email="daniel@brightsteps.local", name="Daniel Okoro", role=Role.ADMIN, scope=AccountScope.ORGANISATION, org=bright)
        bright_mod = user(db, email="supporter@brightsteps.local", name="Alex Morgan", role=Role.MODERATOR, scope=AccountScope.ORGANISATION, org=bright)
        family_admin = user(db, email="parent@playhub.local", name="Sumaya Idris", role=Role.ADMIN, scope=AccountScope.INDIVIDUAL)
        family_mod = user(db, email="nanny@playhub.local", name="Grace Adeniyi", role=Role.MODERATOR, scope=AccountScope.INDIVIDUAL)
        free_admin = user(db, email="free.parent@playhub.local", name="Leila Haddad", role=Role.ADMIN, scope=AccountScope.INDIVIDUAL)

        catalog = seed_plans(db)
        demo_doses = [
            ("pinch-grip-development", PlanLevel.STARTER),
            ("pinch-grip-development", PlanLevel.ROOKIE),
            ("bilateral-coordination", PlanLevel.STARTER),
            ("bilateral-coordination", PlanLevel.PRO),
            ("visual-motor-integration", PlanLevel.STARTER),
            ("visual-motor-integration", PlanLevel.PRO),
        ]
        if any(key not in catalog for key in demo_doses):
            # A dose the demo members use was removed in the Plans library; leave everything as is.
            db.commit()
            print("Demo members skipped: a Play Dose they use no longer exists.")
            return
        pinch_starter = catalog[("pinch-grip-development", PlanLevel.STARTER)]
        pinch_rookie = catalog[("pinch-grip-development", PlanLevel.ROOKIE)]
        bilateral_starter = catalog[("bilateral-coordination", PlanLevel.STARTER)]
        bilateral_pro = catalog[("bilateral-coordination", PlanLevel.PRO)]
        visual_starter = catalog[("visual-motor-integration", PlanLevel.STARTER)]
        visual_pro = catalog[("visual-motor-integration", PlanLevel.PRO)]

        demo_children = [
            (child(db, name="Amira", age=5, scope=AccountScope.ORGANISATION, org=sunrise, owner=hana, admin=esther, moderator=sunrise_mod, dose=pinch_starter[1], colour="amber", notes="Loves bead and peg activities."), pinch_starter, esther, [
                # Passed Rookie, then the first Starter dose: "Settling in".
                (PlanLevel.ROOKIE, [67, 33, 33, 0, 0], 33, [3, 4, 4, 4, 5, 4]),
                (PlanLevel.STARTER, [100, 67, 33, 67, 67], 67, [3, 3, 4, 3, 4, 4]),
                (PlanLevel.STARTER, [67, 33], "skip", [4, 4]),
            ], 4, SubscriptionStatus.ACTIVE, "Organisation license", None),
            (child(db, name="Omar", age=6, scope=AccountScope.ORGANISATION, org=sunrise, admin=esther, moderator=sunrise_mod, dose=bilateral_starter[1], colour="blue", notes="Keep instructions short and visual."), bilateral_starter, sunrise_mod, [
                # A Starter redo that needed far less help by Day 5: "Progressing".
                (PlanLevel.STARTER, [100, 67, 67, 33, 67], 67, [2, 3, 3, 4, 3, 3]),
                (PlanLevel.STARTER, [100, 33, 33, 0, 0], 0, [3, 4, 4, 4, 5, 4]),
            ], 4, SubscriptionStatus.ACTIVE, "Organisation license", None),
            (child(db, name="Sara", age=7, scope=AccountScope.ORGANISATION, org=sunrise, admin=esther, dose=visual_pro[1], colour="coral", notes="Enjoys copying colourful patterns."), visual_pro, esther, [
                # Two Pro doses without passing the Real-Life Try: "Book a Play Consult".
                (PlanLevel.PRO, [67, 67, 67, 67, 33], 67, [3, 2, 3, 3, 3, 2]),
                (PlanLevel.PRO, [67, 67, 67, 33, 67], 67, [2, 3, 2, 3, 3, 2]),
            ], 5, SubscriptionStatus.ACTIVE, "Organisation license", None),
            (child(db, name="Maya", age=7, scope=AccountScope.ORGANISATION, org=bright, admin=daniel, moderator=bright_mod, dose=bilateral_pro[1], colour="blue", notes="Working on cross-body control."), bilateral_pro, daniel, [
                # First Pro dose, passed: "First dose at this level".
                (PlanLevel.PRO, [33, 0, 33, 0, 0], 0, [4, 5, 4, 5, 5, 5]),
            ], 3, SubscriptionStatus.ACTIVE, "Organisation license", None),
            (child(db, name="Noah", age=5, scope=AccountScope.INDIVIDUAL, owner=family_admin, admin=family_admin, moderator=family_mod, dose=visual_starter[1], colour="coral", notes="Prefers morning sessions."), visual_starter, family_admin, [
                # Same support on Day 5 of the redo as on Day 1: "Holding steady".
                (PlanLevel.STARTER, [67, 67, 67, 67, 67], 67, [3, 3, 4, 3, 3, 3]),
                (PlanLevel.STARTER, [33, 0, 33, 0, 33], 0, [4, 3, 4, 4, 3, 4]),
            ], 4, SubscriptionStatus.ACTIVE, "6m", 6),
            (child(db, name="Noor", age=4, scope=AccountScope.INDIVIDUAL, owner=free_admin, admin=free_admin, dose=pinch_rookie[1], colour="amber", notes="Free preview account."), pinch_rookie, platform_admin, [], 4, SubscriptionStatus.FREE, "Free preview", None),
        ]

        for member, catalog_item, logger, doses, _mood, sub_status, sub_name, months in demo_children:
            plan, _dose, _activity = catalog_item
            subscription(db, member=member, status=sub_status, plan_name=sub_name, months=months)
            if doses:
                journey(db, member=member, catalog=catalog, plan_slug=plan.slug, logger=logger, doses=doses)

        pending = db.scalar(select(Invitation).where(Invitation.email == "pending.moderator@example.com"))
        if not pending:
            pending = Invitation(
                email="pending.moderator@example.com",
                display_name="Pending Moderator",
                role=Role.MODERATOR,
                account_scope=AccountScope.ORGANISATION,
                organisation_id=sunrise.id,
                token="demo-invite-token-please-change-001",
                status=InvitationStatus.PENDING,
                expires_at=datetime.now(timezone.utc) + timedelta(days=14),
                invited_by_id=esther.id,
            )
            db.add(pending)

        db.commit()
        print("Demo seed complete (existing records were preserved).")
        print(f"All demo passwords: {DEMO_PASSWORD}")
        print("Platform Admin: admin@playhub.local")
        print("TTP Employee (children, progress, billing, audit): ttp@playhub.local")
        print("Organisation Admin: esther@sunrise.local")
        print("Organisation Moderator: moderator@playhub.local")
        print("Subscribed Family: parent@playhub.local")
        print("Free Family: free.parent@playhub.local")


if __name__ == "__main__":
    seed()
