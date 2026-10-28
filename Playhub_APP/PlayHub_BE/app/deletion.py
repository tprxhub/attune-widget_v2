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
    AccountScope,
    Attempt,
    AttuneConversation,
    AttuneMessage,
    AuditEvent,
    Child,
    Invitation,
    Organisation,
    OrganisationBilling,
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

    db.execute(delete(Invitation).where(Invitation.organisation_id == org.id))
    _remove_members(db, child_ids)
    # Sessions these staff logged for children outside the organisation stay with that child; the
    # Super Admin who deleted the organisation becomes their recorded logger.
    _remove_users(db, user_ids, actor)
    org_id = org.id
    db.execute(delete(OrganisationBilling).where(OrganisationBilling.organisation_id == org_id))
    db.execute(delete(Organisation).where(Organisation.id == org_id))
    db.add(AuditEvent(actor_id=actor.id, action="organisation.deleted", resource_type="organisation",
                      resource_id=org_id, metadata_json=asdict(summary)))
    return summary, avatars


# ---------- Shared steps ----------

def _remove_members(db: Session, child_ids: list[str]) -> None:
    """Delete these members with their Sessions, subscription, Attune chats and invitations."""
    if not child_ids:
        return
    conversations = select(AttuneConversation.id).where(AttuneConversation.child_id.in_(child_ids))
    db.execute(delete(AttuneMessage).where(AttuneMessage.conversation_id.in_(conversations)))
    db.execute(delete(AttuneConversation).where(AttuneConversation.id.in_(conversations)))
    db.execute(delete(Attempt).where(Attempt.child_id.in_(child_ids)))
    db.execute(delete(Subscription).where(Subscription.child_id.in_(child_ids)))
    db.execute(delete(Invitation).where(Invitation.child_id.in_(child_ids)))
    db.execute(delete(child_moderators).where(child_moderators.c.child_id.in_(child_ids)))
    db.execute(delete(Child).where(Child.id.in_(child_ids)))


def _remove_users(db: Session, user_ids: list[str], actor: User) -> None:
    """Delete these accounts. Their own Attune chats, invitations and reset links go with them;
    records other people still use only lose the link (Sessions they logged are kept and recorded
    as logged by the Super Admin who deleted them; the audit log keeps the history)."""
    if not user_ids:
        return
    emails = select(User.email).where(User.id.in_(user_ids))
    conversations = select(AttuneConversation.id).where(AttuneConversation.user_id.in_(user_ids))
    db.execute(delete(AttuneMessage).where(AttuneMessage.conversation_id.in_(conversations)))
    db.execute(delete(AttuneConversation).where(AttuneConversation.id.in_(conversations)))
    db.execute(delete(Invitation).where(or_(Invitation.invited_by_id.in_(user_ids), Invitation.email.in_(emails))))
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids)))
    db.execute(update(Attempt).where(Attempt.logged_by_id.in_(user_ids)).values(logged_by_id=actor.id))
    db.execute(update(Attempt).where(Attempt.edited_by_id.in_(user_ids)).values(edited_by_id=None))
    db.execute(delete(child_moderators).where(child_moderators.c.user_id.in_(user_ids)))
    for column in (Child.owner_id, Child.admin_id):
        db.execute(update(Child).where(column.in_(user_ids)).values({column.key: None}))
    db.execute(update(PlayPlan).where(PlayPlan.created_by_id.in_(user_ids)).values(created_by_id=None))
    db.execute(update(PlayDose).where(PlayDose.created_by_id.in_(user_ids)).values(created_by_id=None))
    db.execute(update(SiteContent).where(SiteContent.updated_by_id.in_(user_ids)).values(updated_by_id=None))
    db.execute(update(PlayPulseResult).where(PlayPulseResult.user_id.in_(user_ids)).values(user_id=None))
    db.execute(update(OrganisationBilling).where(OrganisationBilling.added_by_id.in_(user_ids)).values(added_by_id=None))
    db.execute(update(AuditEvent).where(AuditEvent.actor_id.in_(user_ids)).values(actor_id=None))
    db.execute(delete(User).where(User.id.in_(user_ids)))


# ---------- One account (Admin, Moderator or Member login) ----------

DELETABLE_ROLES = (Role.ADMIN, Role.MODERATOR, Role.MEMBER)


@dataclass
class AccountDeletionSummary:
    name: str
    email: str
    role: str
    members_unlinked: int
    moderator_assignments: int
    sessions_kept: int
    attune_conversations: int
    invitations: int
    # Family members this person is the account holder for. Delete those members (or give them
    # another Account Admin) first, so no family is left without someone who can pay.
    family_members: list[str]


def _family_members(db: Session, user: User) -> list[Child]:
    return list(db.scalars(
        select(Child).where(
            Child.account_scope == AccountScope.INDIVIDUAL,
            or_(Child.owner_id == user.id, Child.admin_id == user.id),
        ).order_by(Child.name)
    ).all())


def account_deletion_summary(db: Session, user: User) -> AccountDeletionSummary:
    return AccountDeletionSummary(
        name=user.display_name,
        email=user.email,
        role=user.role.value,
        members_unlinked=_count(db, Child, or_(Child.owner_id == user.id, Child.admin_id == user.id)),
        moderator_assignments=_count(db, child_moderators, child_moderators.c.user_id == user.id),
        sessions_kept=_count(db, Attempt, Attempt.logged_by_id == user.id),
        attune_conversations=_count(db, AttuneConversation, AttuneConversation.user_id == user.id),
        invitations=_count(db, Invitation, or_(Invitation.invited_by_id == user.id, Invitation.email == user.email)),
        family_members=[child.name for child in _family_members(db, user)],
    )


def delete_account(db: Session, user: User, actor: User) -> tuple[AccountDeletionSummary, list[str]]:
    """Remove one account. The caller checks the rules (see the API) and commits."""
    summary = account_deletion_summary(db, user)
    avatars = [user.avatar_url] if user.avatar_url else []
    user_id = user.id
    _remove_users(db, [user_id], actor)
    db.add(AuditEvent(actor_id=actor.id, action="user.deleted", resource_type="user", resource_id=user_id,
                      metadata_json={"role": summary.role, "name": summary.name}))
    return summary, avatars


# ---------- One member ----------

@dataclass
class MemberDeletionSummary:
    member: str
    sessions: int
    subscription: str | None
    attune_conversations: int
    invitations: int
    # The member's own login (a Member account no other member uses) is removed with them.
    member_login: str | None


def _own_login(db: Session, child: Child) -> User | None:
    owner = db.get(User, child.owner_id) if child.owner_id else None
    if not owner or owner.role != Role.MEMBER:
        return None
    others = _count(db, Child, Child.owner_id == owner.id, Child.id != child.id)
    return None if others else owner


def member_deletion_summary(db: Session, child: Child) -> MemberDeletionSummary:
    sub = db.scalar(select(Subscription).where(Subscription.child_id == child.id))
    login = _own_login(db, child)
    return MemberDeletionSummary(
        member=child.name,
        sessions=_count(db, Attempt, Attempt.child_id == child.id),
        subscription=sub.status.value if sub else None,
        attune_conversations=_count(db, AttuneConversation, AttuneConversation.child_id == child.id),
        invitations=_count(db, Invitation, Invitation.child_id == child.id),
        member_login=login.email if login else None,
    )


def delete_member(db: Session, child: Child, actor: User) -> tuple[MemberDeletionSummary, list[str]]:
    summary = member_deletion_summary(db, child)
    login = _own_login(db, child)
    avatars = [login.avatar_url] if login and login.avatar_url else []
    child_id = child.id
    _remove_members(db, [child_id])
    if login:
        _remove_users(db, [login.id], actor)
    db.add(AuditEvent(actor_id=actor.id, action="child.deleted", resource_type="child", resource_id=child_id,
                      metadata_json=asdict(summary)))
    return summary, avatars
