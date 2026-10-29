"""Organisation licences.

An organisation has one licence count (`seat_limit`, 0 = no limit) and one licence type:
- "children": every active child in the organisation uses a licence.
- "moderators": every active Moderator account in the organisation uses a licence, and so does
  every Moderator invitation still waiting to be accepted, so invitations can't outrun licences.
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Child, Invitation, InvitationStatus, Organisation, Role, User, cycle_months

LicenseType = Literal["children", "moderators"]


def _children_query(org_ids: Iterable[str]):
    return (
        select(Child.organisation_id, func.count(Child.id))
        .where(Child.organisation_id.in_(list(org_ids)), Child.is_active.is_(True))
        .group_by(Child.organisation_id)
    )


def _moderator_counts(db: Session, org_ids: list[str], exclude_invitation_id: str | None = None) -> Counter:
    counts: Counter = Counter()
    accounts = db.execute(
        select(User.organisation_id, func.count(User.id))
        .where(User.organisation_id.in_(org_ids), User.role == Role.MODERATOR, User.is_active.is_(True))
        .group_by(User.organisation_id)
    ).all()
    counts.update(dict(accounts))
    # Expiry is compared here rather than in SQL: SQLite keeps these times as text without a zone.
    pending = select(Invitation.id, Invitation.organisation_id, Invitation.expires_at).where(
        Invitation.organisation_id.in_(org_ids),
        Invitation.role == Role.MODERATOR,
        Invitation.status == InvitationStatus.PENDING,
    )
    now = datetime.now(timezone.utc)
    for invitation_id, org_id, expires_at in db.execute(pending).all():
        expires = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        if invitation_id != exclude_invitation_id and expires > now:
            counts[org_id] += 1
    return counts


def usage(db: Session, orgs: Iterable[Organisation]) -> dict[str, int]:
    """Licences in use for each organisation, counted by its own licence type."""
    orgs = list(orgs)
    by_type: dict[str, list[str]] = {"children": [], "moderators": []}
    for org in orgs:
        by_type.setdefault(org.license_type or "children", []).append(org.id)
    used: dict[str, int] = {org.id: 0 for org in orgs}
    if by_type["children"]:
        used.update(dict(db.execute(_children_query(by_type["children"])).all()))
    if by_type["moderators"]:
        used.update(_moderator_counts(db, by_type["moderators"]))
    return used


def in_use(db: Session, org: Organisation, license_type: str | None = None, *,
           exclude_child_id: str | None = None, exclude_invitation_id: str | None = None) -> int:
    kind = license_type or org.license_type or "children"
    if kind == "moderators":
        return _moderator_counts(db, [org.id], exclude_invitation_id)[org.id]
    query = select(func.count(Child.id)).where(Child.organisation_id == org.id, Child.is_active.is_(True))
    if exclude_child_id:
        query = query.where(Child.id != exclude_child_id)
    return db.scalar(query) or 0


def _licences(count: int, kind: str) -> str:
    noun = "child" if kind == "children" else "Moderator"
    return f"{count} {noun} licence{'' if count == 1 else 's'}"


def ensure_available(db: Session, org: Organisation | None, kind: LicenseType, *,
                     exclude_child_id: str | None = None, exclude_invitation_id: str | None = None) -> None:
    """Refuse adding one more `kind` when the organisation licenses that kind and every licence is used."""
    if org is None or (org.license_type or "children") != kind or not org.seat_limit:
        return
    used = in_use(db, org, kind, exclude_child_id=exclude_child_id, exclude_invitation_id=exclude_invitation_id)
    if used >= org.seat_limit:
        raise HTTPException(
            status_code=409,
            detail=f"Organisation license limit has been reached: all {_licences(org.seat_limit, kind)} are in use."
                   + (" Pending invitations count until they are accepted or expire." if kind == "moderators" else ""),
        )


def ensure_admin_moderator_capacity(db: Session, actor: User | None, *,
                                   exclude_invitation_id: str | None = None) -> None:
    """Organisation Admins can add at most two active or invited Moderators per active member."""
    if actor is None or actor.role != Role.ADMIN or not actor.organisation_id:
        return
    # Serialize additions for the same organisation before counting available slots.
    org = db.scalar(select(Organisation).where(Organisation.id == actor.organisation_id).with_for_update())
    limit = 2 * in_use(db, org, "children")
    used = in_use(db, org, "moderators", exclude_invitation_id=exclude_invitation_id)
    if used >= limit:
        raise HTTPException(
            status_code=409,
            detail=f"Moderator limit reached: your organisation can have up to {limit} Moderators "
                   "(2 per active member). Active accounts and pending invitations count. "
                   "Add a member, disable a Moderator or remove a pending invitation first.",
        )


def ensure_fits(db: Session, org: Organisation, license_type: str, seat_limit: int) -> None:
    """A new licence type or count must cover what is already in use."""
    if not seat_limit:
        return
    used = in_use(db, org, license_type)
    if seat_limit < used:
        if license_type == "children":
            detail = f"{used} children are active. Choose {used} or more child licences, or deactivate children first."
        else:
            detail = (f"{used} Moderators are active or invited. Choose {used} or more Moderator licences, "
                      "or deactivate Moderators first. An invitation holds a licence until it is accepted or expires.")
        raise HTTPException(status_code=409, detail=detail)


def with_usage(db: Session, orgs: Iterable[Organisation]) -> list[Organisation]:
    """Attach `licenses_used` to each organisation for the API response."""
    orgs = list(orgs)
    used = usage(db, orgs)
    for org in orgs:
        org.licenses_used = used.get(org.id, 0)
    return orgs


def add_cycle(start: date, cycle: str | None, cycles: int = 1) -> date:
    """`start` moved on by whole billing cycles; 31 January plus a month is the last day of February."""
    months = cycle_months(cycle) * cycles
    year, month = divmod(start.month - 1 + months, 12)
    year, month = start.year + year, month + 1
    return date(year, month, min(start.day, monthrange(year, month)[1]))
