"""Database entities for the Play Hub service.

Terminology deliberately follows the product: a Play Plan contains one Play
Dose per level, and each Play Dose contains ordered Activities.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"


class AccountScope(str, enum.Enum):
    PLATFORM = "platform"
    ORGANISATION = "organisation"
    INDIVIDUAL = "individual"


class PlanLevel(str, enum.Enum):
    ROOKIE = "rookie"
    STARTER = "starter"
    PRO = "pro"


class ActivityKind(str, enum.Enum):
    INTRODUCTION = "introduction"
    ACTIVITY = "activity"
    REDO = "redo"
    LEVEL_UP = "level_up"


class VideoSourceType(str, enum.Enum):
    LINK = "link"
    UPLOAD = "upload"


class SubscriptionStatus(str, enum.Enum):
    FREE = "free"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"


class AttemptSource(str, enum.Enum):
    PLAY_DOSE = "play_dose"
    DAILY_CHECK_IN = "daily_check_in"


class CompletionStatus(str, enum.Enum):
    FINISHED = "finished"
    PARTLY = "partly"
    STOPPED_EARLY = "stopped_early"


class HelpLevel(str, enum.Enum):
    HANDS_ON = "hands_on"
    FEW_REMINDERS = "few_reminders"
    ONE_REMINDER = "one_reminder"
    INDEPENDENT = "independent"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Organisation(TimestampMixin, Base):
    __tablename__ = "organisations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(40), default="school", nullable=False)
    seat_limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    billing_cycle: Mapped[Optional[str]] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    users: Mapped[list[User]] = relationship(back_populates="organisation")
    children: Mapped[list[Child]] = relationship(back_populates="organisation")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    google_subject: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1000))
    avatar_sticker: Mapped[Optional[str]] = mapped_column(String(32))
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False, default=Role.MEMBER)
    account_scope: Mapped[AccountScope] = mapped_column(Enum(AccountScope), nullable=False)
    organisation_id: Mapped[Optional[str]] = mapped_column(ForeignKey("organisations.id", ondelete="SET NULL"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organisation: Mapped[Optional[Organisation]] = relationship(back_populates="users")
    owned_children: Mapped[list[Child]] = relationship(foreign_keys="Child.owner_id", back_populates="owner")
    administered_children: Mapped[list[Child]] = relationship(foreign_keys="Child.admin_id", back_populates="admin")
    moderated_children: Mapped[list[Child]] = relationship(foreign_keys="Child.moderator_id", back_populates="moderator")
    logged_attempts: Mapped[list[Attempt]] = relationship(back_populates="logged_by")


class PlayPlan(TimestampMixin, Base):
    __tablename__ = "play_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    short_description: Mapped[Optional[str]] = mapped_column(String(300))
    icon: Mapped[Optional[str]] = mapped_column(String(64))
    colour: Mapped[Optional[str]] = mapped_column(String(24))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Free-text credit shown as "Created by"; an admin can set it to any person's full name.
    created_by_label: Mapped[Optional[str]] = mapped_column(String(120))

    creator: Mapped[Optional[User]] = relationship(foreign_keys=[created_by_id], lazy="joined")
    play_doses: Mapped[list[PlayDose]] = relationship(
        back_populates="play_plan", cascade="all, delete-orphan", order_by="PlayDose.sort_order"
    )

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by_label or (self.creator.display_name if self.creator else None)
    attempts: Mapped[list[Attempt]] = relationship(back_populates="play_plan")


class PlayDose(TimestampMixin, Base):
    __tablename__ = "play_doses"
    __table_args__ = (UniqueConstraint("play_plan_id", "level", name="uq_play_dose_plan_level"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    play_plan_id: Mapped[str] = mapped_column(ForeignKey("play_plans.id", ondelete="CASCADE"), index=True, nullable=False)
    level: Mapped[PlanLevel] = mapped_column(Enum(PlanLevel), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000))
    age_guidance: Mapped[Optional[str]] = mapped_column(String(80))
    # Retired: SMART/GAS content is no longer collected, shown or scored. The columns are kept so
    # content already saved is not lost; dropping them needs its own migration.
    smart_goal: Mapped[Optional[str]] = mapped_column(Text)
    real_life_try_title: Mapped[Optional[str]] = mapped_column(String(200))
    real_life_try_instructions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    real_life_try_items: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    builds_on: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    passed_if: Mapped[Optional[str]] = mapped_column(Text)
    gas_score: Mapped[Optional[int]] = mapped_column(Integer)
    safety_note: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_by_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Free-text credit shown as "Created by"; an admin can set it to any person's full name.
    created_by_label: Mapped[Optional[str]] = mapped_column(String(120))

    play_plan: Mapped[PlayPlan] = relationship(back_populates="play_doses")
    creator: Mapped[Optional[User]] = relationship(foreign_keys=[created_by_id], lazy="joined")

    @property
    def created_by_name(self) -> Optional[str]:
        return self.created_by_label or (self.creator.display_name if self.creator else None)
    activities: Mapped[list[Activity]] = relationship(
        back_populates="play_dose", cascade="all, delete-orphan", order_by="Activity.sequence"
    )
    children: Mapped[list[Child]] = relationship(back_populates="current_play_dose")
    attempts: Mapped[list[Attempt]] = relationship(back_populates="play_dose")


class Activity(TimestampMixin, Base):
    __tablename__ = "activities"
    __table_args__ = (
        UniqueConstraint("play_dose_id", "sequence", name="uq_activity_dose_sequence"),
        CheckConstraint("sequence >= 0", name="ck_activity_sequence_nonnegative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    play_dose_id: Mapped[str] = mapped_column(ForeignKey("play_doses.id", ondelete="CASCADE"), index=True, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    day: Mapped[Optional[int]] = mapped_column(Integer)
    kind: Mapped[ActivityKind] = mapped_column(Enum(ActivityKind), default=ActivityKind.ACTIVITY, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    instructions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    video_source_type: Mapped[Optional[VideoSourceType]] = mapped_column(Enum(VideoSourceType))
    video_url: Mapped[Optional[str]] = mapped_column(String(1000))
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    is_loggable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_real_life_try: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    play_dose: Mapped[PlayDose] = relationship(back_populates="activities")
    attempts: Mapped[list[Attempt]] = relationship(back_populates="activity")


class Child(TimestampMixin, Base):
    __tablename__ = "children"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    colour_token: Mapped[Optional[str]] = mapped_column(String(24))
    account_scope: Mapped[AccountScope] = mapped_column(Enum(AccountScope), nullable=False)
    organisation_id: Mapped[Optional[str]] = mapped_column(ForeignKey("organisations.id", ondelete="SET NULL"), index=True)
    owner_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    admin_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    moderator_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    current_play_dose_id: Mapped[Optional[str]] = mapped_column(ForeignKey("play_doses.id", ondelete="SET NULL"), index=True)
    plan_started_at: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organisation: Mapped[Optional[Organisation]] = relationship(back_populates="children")
    owner: Mapped[Optional[User]] = relationship(foreign_keys=[owner_id], back_populates="owned_children")
    admin: Mapped[Optional[User]] = relationship(foreign_keys=[admin_id], back_populates="administered_children")
    moderator: Mapped[Optional[User]] = relationship(foreign_keys=[moderator_id], back_populates="moderated_children")
    current_play_dose: Mapped[Optional[PlayDose]] = relationship(back_populates="children")
    attempts: Mapped[list[Attempt]] = relationship(back_populates="child", cascade="all, delete-orphan")
    subscription: Mapped[Optional[Subscription]] = relationship(back_populates="child", cascade="all, delete-orphan", uselist=False)

    @property
    def owner_email(self) -> str | None:
        return self.owner.email if self.owner else None


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (
        CheckConstraint("completion_score BETWEEN 1 AND 5", name="ck_attempt_completion_score"),
        CheckConstraint("mood_score BETWEEN 1 AND 5", name="ck_attempt_mood_score"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True, nullable=False)
    play_plan_id: Mapped[str] = mapped_column(ForeignKey("play_plans.id", ondelete="RESTRICT"), index=True, nullable=False)
    play_dose_id: Mapped[str] = mapped_column(ForeignKey("play_doses.id", ondelete="RESTRICT"), index=True, nullable=False)
    activity_id: Mapped[Optional[str]] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), index=True)
    occurred_on: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    completion_score: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_status: Mapped[CompletionStatus] = mapped_column(
        Enum(CompletionStatus), nullable=False, default=CompletionStatus.PARTLY
    )
    help_level: Mapped[HelpLevel] = mapped_column(
        Enum(HelpLevel), nullable=False, default=HelpLevel.FEW_REMINDERS
    )
    is_real_life_try: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    run_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)
    big_win: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[AttemptSource] = mapped_column(Enum(AttemptSource), default=AttemptSource.DAILY_CHECK_IN, nullable=False)
    logged_by_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    child: Mapped[Child] = relationship(back_populates="attempts")
    play_plan: Mapped[PlayPlan] = relationship(back_populates="attempts")
    play_dose: Mapped[PlayDose] = relationship(back_populates="attempts")
    activity: Mapped[Optional[Activity]] = relationship(back_populates="attempts")
    logged_by: Mapped[User] = relationship(back_populates="logged_attempts")

    @property
    def logged_by_name(self) -> str:
        return self.logged_by.display_name


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), unique=True, nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.FREE, nullable=False)
    plan_name: Mapped[Optional[str]] = mapped_column(String(100))
    started_on: Mapped[Optional[date]] = mapped_column(Date)
    ends_on: Mapped[Optional[date]] = mapped_column(Date)
    stripe_checkout_session_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    stripe_refund_id: Mapped[Optional[str]] = mapped_column(String(255))

    child: Mapped[Child] = relationship(back_populates="subscription")

    @property
    def payment_managed(self) -> bool:
        return bool(self.stripe_payment_intent_id)

    @property
    def refundable_until(self) -> date | None:
        if not self.payment_managed or not self.started_on or self.status != SubscriptionStatus.ACTIVE:
            return None
        deadline = self.started_on + timedelta(days=7)
        return deadline if date.today() <= deadline else None


class Invitation(TimestampMixin, Base):
    """An invite is deliberately separate from a user until it is accepted."""
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    account_scope: Mapped[AccountScope] = mapped_column(Enum(AccountScope), nullable=False)
    organisation_id: Mapped[Optional[str]] = mapped_column(ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[Optional[str]] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[InvitationStatus] = mapped_column(Enum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    invited_by_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AuditEvent(Base):
    """Append-only operational history; no sensitive payloads are stored."""
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    resource_type: Mapped[str] = mapped_column(String(80), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SiteContent(TimestampMixin, Base):
    """Editable marketing copy: one JSON document per public page (currently the home page)."""
    __tablename__ = "site_content"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_by_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class StripeEvent(Base):
    """Processed webhook IDs make Stripe fulfillment idempotent."""
    __tablename__ = "stripe_events"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
