"""Pydantic request and response contracts for the public API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.rich_text import MAX_LENGTH as MAX_RICH_TEXT, clean_rich_text
from app.models import (
    AccountScope, ActivityKind, AttemptSource, CompletionStatus, HelpLevel, PlanLevel,
    PlanPublicationStatus, Role,
    InvitationStatus, SubscriptionStatus, VideoSourceType, PERMISSION_KEYS,
)


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(APIModel):
    detail: str


class Token(APIModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class LoginRequest(APIModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=256)


class GoogleLoginRequest(APIModel):
    credential: str = Field(min_length=100, max_length=10000)


class GoogleFamilyRegistration(GoogleLoginRequest):
    child_name: str = Field(min_length=1, max_length=120)
    child_date_of_birth: date | None = None


class SocialLoginRequest(APIModel):
    """An Apple or Microsoft ID token, plus the name Apple hands the browser on first sign-in."""
    credential: str = Field(min_length=100, max_length=10000)
    name: str | None = Field(default=None, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=256)


class SocialFamilyRegistration(SocialLoginRequest):
    child_name: str = Field(min_length=1, max_length=120)
    child_date_of_birth: date | None = None


class PasswordChange(APIModel):
    current_password: str = Field(min_length=8, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class PasswordForgot(APIModel):
    email: str = Field(min_length=3, max_length=255)


class PasswordReset(APIModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=256)


class ProfileUpdate(APIModel):
    display_name: str = Field(min_length=1, max_length=120)


class AvatarStickerUpdate(APIModel):
    sticker: Literal["bunny", "bear", "fox", "owl", "elephant", "cat", "turtle", "duck"]


class FamilyRegistration(APIModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=256)
    guardian_name: str = Field(min_length=1, max_length=120)
    child_name: str = Field(min_length=1, max_length=120)
    child_date_of_birth: date | None = None

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return UserCreate.normalise_email(value)

    @field_validator("child_date_of_birth")
    @classmethod
    def child_must_be_born(cls, value: date | None) -> date | None:
        if value and value > date.today():
            raise ValueError("Child date of birth cannot be in the future")
        return value


class UserCreate(APIModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=256)
    role: Role = Role.MEMBER
    account_scope: AccountScope = AccountScope.INDIVIDUAL
    organisation_id: str | None = None

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value


class UserRead(APIModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None
    avatar_sticker: str | None
    role: Role
    account_scope: AccountScope
    organisation_id: str | None
    is_active: bool
    created_at: datetime
    permissions: list[str] = Field(default_factory=list)
    # Super Admins only: whether they receive account emails and platform alerts.
    email_notifications: bool = False


class NotificationSettings(APIModel):
    enabled: bool


def _clean_permissions(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    unknown = sorted(set(value) - set(PERMISSION_KEYS))
    if unknown:
        raise ValueError(f"Unknown permissions: {', '.join(unknown)}")
    return [key for key in PERMISSION_KEYS if key in value]


class UserUpdate(APIModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    # Sign-in email; only a Super Admin may change it.
    email: str | None = Field(default=None, min_length=3, max_length=255)
    role: Role | None = None
    is_active: bool | None = None
    permissions: list[str] | None = None

    @field_validator("permissions")
    @classmethod
    def check_permissions(cls, value):
        return _clean_permissions(value)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str | None) -> str | None:
        return None if value is None else UserCreate.normalise_email(value)


class InvitationCreate(APIModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str | None = Field(default=None, max_length=120)
    role: Role
    account_scope: AccountScope
    organisation_id: str | None = None
    child_id: str | None = None
    expires_in_days: int = Field(default=7, ge=1, le=30)
    permissions: list[str] = Field(default_factory=list)

    @field_validator("permissions")
    @classmethod
    def check_permissions(cls, value):
        return _clean_permissions(value) or []

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return UserCreate.normalise_email(value)


class ModeratorInvitationUpdate(APIModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=120)
    child_id: str | None = None

    @field_validator("display_name", mode="before")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return UserCreate.normalise_email(value)


class InvitationRead(APIModel):
    id: str
    email: str
    display_name: str | None
    role: Role
    account_scope: AccountScope
    organisation_id: str | None
    child_id: str | None
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime
    permissions: list[str] = Field(default_factory=list)


class InvitationCreated(InvitationRead):
    """Creation-only response containing the one-time activation credential."""
    acceptance_token: str | None = None


class InvitationAccept(APIModel):
    token: str = Field(min_length=20, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=256)


class AuditEventRead(APIModel):
    id: str
    actor_id: str | None
    actor_name: str | None = None
    action: str
    resource_type: str
    resource_id: str
    metadata_json: dict
    created_at: datetime


class PersonaRead(APIModel):
    id: str
    display_name: str
    role: Role
    account_scope: AccountScope
    organisation_id: str | None


# "monthly", "annual", or a custom period of 1-60 months written as "10_months".
BILLING_CYCLE_PATTERN = r"^(monthly|annual|([1-9]|[1-5][0-9]|60)_months)$"


class OrganisationCreate(APIModel):
    name: str = Field(min_length=2, max_length=160)
    kind: str = Field(default="school", min_length=2, max_length=40)
    seat_limit: int = Field(default=0, ge=0)
    license_type: Literal["children", "moderators"] = "children"
    billing_cycle: str = Field(default="annual", pattern=BILLING_CYCLE_PATTERN)
    # Price of one licence per month, in fils (AED 1 = 100 fils), whatever the billing cycle.
    license_price: int = Field(default=0, ge=0, le=10_000_000)
    billing_started_on: date | None = None
    renews_on: date | None = None


class OrganisationUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    kind: str | None = Field(default=None, min_length=2, max_length=40)
    seat_limit: int | None = Field(default=None, ge=0)
    license_type: Literal["children", "moderators"] | None = None
    billing_cycle: str | None = Field(default=None, pattern=BILLING_CYCLE_PATTERN)
    license_price: int | None = Field(default=None, ge=0, le=10_000_000)
    billing_started_on: date | None = None
    renews_on: date | None = None
    is_active: bool | None = None


class OrganisationDeletion(APIModel):
    """What deleting an organisation removes (or removed)."""
    organisation: str
    admins: int
    moderators: int
    members: int
    children: int
    sessions: int
    subscriptions: int
    attune_conversations: int
    invitations: int


class AccountDeletion(APIModel):
    """What deleting one account removes or unlinks (or did)."""
    name: str
    email: str
    role: str
    members_unlinked: int
    moderator_assignments: int
    sessions_kept: int
    attune_conversations: int
    invitations: int
    family_members: list[str]


class MemberDeletion(APIModel):
    """What deleting one member removes (or removed)."""
    member: str
    sessions: int
    subscription: str | None
    attune_conversations: int
    invitations: int
    member_login: str | None


class OrganisationRead(APIModel):
    id: str
    name: str
    kind: str
    seat_limit: int
    license_type: str = "children"
    # Licences in use, counted by license_type.
    licenses_used: int = 0
    billing_cycle: str | None
    license_price: int = 0
    billing_started_on: date | None = None
    renews_on: date | None = None
    amount_per_cycle: int = 0
    annual_value: int = 0
    renewal_status: str = "none"
    is_active: bool
    created_at: datetime


class ActivityCreate(APIModel):
    # Leave out to add the activity after the dose's last one.
    sequence: int | None = Field(default=None, ge=0)
    day: int | None = Field(default=None, ge=0, le=31)
    kind: ActivityKind = ActivityKind.ACTIVITY
    title: str = Field(min_length=1, max_length=200)
    instructions: list[str] = Field(default_factory=list)
    instructions_html: str | None = Field(default=None, max_length=MAX_RICH_TEXT)
    video_source_type: VideoSourceType | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    is_loggable: bool = True
    is_real_life_try: bool = False

    @field_validator("instructions_html")
    @classmethod
    def clean_html(cls, value: str | None) -> str | None:
        return clean_rich_text(value)

    @model_validator(mode="after")
    def validate_video(self) -> "ActivityCreate":
        if bool(self.video_source_type) != bool(self.video_url):
            raise ValueError("video_source_type and video_url must be supplied together")
        return self


class ActivityUpdate(APIModel):
    sequence: int | None = Field(default=None, ge=0)
    day: int | None = Field(default=None, ge=0, le=31)
    kind: ActivityKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    instructions: list[str] | None = None
    instructions_html: str | None = Field(default=None, max_length=MAX_RICH_TEXT)
    video_source_type: VideoSourceType | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    is_loggable: bool | None = None
    is_real_life_try: bool | None = None

    @field_validator("instructions_html")
    @classmethod
    def clean_html(cls, value: str | None) -> str | None:
        return clean_rich_text(value)


class ActivityRead(APIModel):
    id: str
    play_dose_id: str
    sequence: int
    day: int | None
    kind: ActivityKind
    title: str
    instructions: list[str]
    instructions_html: str | None = None
    video_source_type: VideoSourceType | None
    video_url: str | None
    duration_minutes: int | None
    is_loggable: bool
    is_real_life_try: bool


class PlayDoseCreate(APIModel):
    level: PlanLevel
    title: str = Field(min_length=1, max_length=160)
    summary: str | None = None
    thumbnail_url: str | None = Field(default=None, max_length=1000)
    age_guidance: str | None = Field(default=None, max_length=80)
    safety_note: str | None = None
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True
    created_by_name: str | None = Field(default=None, max_length=120)


class PlayDoseUpdate(APIModel):
    level: PlanLevel | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    summary: str | None = None
    thumbnail_url: str | None = Field(default=None, max_length=1000)
    age_guidance: str | None = Field(default=None, max_length=80)
    safety_note: str | None = None
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    created_by_name: str | None = Field(default=None, max_length=120)


class DoseContentActivity(APIModel):
    """One activity in a whole-dose save, in display order. A missing id adds a new activity."""

    id: str | None = None
    day: int | None = Field(default=None, ge=0, le=31)
    kind: ActivityKind = ActivityKind.ACTIVITY
    title: str = Field(min_length=1, max_length=200)
    instructions: list[str] = Field(default_factory=list)
    instructions_html: str | None = Field(default=None, max_length=MAX_RICH_TEXT)
    # True leaves the stored video exactly as it is (the editor didn't change it).
    keep_video: bool = False
    video_source_type: VideoSourceType | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    is_loggable: bool = True
    is_real_life_try: bool = False

    @field_validator("instructions_html")
    @classmethod
    def clean_html(cls, value: str | None) -> str | None:
        return clean_rich_text(value)

    @model_validator(mode="after")
    def validate_video(self) -> "DoseContentActivity":
        if not self.keep_video and bool(self.video_source_type) != bool(self.video_url):
            raise ValueError("video_source_type and video_url must be supplied together")
        return self


class DoseContentUpdate(APIModel):
    """Save a Play Dose and its whole activity list at once: all of it is saved, or none of it."""

    dose: PlayDoseUpdate = Field(default_factory=PlayDoseUpdate)
    activities: list[DoseContentActivity] = Field(max_length=200)


class PlayDoseRead(APIModel):
    id: str
    play_plan_id: str
    level: PlanLevel
    title: str
    summary: str | None
    thumbnail_url: str | None
    age_guidance: str | None
    safety_note: str | None
    sort_order: int
    is_active: bool
    created_by_name: str | None = None
    # Free tier: True when this dose's steps and videos were left out for the signed-in family.
    access_locked: bool = False
    # The dose a free family gets when this is their chosen plan: the first level (Rookie).
    is_free_dose: bool = False
    activities: list[ActivityRead] = Field(default_factory=list)


class PlayCategoryCreate(APIModel):
    name: str = Field(min_length=2, max_length=160)


class PlayCategoryUpdate(APIModel):
    name: str = Field(min_length=2, max_length=160)


class PlayCategoryRead(APIModel):
    id: str
    name: str
    sort_order: int
    created_by_name: str | None = None


class PlayPlanCreate(APIModel):
    category_id: str | None = None
    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    short_description: str | None = Field(default=None, max_length=300)
    icon: str | None = Field(default=None, max_length=64)
    colour: str | None = Field(default=None, max_length=24)
    is_active: bool = True
    publication_status: PlanPublicationStatus = PlanPublicationStatus.PUBLISHED
    created_by_name: str | None = Field(default=None, max_length=120)


class OrderUpdate(APIModel):
    """Every id in the list, in the order they should appear."""

    ids: list[str] = Field(min_length=1, max_length=500)


class PlayPlanUpdate(APIModel):
    category_id: str | None = None
    name: str | None = Field(default=None, min_length=2, max_length=160)
    slug: str | None = Field(default=None, min_length=2, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    short_description: str | None = Field(default=None, max_length=300)
    icon: str | None = Field(default=None, max_length=64)
    colour: str | None = Field(default=None, max_length=24)
    is_active: bool | None = None
    publication_status: PlanPublicationStatus | None = None
    created_by_name: str | None = Field(default=None, max_length=120)


class PlayPlanRead(APIModel):
    id: str
    category_id: str
    category_name: str
    category_created_by_name: str | None = None
    name: str
    slug: str
    description: str | None
    short_description: str | None
    icon: str | None
    colour: str | None
    is_active: bool
    publication_status: PlanPublicationStatus = PlanPublicationStatus.PUBLISHED
    sort_order: int = 0
    created_by_name: str | None = None
    # True when the signer-in's free plan doesn't include this Play Plan: names and summaries
    # are sent, but steps and videos are left out until they subscribe or choose it.
    access_locked: bool = False
    play_doses: list[PlayDoseRead] = Field(default_factory=list)


class DoseReferenceRead(APIModel):
    id: str
    title: str
    level: PlanLevel
    is_active: bool


class PlanReferenceRead(APIModel):
    id: str
    name: str
    is_active: bool
    publication_status: PlanPublicationStatus
    play_doses: list[DoseReferenceRead]


class OrganisationReferenceRead(APIModel):
    id: str
    name: str
    kind: str


class AdminReferencesRead(APIModel):
    plans: list[PlanReferenceRead]
    organisations: list[OrganisationReferenceRead]


class ChildCreate(APIModel):
    name: str = Field(min_length=1, max_length=120)
    date_of_birth: date | None = None
    colour_token: str | None = Field(default=None, max_length=24)
    account_scope: AccountScope
    organisation_id: str | None = None
    owner_id: str | None = None
    admin_id: str | None = None
    # One Moderator (older clients) or the full list; moderator_ids wins when both are sent.
    moderator_id: str | None = None
    moderator_ids: list[str] | None = Field(default=None, max_length=50)
    current_play_dose_id: str | None = None
    plan_started_at: date | None = None
    notes: str | None = None

    @field_validator("date_of_birth")
    @classmethod
    def child_must_be_born(cls, value: date | None) -> date | None:
        return FamilyRegistration.child_must_be_born(value)


class ChildUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    date_of_birth: date | None = None
    colour_token: str | None = Field(default=None, max_length=24)
    account_scope: AccountScope | None = None
    organisation_id: str | None = None
    owner_id: str | None = None
    admin_id: str | None = None
    moderator_id: str | None = None
    moderator_ids: list[str] | None = Field(default=None, max_length=50)
    current_play_dose_id: str | None = None
    plan_started_at: date | None = None
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("date_of_birth")
    @classmethod
    def child_must_be_born(cls, value: date | None) -> date | None:
        return FamilyRegistration.child_must_be_born(value)


class SubscriptionRead(APIModel):
    id: str
    status: SubscriptionStatus
    plan_name: str | None
    started_on: date | None
    ends_on: date | None
    payment_managed: bool = False
    refundable_until: date | None = None
    renewal_open: bool = False


class CheckoutCreate(APIModel):
    child_id: str
    plan: str = Field(pattern=r"^[1-9][0-9]?m$", max_length=3)


class CheckoutCreated(APIModel):
    checkout_url: str


class CheckoutStatus(APIModel):
    status: Literal["pending", "paid", "failed"]


class ChildRead(APIModel):
    id: str
    name: str
    date_of_birth: date | None
    colour_token: str | None
    account_scope: AccountScope
    organisation_id: str | None
    owner_id: str | None
    owner_email: str | None
    # A Member invited by email who hasn't accepted yet.
    invited_member_email: str | None = None
    admin_id: str | None
    # The first Moderator, and all of them.
    moderator_id: str | None
    moderator_ids: list[str] = Field(default_factory=list)
    current_play_dose_id: str | None
    free_play_plan_id: str | None = None
    plan_started_at: date | None
    notes: str | None
    is_active: bool
    subscription: SubscriptionRead | None = None


class FreePlayPlanChoice(APIModel):
    play_plan_id: str | None


class SubscriptionUpsert(APIModel):
    status: SubscriptionStatus
    plan_name: str | None = Field(default=None, max_length=100)
    started_on: date | None = None
    ends_on: date | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "SubscriptionUpsert":
        if self.status == SubscriptionStatus.ACTIVE and not self.started_on:
            raise ValueError("Active subscriptions require started_on")
        if self.status == SubscriptionStatus.ACTIVE and self.started_on and self.started_on > date.today():
            raise ValueError("Active subscriptions cannot start in the future")
        if self.started_on and self.ends_on and self.ends_on < self.started_on:
            raise ValueError("ends_on must be on or after started_on")
        if self.status == SubscriptionStatus.ACTIVE and self.ends_on and self.ends_on < date.today():
            raise ValueError("An already-ended subscription cannot be active")
        return self


class AttemptCreate(APIModel):
    play_dose_id: str
    activity_id: str | None = None
    occurred_on: date
    completion_status: CompletionStatus | None = None
    help_level: HelpLevel | None = None
    completion_score: int | None = Field(default=None, ge=1, le=5)
    mood_score: int = Field(ge=1, le=5)
    big_win: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=5000)
    source: AttemptSource = AttemptSource.DAILY_CHECK_IN
    run_number: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def normalise_daily_check(self) -> "AttemptCreate":
        """A session either finished (once, within 15 minutes) or it did not.

        Help is only asked, and only kept, when it finished. Older clients may still send
        "partly", which now counts as not finished.
        """
        if self.completion_status is None:
            if self.completion_score is None:
                raise ValueError("Choose whether the child finished the activity")
            self.completion_status = CompletionStatus.FINISHED if self.completion_score >= 2 else CompletionStatus.STOPPED_EARLY
        if self.completion_status != CompletionStatus.FINISHED:
            self.completion_status = CompletionStatus.STOPPED_EARLY
            self.help_level = None
            self.completion_score = 1
            return self
        if self.help_level is None:
            if self.completion_score is None:
                raise ValueError("Choose how much help was needed")
            self.help_level = (
                HelpLevel.INDEPENDENT
                if self.completion_score == 5
                else HelpLevel.ONE_REMINDER
                if self.completion_score == 4
                else HelpLevel.FEW_REMINDERS
                if self.completion_score == 3
                else HelpLevel.HANDS_ON
            )
        self.completion_score = {
            HelpLevel.INDEPENDENT: 5,
            HelpLevel.ONE_REMINDER: 4,
            HelpLevel.FEW_REMINDERS: 3,
            HelpLevel.HANDS_ON: 2,
        }[self.help_level]
        return self

    @field_validator("occurred_on")
    @classmethod
    def reject_future_attempts(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Attempts cannot be logged in the future")
        return value


class AttemptRead(APIModel):
    id: str
    child_id: str
    play_plan_id: str
    play_dose_id: str
    activity_id: str | None
    occurred_on: date
    completion_score: int
    completion_status: CompletionStatus
    help_level: HelpLevel | None
    is_real_life_try: bool
    week_number: int
    run_number: int
    mood_score: int
    big_win: str | None
    notes: str | None
    source: AttemptSource
    logged_by_id: str
    logged_by_name: str
    created_at: datetime
    edited_at: datetime | None = None
    edited_by_name: str | None = None


class ProgressPoint(APIModel):
    attempt_id: str
    occurred_on: date
    completion_score: int
    mood_score: int
    play_plan_id: str
    play_dose_id: str
    activity_id: str | None = None
    source: AttemptSource


class ProgressDay(APIModel):
    """One logged day inside a Play Dose: Day 1-5 (`day`) or the Real-Life Try (`is_try`)."""

    day: int | None = None
    is_try: bool = False
    occurred_on: date
    finished: bool
    help_level: HelpLevel | None = None
    score: int | None = None
    mood: int | None = None
    try_passed: bool | None = None


class WeeklyProgressPoint(APIModel):
    week_number: int
    week_start: date
    week_end: date
    play_plan_id: str
    play_dose_id: str
    level: PlanLevel
    support_score: float | None
    average_mood: float | None
    finished_count: int
    kit_sessions_logged: int
    real_life_try_passed: bool
    passed: bool
    # True once the Real-Life Try day is finished; until then the dose is in progress and has no verdict.
    complete: bool = False
    consult_suggested: bool = False
    # Insight scenario for a completed dose: first | settling | consult | progressing | steady.
    scenario: Literal["first", "settling", "consult", "progressing", "steady"] | None = None
    days: list[ProgressDay] = Field(default_factory=list)


class ProgressSummary(APIModel):
    child_id: str
    total_attempts: int
    check_in_count: int
    activities_completed: int
    average_completion_score: float | None
    average_mood_score: float | None
    support_score: float | None
    last_check_in: date | None
    trend: Literal["progress", "plateau", "decline", "insufficient_data"]
    points: list[ProgressPoint]
    headline_status: Literal[
        "first_dose", "progressing", "holding_steady", "needs_check_in", "settling_in", "insufficient_data"
    ] = "insufficient_data"
    current_play_plan_id: str | None = None
    fast_track_offered: bool = False
    move_down_offered: bool = False
    reminder_due: bool = False
    weekly_points: list[WeeklyProgressPoint] = Field(default_factory=list)


# --- Editable home page copy ---------------------------------------------------------------
# Every string is trimmed and length-limited, the shape is fixed (the page layout depends on it)
# and image URLs are restricted to http(s) or site-relative paths. The frontend renders all of it
# as plain text, never as HTML.

def _copy(max_length: int, *, allow_blank: bool = False):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=0 if allow_blank else 1, max_length=max_length)]


def _safe_image_url(value: str) -> str:
    if value == "":
        return value
    if any(char.isspace() for char in value):
        raise ValueError("Image URL must not contain spaces")
    if value.lower().startswith(("https://", "http://")) or (value.startswith("/") and not value.startswith("//")):
        return value
    raise ValueError("Image URL must start with https://, http:// or /")


Label = _copy(80)
Heading = _copy(160)
Paragraph = _copy(600)
Quote = _copy(700)
ImageUrl = Annotated[_copy(1000, allow_blank=True), AfterValidator(_safe_image_url)]


class HomeContentModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HomeHero(HomeContentModel):
    eyebrow: Label
    title: Heading
    title_highlight: Heading
    description: Paragraph
    primary_cta: Label
    secondary_cta: Label
    footnote: Paragraph
    image_url: ImageUrl = ""
    mobile_image_url: ImageUrl = ""


class HomeJourneyStep(HomeContentModel):
    title: Label
    body: Paragraph
    image_url: ImageUrl = ""


class HomeJourney(HomeContentModel):
    eyebrow: Label
    title: Heading
    steps: list[HomeJourneyStep] = Field(min_length=3, max_length=3)


class HomeSkills(HomeContentModel):
    title: Heading
    description: Paragraph
    button_label: Label
    all_plans_label: Label


class HomeWeekStep(HomeContentModel):
    when: Label
    title: Label
    body: Paragraph


class HomeStat(HomeContentModel):
    value: _copy(12)
    label: Label


class HomeWeek(HomeContentModel):
    eyebrow: Label
    title: Heading
    title_highlight: Heading
    description: Paragraph
    button_label: Label
    image_url: ImageUrl = ""
    steps: list[HomeWeekStep] = Field(min_length=4, max_length=4)
    stats: list[HomeStat] = Field(min_length=4, max_length=4)


class HomeLevels(HomeContentModel):
    eyebrow: Label
    title: Heading
    descriptions: list[Paragraph] = Field(min_length=3, max_length=3)


class HomeQuote(HomeContentModel):
    quote: Quote
    name: Label
    role: Label


class HomeStories(HomeContentModel):
    title: Heading
    subtitle: Paragraph
    quotes: list[HomeQuote] = Field(min_length=1, max_length=6)


class HomeAudience(HomeContentModel):
    title: Heading
    body: Paragraph
    button_label: Label


class HomeFooter(HomeContentModel):
    title: Heading
    description: Paragraph
    button_label: Label
    blurb: Paragraph
    copyright: Label


class HomeAuthImages(HomeContentModel):
    login_image_url: ImageUrl = ""
    signup_image_url: ImageUrl = ""
    password_image_url: ImageUrl = ""


class HomePolicy(HomeContentModel):
    title: Heading
    body: _copy(100000)


class HomePolicies(HomeContentModel):
    privacy: HomePolicy | None = None
    terms: HomePolicy | None = None


class HomepageContent(HomeContentModel):
    hero: HomeHero
    auth: HomeAuthImages = Field(default_factory=HomeAuthImages)
    policies: HomePolicies = Field(default_factory=HomePolicies)
    journey: HomeJourney
    skills: HomeSkills
    week: HomeWeek
    levels: HomeLevels
    stories: HomeStories
    families: HomeAudience
    schools: HomeAudience
    footer: HomeFooter


class SiteContentRead(APIModel):
    """`content` is null until a Super Admin saves; the site then falls back to its built-in copy."""
    content: dict | None = None
    updated_at: datetime | None = None


class PlanPictureRead(APIModel):
    """The picture a published Play Plan shows, for the landing page."""
    plan: str
    category: str
    thumbnail_url: str
