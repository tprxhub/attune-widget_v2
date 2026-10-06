"""The platform Overview for Super Admins and TTP employees.

Everything is worked out on the server and only for the areas the person may see: a TTP employee
without "billing" never receives revenue, one without "team" never receives staff numbers, and so
on. A section the person cannot see is simply absent from the response (None), never zero.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.billing import PLAN_CATALOG
from app.models import (
    AccountScope,
    Activity,
    Attempt,
    AuditEvent,
    Child,
    CompletionStatus,
    Invitation,
    InvitationStatus,
    Organisation,
    PlanPublicationStatus,
    PlayDose,
    PlayPlan,
    Role,
    SiteContent,
    SubscriptionStatus,
    User,
)
from app.services import progress_summary

# The areas a TTP employee can be given; the Overview shows one section for each.
AREAS = ("children", "progress", "organisations", "team", "billing", "plans", "audit", "homepage")
INACTIVE_AFTER_DAYS = 14
ENDING_WITHIN_DAYS = 14
WEEKS_SHOWN = 8


class Access(BaseModel):
    children: bool
    progress: bool
    organisations: bool
    team: bool
    billing: bool
    plans: bool
    audit: bool
    homepage: bool


class ChildRef(BaseModel):
    id: str
    name: str
    organisation: str | None
    last_check_in: date | None


class ChildrenSection(BaseModel):
    total: int
    individual: int
    organisation: int
    new_30d: int
    active_14d: int
    inactive_14d: int
    never_logged: int
    without_moderator: int


class WeekBucket(BaseModel):
    week_start: date
    sessions: int


class ProgressSection(BaseModel):
    sessions_7d: int
    sessions_30d: int
    sessions_prev_30d: int
    finished_rate_30d: int | None
    weekly: list[WeekBucket]
    statuses: dict[str, int]
    needs_consult: list[ChildRef]


class OrgRef(BaseModel):
    id: str
    name: str
    used: int
    limit: int
    is_active: bool
    created_at: datetime


class OrganisationsSection(BaseModel):
    total: int
    active: int
    suspended: int
    seats_used: int
    seats_total: int
    near_capacity: list[OrgRef]
    newest: list[OrgRef]


class ModeratorLoad(BaseModel):
    name: str
    children: int


class TeamSection(BaseModel):
    admins: int
    moderators: int
    pending_invitations: int
    expired_invitations: int
    moderator_load: list[ModeratorLoad]


class BillingSection(BaseModel):
    currency: str
    active: int
    ending_14d: int
    ended_30d: int
    free_families: int
    paid_30d: float
    by_plan: dict[str, int]


class PlanUsage(BaseModel):
    name: str
    children: int


class PlansSection(BaseModel):
    plans: int
    published: int
    invisible: int
    locked: int
    doses: int
    activities: int
    activities_without_video: int
    most_followed: list[PlanUsage]


class AuditItem(BaseModel):
    action: str
    actor_name: str | None
    created_at: datetime


class AuditSection(BaseModel):
    recent: list[AuditItem]


class HomepageSection(BaseModel):
    updated_at: datetime | None
    updated_by: str | None


class Overview(BaseModel):
    generated_at: datetime
    scope: str
    access: Access
    children: ChildrenSection | None = None
    progress: ProgressSection | None = None
    organisations: OrganisationsSection | None = None
    team: TeamSection | None = None
    billing: BillingSection | None = None
    plans: PlansSection | None = None
    audit: AuditSection | None = None
    homepage: HomepageSection | None = None


def _in_scope(scope: str, organisation_id: str | None, child_id: str | None = None) -> bool:
    """The top-bar account filter: all, b2b, individual, one organisation or one subscriber."""
    if scope == "all":
        return True
    if scope == "b2b":
        return organisation_id is not None
    if scope == "individual":
        return organisation_id is None
    if scope.startswith("subscriber:"):
        return child_id is not None and child_id == scope.split(":", 1)[1]
    return organisation_id == scope


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def build_overview(db: Session, user: User, scope: str, audit_condition) -> Overview:
    today = date.today()
    now = datetime.now(timezone.utc)
    access = Access(**{area: user.can(area) for area in AREAS})
    overview = Overview(generated_at=now, scope=scope, access=access)

    needs_children = access.children or access.progress or access.billing or access.team or access.plans
    children: list[Child] = []
    org_names: dict[str, str] = {}
    if needs_children or access.organisations:
        org_names = dict(db.execute(select(Organisation.id, Organisation.name)).all())
    if needs_children:
        children = [
            child
            for child in db.scalars(select(Child).options(selectinload(Child.subscription))).all()
            if child.is_active and _in_scope(scope, child.organisation_id, child.id)
        ]
    child_ids = {child.id for child in children}

    attempts: list[Attempt] = []
    if access.children or access.progress:
        attempts = [
            a
            for a in db.scalars(select(Attempt).order_by(Attempt.occurred_on, Attempt.created_at)).all()
            if a.child_id in child_ids
        ]
    last_logged: dict[str, date] = {}
    for attempt in attempts:
        last_logged[attempt.child_id] = max(last_logged.get(attempt.child_id, attempt.occurred_on), attempt.occurred_on)

    if access.children:
        cutoff = today - timedelta(days=INACTIVE_AFTER_DAYS)
        overview.children = ChildrenSection(
            total=len(children),
            individual=sum(c.account_scope == AccountScope.INDIVIDUAL for c in children),
            organisation=sum(c.account_scope == AccountScope.ORGANISATION for c in children),
            new_30d=sum(_as_utc(c.created_at) >= now - timedelta(days=30) for c in children),
            active_14d=sum(last_logged.get(c.id, date.min) >= cutoff for c in children),
            inactive_14d=sum(c.id in last_logged and last_logged[c.id] < cutoff for c in children),
            never_logged=sum(c.id not in last_logged for c in children),
            without_moderator=sum(c.moderator_id is None for c in children),
        )

    if access.progress:
        recent = [a for a in attempts if a.occurred_on > today - timedelta(days=30)]
        previous = [a for a in attempts if today - timedelta(days=60) < a.occurred_on <= today - timedelta(days=30)]
        this_week = today - timedelta(days=today.weekday())
        weeks = [this_week - timedelta(weeks=n) for n in reversed(range(WEEKS_SHOWN))]
        per_week = Counter(a.occurred_on - timedelta(days=a.occurred_on.weekday()) for a in attempts)
        by_child: dict[str, list[Attempt]] = {}
        for attempt in attempts:
            by_child.setdefault(attempt.child_id, []).append(attempt)
        statuses: Counter[str] = Counter()
        consult: list[ChildRef] = []
        for child in children:
            status = progress_summary(child.id, by_child.get(child.id, [])).headline_status
            statuses[status] += 1
            if status == "needs_check_in":
                consult.append(ChildRef(
                    id=child.id, name=child.name, organisation=org_names.get(child.organisation_id or ""),
                    last_check_in=last_logged.get(child.id),
                ))
        overview.progress = ProgressSection(
            sessions_7d=sum(a.occurred_on > today - timedelta(days=7) for a in attempts),
            sessions_30d=len(recent),
            sessions_prev_30d=len(previous),
            finished_rate_30d=(
                round(100 * sum(a.completion_status == CompletionStatus.FINISHED for a in recent) / len(recent))
                if recent else None
            ),
            weekly=[WeekBucket(week_start=week, sessions=per_week.get(week, 0)) for week in weeks],
            statuses=dict(statuses),
            needs_consult=sorted(consult, key=lambda ref: ref.last_check_in or date.min, reverse=True)[:5],
        )

    if access.organisations:
        orgs = [o for o in db.scalars(select(Organisation)).all() if scope in ("all", "b2b") or o.id == scope]
        used = Counter(
            org_id
            for org_id, in db.execute(
                select(Child.organisation_id).where(Child.organisation_id.is_not(None), Child.is_active.is_(True))
            ).all()
        )

        def ref(org: Organisation) -> OrgRef:
            return OrgRef(id=org.id, name=org.name, used=used.get(org.id, 0), limit=org.seat_limit,
                          is_active=org.is_active, created_at=org.created_at)

        limited = [o for o in orgs if o.is_active and o.seat_limit]
        overview.organisations = OrganisationsSection(
            total=len(orgs),
            active=sum(o.is_active for o in orgs),
            suspended=sum(not o.is_active for o in orgs),
            seats_used=sum(used.get(o.id, 0) for o in limited),
            seats_total=sum(o.seat_limit for o in limited),
            near_capacity=sorted(
                (ref(o) for o in limited if used.get(o.id, 0) >= 0.9 * o.seat_limit),
                key=lambda r: r.used / r.limit, reverse=True,
            )[:5],
            newest=[ref(o) for o in sorted(orgs, key=lambda o: _as_utc(o.created_at), reverse=True)[:3]],
        )

    if access.team:
        staff = [
            u for u in db.scalars(select(User).where(User.role.in_((Role.ADMIN, Role.MODERATOR)))).all()
            if u.is_active and u.organisation_id and _in_scope(scope, u.organisation_id)
        ]
        invitations = [
            i for i in db.scalars(select(Invitation).where(Invitation.status == InvitationStatus.PENDING)).all()
            if i.role in (Role.ADMIN, Role.MODERATOR) and i.organisation_id and _in_scope(scope, i.organisation_id)
        ]
        load = Counter(c.moderator_id for c in children if c.moderator_id and c.organisation_id)
        names = {u.id: u.display_name for u in staff}
        overview.team = TeamSection(
            admins=sum(u.role == Role.ADMIN for u in staff),
            moderators=sum(u.role == Role.MODERATOR for u in staff),
            pending_invitations=sum(_as_utc(i.expires_at) >= now for i in invitations),
            expired_invitations=sum(_as_utc(i.expires_at) < now for i in invitations),
            moderator_load=[
                ModeratorLoad(name=names[uid], children=count)
                for uid, count in load.most_common(5) if uid in names
            ],
        )

    if access.billing:
        families = [c for c in children if c.account_scope == AccountScope.INDIVIDUAL]
        active = [
            c for c in families
            if c.subscription and c.subscription.status == SubscriptionStatus.ACTIVE
            and (c.subscription.ends_on is None or c.subscription.ends_on >= today)
        ]
        paid_recently = [
            c.subscription for c in active
            if c.subscription.stripe_payment_intent_id and c.subscription.started_on
            and c.subscription.started_on > today - timedelta(days=30)
        ]
        overview.billing = BillingSection(
            currency="AED",
            active=len(active),
            ending_14d=sum(
                c.subscription.ends_on is not None and (c.subscription.ends_on - today).days <= ENDING_WITHIN_DAYS
                for c in active
            ),
            ended_30d=sum(
                bool(c.subscription and c.subscription.ends_on and today - timedelta(days=30) <= c.subscription.ends_on < today)
                for c in families
            ),
            free_families=len(families) - len(active),
            paid_30d=sum(PLAN_CATALOG.get(s.plan_name or "", {}).get("amount", 0) for s in paid_recently) / 100,
            by_plan=dict(Counter(c.subscription.plan_name or "manual" for c in active)),
        )

    if access.plans:
        plans = db.scalars(select(PlayPlan)).all()
        doses = db.scalars(select(PlayDose)).all()
        activity_rows = db.execute(select(Activity.video_url, Activity.is_loggable)).all()
        dose_plan = {d.id: d.play_plan_id for d in doses}
        plan_names = {p.id: p.name for p in plans}
        followed = Counter(
            dose_plan.get(c.current_play_dose_id) for c in children if c.current_play_dose_id in dose_plan
        )
        overview.plans = PlansSection(
            plans=len(plans),
            published=sum(p.publication_status == PlanPublicationStatus.PUBLISHED for p in plans),
            invisible=sum(p.publication_status == PlanPublicationStatus.INVISIBLE for p in plans),
            locked=sum(p.publication_status == PlanPublicationStatus.LOCKED for p in plans),
            doses=len(doses),
            activities=len(activity_rows),
            activities_without_video=sum(not video and loggable for video, loggable in activity_rows),
            most_followed=[
                PlanUsage(name=plan_names[pid], children=count)
                for pid, count in followed.most_common(3) if pid in plan_names
            ],
        )

    if access.audit:
        query = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(6)
        if audit_condition is not None:
            query = query.where(audit_condition)
        events = db.scalars(query).all()
        actors = dict(db.execute(
            select(User.id, User.display_name).where(User.id.in_({e.actor_id for e in events if e.actor_id}))
        ).all()) if events else {}
        overview.audit = AuditSection(recent=[
            AuditItem(action=e.action, actor_name=actors.get(e.actor_id), created_at=e.created_at) for e in events
        ])

    if access.homepage:
        content = db.get(SiteContent, "homepage")
        editor = db.get(User, content.updated_by_id) if content and content.updated_by_id else None
        overview.homepage = HomepageSection(
            updated_at=getattr(content, "updated_at", None) if content else None,
            updated_by=editor.display_name if editor else None,
        )

    return overview
