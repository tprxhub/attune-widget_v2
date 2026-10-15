"""Play Pulse results: every finished check is saved, and the Super Admin can list and export them.

Play Pulse needs no account. A guest fills in a short form (name, phone, email) before seeing the
result; it is kept once per email address in `play_pulse_contacts`, and the browser sends it again
with later checks. A signed-in person skips the form and the check is saved against their account.

The score itself is worked out in the browser from the question bank; it is stored as shown, after
checking every value is one the check can produce."""
from __future__ import annotations

import csv
import io
import math
import re
from collections.abc import Iterator
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import bearer, require_roles
from app.models import PlayPulseContact, PlayPulseResult, Role, User
from app.security import decode_access_token
from app.services import audit

router = APIRouter(prefix="/api/v1", tags=["play-pulse"])

DOMAINS = ("Sensory", "Motor", "Cognition", "Engagement")
AGE_BANDS = {"toddler": "Toddler", "preschool": "Preschooler", "school": "School-age"}
GOALS = {
    "pencil-grip": "Fix the Pencil Grip",
    "button-shirt": "Learn to Button a Shirt",
    "reading": "Make Reading Easy",
    "scissors": "Learn to Use Scissors",
    "colour-lines": "Colour Inside the Lines",
    "copy-words": "Copy Words Correctly",
    "write-name": "Write Their Name",
}
TIERS = {"ontrack": "On Track", "practice": "Needs Practice", "help": "Needs Help"}
DOMAIN_TIER_LABELS = {**TIERS, "unknown": "Not yet assessed"}
PAGE_SIZES = (10, 50, 100)
DAILY_CHECKS = 30  # per person, to keep the open endpoint from being flooded
PHONE = re.compile(r"^\+?[0-9][0-9 ()\-]{5,22}[0-9]$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

AnswerValue = Literal[15, 40, 65, 90, "skipped"] | None


class PulseContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    phone: str = Field(min_length=7, max_length=32)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Please enter your name.")
        return value

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL.match(value):
            raise ValueError("Please enter a valid email address.")
        return value

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        value = " ".join(value.split())
        if not PHONE.match(value) or not 7 <= sum(c.isdigit() for c in value) <= 15:
            raise ValueError("Please enter a valid phone number.")
        return value


class PulseSubmission(BaseModel):
    contact: PulseContactIn | None = None
    child_name: str = Field(min_length=1, max_length=80)
    age_band: Literal["toddler", "preschool", "school"]
    goal_id: str
    support_score: int = Field(ge=0, le=100)
    tier: Literal["ontrack", "practice", "help"]
    areas_on_track: int = Field(ge=0, le=4)
    areas_assessed: int = Field(ge=0, le=4)
    domain_tiers: dict[str, Literal["ontrack", "practice", "help", "unknown"]]
    answers: dict[str, list[AnswerValue]]
    # Left empty by people; bots that fill every field are quietly ignored.
    website: str = ""

    @field_validator("child_name")
    @classmethod
    def _child(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Please enter the child's name.")
        return value

    @field_validator("goal_id")
    @classmethod
    def _goal(cls, value: str) -> str:
        if value not in GOALS:
            raise ValueError("Unknown Play Pulse goal.")
        return value

    @model_validator(mode="after")
    def _shape(self) -> PulseSubmission:
        if set(self.domain_tiers) != set(DOMAINS) or set(self.answers) != set(DOMAINS):
            raise ValueError("Every domain must be answered.")
        if any(len(values) != 2 or None in values for values in self.answers.values()):
            raise ValueError("Every question must be answered.")
        assessed = sum(tier != "unknown" for tier in self.domain_tiers.values())
        on_track = sum(tier == "ontrack" for tier in self.domain_tiers.values())
        if (self.areas_assessed, self.areas_on_track) != (assessed, on_track):
            raise ValueError("Areas on track do not match the domain results.")
        return self


class PulseSubmitted(BaseModel):
    id: str


class PulseResultRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    name: str
    email: str
    phone: str | None
    source: str  # "guest", or the account's role
    child_name: str
    age_band: str
    goal_id: str
    goal_name: str
    support_score: int
    tier: str
    areas_on_track: int
    areas_assessed: int
    domain_tiers: dict[str, str]


class PulseResultPage(BaseModel):
    items: list[PulseResultRow]
    total: int
    page: int
    page_size: int
    pages: int


def _optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User | None:
    """The signed-in person, or None for a guest. A stale token counts as a guest, not an error."""
    subject = decode_access_token(credentials.credentials) if credentials else None
    user = db.get(User, subject) if subject else None
    return user if user and user.is_active else None


def _today_start() -> datetime:
    return datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)


@router.post("/play-pulse/results", response_model=PulseSubmitted, status_code=status.HTTP_201_CREATED)
def submit_result(payload: PulseSubmission, user: User | None = Depends(_optional_user), db: Session = Depends(get_db)):
    if payload.website:
        return PulseSubmitted(id="ignored")
    # Details typed into the form are always kept, even if the browser also holds a sign-in.
    contact = None
    if user is None and payload.contact is None:
        raise HTTPException(status_code=422, detail="Please enter your name, phone number and email.")
    if payload.contact is not None:
        contact = db.scalar(select(PlayPulseContact).where(PlayPulseContact.email == payload.contact.email))
        if contact is None:
            contact = PlayPulseContact(email=payload.contact.email, name=payload.contact.name, phone=payload.contact.phone)
            db.add(contact)
            db.flush()
        else:
            contact.name, contact.phone = payload.contact.name, payload.contact.phone
    owner = PlayPulseResult.contact_id == contact.id if contact else PlayPulseResult.user_id == user.id
    taken_today = db.scalar(
        select(func.count(PlayPulseResult.id)).where(owner, PlayPulseResult.created_at >= _today_start())
    ) or 0
    if taken_today >= DAILY_CHECKS:
        raise HTTPException(status_code=429, detail="That's a lot of checks for one day. Please come back tomorrow.")
    result = PlayPulseResult(
        contact_id=contact.id if contact else None,
        user_id=user.id if user else None,
        child_name=payload.child_name,
        age_band=payload.age_band,
        goal_id=payload.goal_id,
        goal_name=GOALS[payload.goal_id],
        support_score=payload.support_score,
        tier=payload.tier,
        areas_on_track=payload.areas_on_track,
        areas_assessed=payload.areas_assessed,
        domain_tiers={domain: payload.domain_tiers[domain] for domain in DOMAINS},
        answers={domain: payload.answers[domain] for domain in DOMAINS},
    )
    db.add(result)
    db.commit()
    return PulseSubmitted(id=result.id)


# ---------- Super Admin ----------

_NAME = func.coalesce(PlayPulseContact.name, User.display_name)
_EMAIL = func.coalesce(PlayPulseContact.email, User.email)


def _filtered(
    q: str | None, goal_id: str | None, tier: str | None, age_band: str | None, source: str | None,
    date_from: date | None, date_to: date | None,
):
    query = (
        select(PlayPulseResult, User, PlayPulseContact)
        .outerjoin(User, User.id == PlayPulseResult.user_id)
        .outerjoin(PlayPulseContact, PlayPulseContact.id == PlayPulseResult.contact_id)
    )
    if q and (term := q.strip()):
        like = f"%{term.lower()}%"
        digits = re.sub(r"\D", "", term)
        clauses = [func.lower(_NAME).like(like), func.lower(_EMAIL).like(like), func.lower(PlayPulseResult.child_name).like(like)]
        # Phone numbers are matched on their digits, so "050 123" finds "+971 50 123 4567".
        if len(digits) >= 3:
            phone_digits = PlayPulseContact.phone
            for char in " ()-+":
                phone_digits = func.replace(phone_digits, char, "")
            clauses.append(phone_digits.like(f"%{digits}%"))
        query = query.where(or_(*clauses))
    if goal_id:
        query = query.where(PlayPulseResult.goal_id == goal_id)
    if tier:
        query = query.where(PlayPulseResult.tier == tier)
    if age_band:
        query = query.where(PlayPulseResult.age_band == age_band)
    if source == "guest":
        query = query.where(PlayPulseResult.user_id.is_(None))
    elif source == "account":
        query = query.where(PlayPulseResult.user_id.is_not(None))
    if date_from:
        query = query.where(PlayPulseResult.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        query = query.where(PlayPulseResult.created_at < end)
    return query


def _row(result: PlayPulseResult, user: User | None, contact: PlayPulseContact | None) -> PulseResultRow:
    created = result.created_at if result.created_at.tzinfo else result.created_at.replace(tzinfo=timezone.utc)
    return PulseResultRow(
        id=result.id,
        created_at=created,
        name=contact.name if contact else user.display_name if user else "Deleted account",
        email=contact.email if contact else user.email if user else "",
        phone=contact.phone if contact else None,
        source=user.role.value if user else "guest" if contact else "deleted",
        child_name=result.child_name,
        age_band=result.age_band,
        goal_id=result.goal_id,
        goal_name=result.goal_name,
        support_score=result.support_score,
        tier=result.tier,
        areas_on_track=result.areas_on_track,
        areas_assessed=result.areas_assessed,
        domain_tiers=result.domain_tiers,
    )


class _Filters:
    """The table's filters, shared by the list and the export."""

    def __init__(
        self,
        q: str | None = Query(default=None, max_length=120),
        goal_id: str | None = Query(default=None),
        tier: Literal["ontrack", "practice", "help"] | None = Query(default=None),
        age_band: Literal["toddler", "preschool", "school"] | None = Query(default=None),
        source: Literal["guest", "account"] | None = Query(default=None),
        date_from: date | None = Query(default=None),
        date_to: date | None = Query(default=None),
    ):
        self.args = (q, goal_id, tier, age_band, source, date_from, date_to)


@router.get("/admin/play-pulse/results", response_model=PulseResultPage)
def list_results(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10),
    filters: _Filters = Depends(),
    _: User = Depends(require_roles(Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    if page_size not in PAGE_SIZES:
        raise HTTPException(status_code=422, detail="Page size must be 10, 50 or 100.")
    query = _filtered(*filters.args)
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    pages = max(1, math.ceil(total / page_size))
    rows = db.execute(
        query.order_by(PlayPulseResult.created_at.desc(), PlayPulseResult.id.desc())
        .limit(page_size).offset((min(page, pages) - 1) * page_size)
    ).all()
    return PulseResultPage(
        items=[_row(*row) for row in rows], total=total, page=min(page, pages), page_size=page_size, pages=pages,
    )


EXPORT_COLUMNS = [
    "Submitted (UTC)", "Name", "Email", "Phone", "Source", "Child", "Age band", "Goal",
    "Support Score (%)", "Result", "Areas on track", *DOMAINS,
]


def _cell(value: object) -> str:
    """Spreadsheets run text starting with = + - @ as a formula; names typed into the form must not."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/admin/play-pulse/results/export")
def export_results(
    scope: Literal["filtered", "all"] = Query(default="filtered"),
    filters: _Filters = Depends(),
    user: User = Depends(require_roles(Role.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    args = filters.args if scope == "filtered" else (None,) * 7
    query = _filtered(*args).order_by(PlayPulseResult.created_at.desc(), PlayPulseResult.id.desc())
    # Read before streaming: the database session closes once this function returns.
    rows = [_row(*row) for row in db.execute(query)]
    audit(db, user.id, "play_pulse.exported", "play_pulse_results", "export", {"scope": scope, "rows": len(rows)})
    db.commit()

    def lines() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        buffer.write("﻿")  # so Excel reads the file as UTF-8
        writer.writerow(EXPORT_COLUMNS)
        for row in rows:
            writer.writerow([_cell(value) for value in (
                row.created_at.strftime("%Y-%m-%d %H:%M"), row.name, row.email, row.phone or "",
                "Guest" if row.source == "guest" else row.source.replace("_", " ").title(),
                row.child_name, AGE_BANDS.get(row.age_band, row.age_band), row.goal_name,
                row.support_score, TIERS.get(row.tier, row.tier), f"{row.areas_on_track} of {row.areas_assessed}",
                *(DOMAIN_TIER_LABELS.get(row.domain_tiers.get(domain, ""), "") for domain in DOMAINS),
            )])
            if buffer.tell() > 64_000:
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate()
        yield buffer.getvalue()

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return StreamingResponse(
        lines(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="play-pulse-{scope}-{stamp}.csv"'},
    )
