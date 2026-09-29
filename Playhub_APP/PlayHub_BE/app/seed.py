"""Idempotent development demo data. Run with ``python -m app.seed``."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app import models  # noqa: F401
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
    PlayDose,
    PlayPlan,
    Role,
    Subscription,
    SubscriptionStatus,
    User,
)
from app.security import hash_password
from app.smart_catalog import SMART_CATALOG

DEMO_PASSWORD = "ChangeMe123!"


def organisation(db, *, name: str, kind: str, seats: int, cycle: str) -> Organisation:
    item = db.scalar(select(Organisation).where(Organisation.name == name))
    if not item:
        item = Organisation(name=name)
        db.add(item)
        db.flush()
    item.kind = kind
    item.seat_limit = seats
    item.billing_cycle = cycle
    item.is_active = True
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
    if not item:
        item = User(
            email=email,
            display_name=name,
            password_hash=hash_password(DEMO_PASSWORD),
            role=role,
            account_scope=scope,
            organisation_id=org.id if org else None,
        )
        db.add(item)
        db.flush()
    item.display_name = name
    item.role = role
    item.account_scope = scope
    item.organisation_id = org.id if org else None
    item.is_active = True
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


def seed_plans(db) -> dict[tuple[str, PlanLevel], tuple[PlayPlan, PlayDose, Activity]]:
    result: dict[tuple[str, PlanLevel], tuple[PlayPlan, PlayDose, Activity]] = {}
    for plan_order, spec in enumerate(PLAN_SPECS):
        plan = db.scalar(select(PlayPlan).where(PlayPlan.slug == spec["slug"]))
        if not plan:
            plan = PlayPlan(name=spec["name"], slug=spec["slug"])
            db.add(plan)
            db.flush()
        plan.name = spec["name"]
        plan.description = spec["description"]
        plan.short_description = spec["description"]
        plan.icon = spec["icon"]
        plan.colour = spec["colour"]
        plan.is_active = True

        for dose_order, level in enumerate((PlanLevel.ROOKIE, PlanLevel.STARTER, PlanLevel.PRO)):
            level_spec = spec["levels"][level.value]
            title = spec["goal_title"]
            summary = level_spec["goal"]
            age = "Ages 4–6"
            dose = db.scalar(
                select(PlayDose).where(PlayDose.play_plan_id == plan.id, PlayDose.level == level)
            )
            if not dose:
                dose = PlayDose(play_plan_id=plan.id, level=level, title=title)
                db.add(dose)
                db.flush()
            dose.title = title
            dose.summary = summary
            dose.age_guidance = age
            dose.safety_note = level_spec.get("safety")
            dose.sort_order = plan_order * 10 + dose_order
            dose.is_active = True

            for stale_activity in list(dose.activities):
                if stale_activity.sequence not in range(1, 7):
                    db.delete(stale_activity)

            activity_specs = [
                (day, day, ActivityKind.ACTIVITY, activity_title, True,
                 ["Follow the activity card and video.", "Keep the session playful and short."], False)
                for day, activity_title in enumerate(level_spec["kit"], start=1)
            ]
            activity_specs.append(
                (6, 6, ActivityKind.ACTIVITY, level_spec["try"], True,
                 level_spec["steps"], True)
            )
            loggable_activity = None
            for sequence, day, kind, activity_title, loggable, instructions, is_real_life_try in activity_specs:
                activity = db.scalar(
                    select(Activity).where(
                        Activity.play_dose_id == dose.id,
                        Activity.sequence == sequence,
                    )
                )
                if not activity:
                    activity = Activity(
                        play_dose_id=dose.id,
                        sequence=sequence,
                        title=activity_title,
                    )
                    db.add(activity)
                    db.flush()
                activity.day = day
                activity.kind = kind
                activity.title = activity_title
                activity.instructions = instructions
                activity.duration_minutes = 5 if not loggable else 10
                activity.is_loggable = loggable
                activity.is_real_life_try = is_real_life_try
                if sequence == 1:
                    loggable_activity = activity
            result[(spec["slug"], level)] = (plan, dose, loggable_activity)
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
    if not item:
        item = Child(name=name, account_scope=scope)
        db.add(item)
        db.flush()
    today = date.today()
    item.date_of_birth = date(today.year - age, 6, 15)
    item.colour_token = colour
    item.organisation_id = org.id if org else None
    item.owner_id = owner.id if owner else None
    item.admin_id = admin.id if admin else None
    item.moderator_id = moderator.id if moderator else None
    item.current_play_dose_id = dose.id
    item.plan_started_at = today - timedelta(days=35)
    item.notes = notes
    item.is_active = True
    return item


def subscription(
    db,
    *,
    member: Child,
    status: SubscriptionStatus,
    plan_name: str,
    months: int | None = None,
) -> None:
    item = db.scalar(select(Subscription).where(Subscription.child_id == member.id))
    if not item:
        item = Subscription(child_id=member.id)
        db.add(item)
    item.status = status
    item.plan_name = plan_name
    item.started_on = date.today() - timedelta(days=30) if status == SubscriptionStatus.ACTIVE else None
    item.ends_on = date.today() + timedelta(days=30 * months) if months else None


def attempts(
    db,
    *,
    member: Child,
    plan: PlayPlan,
    dose: PlayDose,
    activity: Activity,
    logger: User,
    scores: list[int],
    mood: int,
) -> None:
    start = date.today() - timedelta(days=len(scores) * 3)
    wins = [
        "Stayed with the activity for the full session.",
        "Asked to try one more round.",
        "Used less help than last time.",
        "Kept both hands in position.",
    ]
    for index, score in enumerate(scores):
        occurred = start + timedelta(days=index * 3)
        exists = db.scalar(
            select(Attempt).where(
                Attempt.child_id == member.id,
                Attempt.activity_id == activity.id,
                Attempt.occurred_on == occurred,
            )
        )
        item = exists or Attempt(
                child_id=member.id,
                play_plan_id=plan.id,
                play_dose_id=dose.id,
                activity_id=activity.id,
                occurred_on=occurred,
                logged_by_id=logger.id,
            )
        item.completion_score = score
        item.completion_status = (
            CompletionStatus.FINISHED
            if score >= 4
            else CompletionStatus.PARTLY
            if score == 3
            else CompletionStatus.STOPPED_EARLY
        )
        item.help_level = (
            HelpLevel.INDEPENDENT
            if score == 5
            else HelpLevel.ONE_REMINDER
            if score == 4
            else HelpLevel.FEW_REMINDERS
            if score == 3
            else HelpLevel.HANDS_ON
        )
        item.is_real_life_try = False
        item.week_number = index // 2 + 1
        item.run_number = 1
        item.mood_score = mood
        item.big_win = wins[index % len(wins)]
        item.notes = "Demo progress entry generated by app.seed."
        item.source = AttemptSource.DAILY_CHECK_IN
        if not exists:
            db.add(item)


def seed() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        sunrise = organisation(db, name="Sunrise Montessori", kind="school", seats=40, cycle="annual")
        bright = organisation(db, name="Bright Steps Therapy Clinic", kind="clinic", seats=24, cycle="monthly")

        platform_admin = user(db, email="admin@playhub.local", name="Play Hub Admin", role=Role.SUPER_ADMIN, scope=AccountScope.PLATFORM)
        user(db, email="tester@playhub.local", name="Tester Persona", role=Role.SUPER_ADMIN, scope=AccountScope.PLATFORM)
        esther = user(db, email="esther@sunrise.local", name="Esther Mwangi", role=Role.ADMIN, scope=AccountScope.ORGANISATION, org=sunrise)
        sunrise_mod = user(db, email="moderator@playhub.local", name="Priya Raman", role=Role.MODERATOR, scope=AccountScope.ORGANISATION, org=sunrise)
        hana = user(db, email="hana@sunrise.local", name="Hana Omar", role=Role.MEMBER, scope=AccountScope.ORGANISATION, org=sunrise)
        daniel = user(db, email="daniel@brightsteps.local", name="Daniel Okoro", role=Role.ADMIN, scope=AccountScope.ORGANISATION, org=bright)
        bright_mod = user(db, email="supporter@brightsteps.local", name="Alex Morgan", role=Role.MODERATOR, scope=AccountScope.ORGANISATION, org=bright)
        family_admin = user(db, email="parent@playhub.local", name="Sumaya Idris", role=Role.ADMIN, scope=AccountScope.INDIVIDUAL)
        family_mod = user(db, email="nanny@playhub.local", name="Grace Adeniyi", role=Role.MODERATOR, scope=AccountScope.INDIVIDUAL)
        free_admin = user(db, email="free.parent@playhub.local", name="Leila Haddad", role=Role.ADMIN, scope=AccountScope.INDIVIDUAL)

        catalog = seed_plans(db)
        pinch_starter = catalog[("pinch-grip-development", PlanLevel.STARTER)]
        pinch_rookie = catalog[("pinch-grip-development", PlanLevel.ROOKIE)]
        bilateral_starter = catalog[("bilateral-coordination", PlanLevel.STARTER)]
        bilateral_pro = catalog[("bilateral-coordination", PlanLevel.PRO)]
        visual_starter = catalog[("visual-motor-integration", PlanLevel.STARTER)]
        visual_pro = catalog[("visual-motor-integration", PlanLevel.PRO)]

        demo_children = [
            (child(db, name="Amira", age=5, scope=AccountScope.ORGANISATION, org=sunrise, owner=hana, admin=esther, moderator=sunrise_mod, dose=pinch_starter[1], colour="amber", notes="Loves bead and peg activities."), pinch_starter, esther, [2, 2, 3, 3, 4, 4, 5, 5], 4, SubscriptionStatus.ACTIVE, "Organisation seat", None),
            (child(db, name="Omar", age=6, scope=AccountScope.ORGANISATION, org=sunrise, admin=esther, moderator=sunrise_mod, dose=bilateral_starter[1], colour="blue", notes="Keep instructions short and visual."), bilateral_starter, sunrise_mod, [2, 3, 3, 4, 4, 4], 4, SubscriptionStatus.ACTIVE, "Organisation seat", None),
            (child(db, name="Sara", age=7, scope=AccountScope.ORGANISATION, org=sunrise, admin=esther, dose=visual_pro[1], colour="coral", notes="Enjoys copying colourful patterns."), visual_pro, esther, [4, 4, 4, 4, 4], 5, SubscriptionStatus.ACTIVE, "Organisation seat", None),
            (child(db, name="Maya", age=7, scope=AccountScope.ORGANISATION, org=bright, admin=daniel, moderator=bright_mod, dose=bilateral_pro[1], colour="blue", notes="Working on cross-body control."), bilateral_pro, daniel, [5, 4, 4, 3, 3, 2], 3, SubscriptionStatus.ACTIVE, "Organisation seat", None),
            (child(db, name="Noah", age=5, scope=AccountScope.INDIVIDUAL, owner=family_admin, admin=family_admin, moderator=family_mod, dose=visual_starter[1], colour="coral", notes="Prefers morning sessions."), visual_starter, family_admin, [2, 3, 3, 4, 5], 4, SubscriptionStatus.ACTIVE, "6m", 6),
            (child(db, name="Noor", age=4, scope=AccountScope.INDIVIDUAL, owner=free_admin, admin=free_admin, dose=pinch_rookie[1], colour="amber", notes="Free preview account."), pinch_rookie, platform_admin, [], 4, SubscriptionStatus.FREE, "Free preview", None),
        ]

        for member, catalog_item, logger, scores, mood, sub_status, sub_name, months in demo_children:
            plan, dose, loggable_activity = catalog_item
            subscription(db, member=member, status=sub_status, plan_name=sub_name, months=months)
            if scores:
                attempts(db, member=member, plan=plan, dose=dose, activity=loggable_activity, logger=logger, scores=scores, mood=mood)

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
        print("Organisation Admin: esther@sunrise.local")
        print("Organisation Moderator: moderator@playhub.local")
        print("Subscribed Family: parent@playhub.local")
        print("Free Family: free.parent@playhub.local")


if __name__ == "__main__":
    seed()
