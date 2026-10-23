"""Delete an organisation with everything that belongs to it.

Everything is removed explicitly, child records first, so the result is the same on PostgreSQL and on
SQLite (where foreign-key cascades are off). Records that other people still use are kept and only
lose the link: Play Plans or doses a deleted staff member created, homepage edits, Play Pulse leads
and the audit log (which keeps the history of what happened).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.models import (
    Attempt,
    AttuneConversation,
    AttuneMessage,
    AuditEvent,
    Child,
    Invitation,
    Organisation,
    PasswordResetToken,
    PlayDose,
    PlayPlan,
    PlayPulseResult,
    Role,
    SiteContent,
    Subscription,
    User,
    child_moderators,
)


@dataclass
class DeletionSummary:
    organisation: str
    admins: int
    moderators: int
    members: int
    children: int
    sessions: int
    subscriptions: int
    attune_conversations: int
    invitations: int


def _scope(db: Session, org: Organisation) -> tuple[list[User], list[str]]:
    users = list(db.scalars(select(User).where(User.organisation_id == org.id)).all())
    child_ids = list(db.scalars(select(Child.id).where(Child.organisation_id == org.id)).all())
    return users, child_ids


def _count(db: Session, model, *conditions) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0


def deletion_summary(db: Session, org: Organisation) -> DeletionSummary:
    """What deleting this organisation would remove (shown before the Super Admin confirms)."""
    users, child_ids = _scope(db, org)
    user_ids = [u.id for u in users]
    return DeletionSummary(
        organisation=org.name,
        admins=sum(u.role == Role.ADMIN for u in users),
        moderators=sum(u.role == Role.MODERATOR for u in users),
        members=sum(u.role == Role.MEMBER for u in users),
        children=len(child_ids),
        sessions=_count(db, Attempt, Attempt.child_id.in_(child_ids)),
        subscriptions=_count(db, Subscription, Subscription.child_id.in_(child_ids)),
        attune_conversations=_count(
            db, AttuneConversation,
            or_(AttuneConversation.child_id.in_(child_ids), AttuneConversation.user_id.in_(user_ids)),
        ),
        invitations=_count(
            db, Invitation,
            or_(Invitation.organisation_id == org.id, Invitation.child_id.in_(child_ids),
                Invitation.invited_by_id.in_(user_ids)),
        ),
    )


def delete_organisation(db: Session, org: Organisation, actor: User) -> tuple[DeletionSummary, list[str]]:
    """Remove the organisation, its staff and members, its children and all their data.

    Returns the summary and the stored avatar URLs to discard after the commit. The caller commits.
    """
    summary = deletion_summary(db, org)
    users, child_ids = _scope(db, org)
    user_ids = [u.id for u in users]
    avatars = [u.avatar_url for u in users if u.avatar_url]

    conversations = select(AttuneConversation.id).where(
        or_(AttuneConversation.child_id.in_(child_ids), AttuneConversation.user_id.in_(user_ids))
    )
    db.execute(delete(AttuneMessage).where(AttuneMessage.conversation_id.in_(conversations)))
    db.execute(delete(AttuneConversation).where(AttuneConversation.id.in_(conversations)))
    db.execute(delete(Attempt).where(Attempt.child_id.in_(child_ids)))
    db.execute(delete(Subscription).where(Subscription.child_id.in_(child_ids)))
    db.execute(delete(Invitation).where(or_(
        Invitation.organisation_id == org.id, Invitation.child_id.in_(child_ids), Invitation.invited_by_id.in_(user_ids),
    )))
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids)))

    # Sessions these staff logged for children outside the organisation stay with that child; the
    # Super Admin who deleted the organisation becomes their recorded logger.
    db.execute(update(Attempt).where(Attempt.logged_by_id.in_(user_ids)).values(logged_by_id=actor.id))
    db.execute(update(Attempt).where(Attempt.edited_by_id.in_(user_ids)).values(edited_by_id=None))
    db.execute(delete(child_moderators).where(
        or_(child_moderators.c.user_id.in_(user_ids), child_moderators.c.child_id.in_(child_ids))
    ))
    for column in (Child.owner_id, Child.admin_id):
        db.execute(update(Child).where(column.in_(user_ids)).values({column.key: None}))
    db.execute(update(PlayPlan).where(PlayPlan.created_by_id.in_(user_ids)).values(created_by_id=None))
    db.execute(update(PlayDose).where(PlayDose.created_by_id.in_(user_ids)).values(created_by_id=None))
    db.execute(update(SiteContent).where(SiteContent.updated_by_id.in_(user_ids)).values(updated_by_id=None))
    db.execute(update(PlayPulseResult).where(PlayPulseResult.user_id.in_(user_ids)).values(user_id=None))
    db.execute(update(AuditEvent).where(AuditEvent.actor_id.in_(user_ids)).values(actor_id=None))

    db.execute(delete(Child).where(Child.id.in_(child_ids)))
    db.execute(delete(User).where(User.id.in_(user_ids)))
    org_id = org.id
    db.execute(delete(Organisation).where(Organisation.id == org_id))
    db.add(AuditEvent(actor_id=actor.id, action="organisation.deleted", resource_type="organisation",
                      resource_id=org_id, metadata_json=asdict(summary)))
    return summary, avatars
