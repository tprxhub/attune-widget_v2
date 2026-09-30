"""Pydantic request and response contracts for the public API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.models import (
    AccountScope, ActivityKind, AttemptSource, CompletionStatus, HelpLevel, PlanLevel, Role,
    InvitationStatus, SubscriptionStatus, VideoSourceType,
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


class PasswordChange(APIModel):
    current_password: str = Field(min_length=8, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


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


class UserUpdate(APIModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None


class InvitationCreate(APIModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str | None = Field(default=None, max_length=120)
    role: Role
    account_scope: AccountScope
    organisation_id: str | None = None
    child_id: str | None = None
    expires_in_days: int = Field(default=7, ge=1, le=30)

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


class InvitationCreated(InvitationRead):
    """Creation-only response containing the one-time activation credential."""
    acceptance_token: str | None = None


class InvitationAccept(APIModel):
    token: str = Field(min_length=20, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=256)


class PersonaRead(APIModel):
    id: str
    display_name: str
    role: Role
    account_scope: AccountScope
    organisation_id: str | None


class OrganisationCreate(APIModel):
    name: str = Field(min_length=2, max_length=160)
    kind: str = Field(default="school", min_length=2, max_length=40)
    seat_limit: int = Field(default=0, ge=0)
    billing_cycle: str | None = Field(default=None, max_length=32)


class OrganisationUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    kind: str | None = Field(default=None, min_length=2, max_length=40)
    seat_limit: int | None = Field(default=None, ge=0)
    billing_cycle: str | None = Field(default=None, max_length=32)
    is_active: bool | None = None


class OrganisationRead(APIModel):
    id: str
    name: str
    kind: str
    seat_limit: int
    billing_cycle: str | None
    is_active: bool
    created_at: datetime


class ActivityCreate(APIModel):
    sequence: int = Field(ge=0)
    day: int | None = Field(default=None, ge=0, le=31)
    kind: ActivityKind = ActivityKind.ACTIVITY
    title: str = Field(min_length=1, max_length=200)
    instructions: list[str] = Field(default_factory=list)
    video_source_type: VideoSourceType | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    is_loggable: bool = True
    is_real_life_try: bool = False

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
    video_source_type: VideoSourceType | None = None
    video_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    is_loggable: bool | None = None
    is_real_life_try: bool | None = None


class ActivityRead(APIModel):
    id: str
    play_dose_id: str
    sequence: int
    day: int | None
    kind: ActivityKind
    title: str
    instructions: list[str]
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


class PlayDoseUpdate(APIModel):
    level: PlanLevel | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    summary: str | None = None
    thumbnail_url: str | None = Field(default=None, max_length=1000)
    age_guidance: str | None = Field(default=None, max_length=80)
    safety_note: str | None = None
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


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
    activities: list[ActivityRead] = Field(default_factory=list)


class PlayPlanCreate(APIModel):
    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    short_description: str | None = Field(default=None, max_length=300)
    icon: str | None = Field(default=None, max_length=64)
    colour: str | None = Field(default=None, max_length=24)
    is_active: bool = True


class PlayPlanUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    slug: str | None = Field(default=None, min_length=2, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = None
    short_description: str | None = Field(default=None, max_length=300)
    icon: str | None = Field(default=None, max_length=64)
    colour: str | None = Field(default=None, max_length=24)
    is_active: bool | None = None


class PlayPlanRead(APIModel):
    id: str
    name: str
    slug: str
    description: str | None
    short_description: str | None
    icon: str | None
    colour: str | None
    is_active: bool
    created_by_name: str | None = None
    play_doses: list[PlayDoseRead] = Field(default_factory=list)


class ChildCreate(APIModel):
    name: str = Field(min_length=1, max_length=120)
    date_of_birth: date | None = None
    colour_token: str | None = Field(default=None, max_length=24)
    account_scope: AccountScope
    organisation_id: str | None = None
    owner_id: str | None = None
    admin_id: str | None = None
    moderator_id: str | None = None
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


class CheckoutCreate(APIModel):
    child_id: str
    plan: Literal["3m", "6m", "12m"]


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
    admin_id: str | None
    moderator_id: str | None
    current_play_dose_id: str | None
    plan_started_at: date | None
    notes: str | None
    is_active: bool
    subscription: SubscriptionRead | None = None


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
        if self.completion_status is None:
            if self.completion_score is None:
                raise ValueError("Choose whether the activity was finished, partly finished or stopped early")
            self.completion_status = (
                CompletionStatus.FINISHED
                if self.completion_score >= 4
                else CompletionStatus.PARTLY
                if self.completion_score == 3
                else CompletionStatus.STOPPED_EARLY
            )
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
        if self.completion_score is None:
            status_base = {
                CompletionStatus.FINISHED: 5,
                CompletionStatus.PARTLY: 3,
                CompletionStatus.STOPPED_EARLY: 1,
            }[self.completion_status]
            help_cap = {
                HelpLevel.INDEPENDENT: 5,
                HelpLevel.ONE_REMINDER: 4,
                HelpLevel.FEW_REMINDERS: 3,
                HelpLevel.HANDS_ON: 2,
            }[self.help_level]
            self.completion_score = min(status_base, help_cap)
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
    help_level: HelpLevel
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


class ProgressPoint(APIModel):
    attempt_id: str
    occurred_on: date
    completion_score: int
    mood_score: int
    play_plan_id: str
    play_dose_id: str
    activity_id: str | None = None
    source: AttemptSource


class WeeklyProgressPoint(APIModel):
    week_number: int
    week_start: date
    week_end: date
    play_plan_id: str
    play_dose_id: str
    level: PlanLevel
    support_score: int | None
    average_mood: float | None
    finished_count: int
    kit_sessions_logged: int
    real_life_try_passed: bool
    passed: bool
    consult_suggested: bool = False


class ProgressSummary(APIModel):
    child_id: str
    total_attempts: int
    check_in_count: int
    activities_completed: int
    average_completion_score: float | None
    average_mood_score: float | None
    support_score: int | None
    last_check_in: date | None
    trend: Literal["progress", "plateau", "decline", "insufficient_data"]
    points: list[ProgressPoint]
    headline_status: Literal[
        "progressing", "holding_steady", "needs_check_in", "settling_in", "insufficient_data"
    ] = "insufficient_data"
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


class HomepageContent(HomeContentModel):
    hero: HomeHero
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
