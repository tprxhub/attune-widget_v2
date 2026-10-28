"""An organisation's billing schedule: Billing 1, Billing 2, ... in order, never overlapping.

The organisation's Admin sees the schedule and adds the next period when they renew; Super Admins
(and TTP employees allowed to manage organisations) see every organisation's schedule and can add,
correct or remove periods. Either side can download it as an Excel file.

This sits alongside the licence price, billing cycle and renewal date on the organisation itself.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import notifications
from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.licenses import add_cycle
from app.models import Organisation, OrganisationBilling, Role, User, cycle_months
from app.services import audit
from app.xlsx import Money, workbook

router = APIRouter(prefix="/api/v1", tags=["organisation-billing"])

MAX_MONTHS = 60


class BillingPeriodInput(BaseModel):
    months: int = Field(ge=1, le=MAX_MONTHS)
    licenses: int = Field(default=0, ge=0, le=100_000)
    # Fils per licence per month.
    license_price: int = Field(default=0, ge=0, le=100_000_000)
    # Fils for the whole period; left out, it is licences × price × months.
    amount: Optional[int] = Field(default=None, ge=0, le=10_000_000_000)
    # Left out, a period starts the day after the previous one ends (or today for the first);
    # a later date leaves a gap, an earlier one is refused so periods never overlap.
    starts_on: Optional[date] = None
    note: Optional[str] = Field(default=None, max_length=500)


class BillingPeriodUpdate(BaseModel):
    months: Optional[int] = Field(default=None, ge=1, le=MAX_MONTHS)
    licenses: Optional[int] = Field(default=None, ge=0, le=100_000)
    license_price: Optional[int] = Field(default=None, ge=0, le=100_000_000)
    amount: Optional[int] = Field(default=None, ge=0, le=10_000_000_000)
    starts_on: Optional[date] = None
    note: Optional[str] = Field(default=None, max_length=500)


class BillingPeriodRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sequence: int
    starts_on: date
    ends_on: date
    months: int
    licenses: int
    license_price: int
    amount: int
    note: Optional[str]
    status: Literal["past", "current", "upcoming"]
    added_by_name: Optional[str]
    created_at: datetime
    # The first day this period may start (the day after the one before it ends).
    earliest_start: Optional[date]
    # Whether the person asking may change or remove this period.
    can_edit: bool
    can_remove: bool


class BillingSchedule(BaseModel):
    organisation_id: str
    organisation_name: str
    starts_on: Optional[date]
    ends_on: Optional[date]
    total_months: int
    total_amount: int
    current_sequence: Optional[int]
    # Where the next period starts unless a later date is picked.
    next_starts_on: date
    # Billing 1 starts from the organisation's licence count, price and cycle.
    suggested_months: int
    suggested_licenses: int
    suggested_license_price: int
    periods: list[BillingPeriodRead]


def ends_on(period: OrganisationBilling) -> date:
    """The last day of the period: 1 January for 4 months ends on 30 April."""
    return add_cycle(period.starts_on, f"{period.months}_months") - timedelta(days=1)


def status_of(period: OrganisationBilling, today: date) -> str:
    if today < period.starts_on:
        return "upcoming"
    return "past" if today > ends_on(period) else "current"


def _periods(db: Session, organisation_id: str) -> list[OrganisationBilling]:
    return list(db.scalars(
        select(OrganisationBilling)
        .where(OrganisationBilling.organisation_id == organisation_id)
        .order_by(OrganisationBilling.sequence)
    ))


def _earliest_start(periods: list[OrganisationBilling], period: OrganisationBilling | None) -> date | None:
    """The first day a period may start: the day after the period before it ends."""
    before = [p for p in periods if period is None or p.sequence < period.sequence]
    return ends_on(before[-1]) + timedelta(days=1) if before else None


def _check_start(starts_on: date, earliest: date | None) -> None:
    if earliest and starts_on < earliest:
        raise HTTPException(
            status_code=422,
            detail=f"This period can start on {earliest.strftime('%-d %b %Y')} at the earliest, after the previous one ends",
        )


def _push_on(periods: list[OrganisationBilling]) -> None:
    """Keep periods in order: one that would now overlap the period before it moves to start the
    day after that one ends. Gaps chosen on purpose are kept."""
    for previous, period in zip(periods, periods[1:]):
        period.starts_on = max(period.starts_on, ends_on(previous) + timedelta(days=1))


def _is_manager(user: User) -> bool:
    return user.can("organisations")


def _organisation(db: Session, organisation_id: str, user: User) -> Organisation:
    """The organisation, if the user manages organisations or is that organisation's Admin."""
    if not _is_manager(user) and not (user.role == Role.ADMIN and user.organisation_id == organisation_id):
        raise HTTPException(status_code=403, detail="You cannot see this organisation's billing")
    organisation = db.get(Organisation, organisation_id)
    if organisation is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return organisation


def _schedule(organisation: Organisation, periods: list[OrganisationBilling], user: User) -> BillingSchedule:
    today = date.today()
    manager = _is_manager(user)
    rows = []
    for index, period in enumerate(periods):
        status = status_of(period, today)
        # An organisation's Admin can fix a period that hasn't started yet; Super Admins any period.
        can_edit = manager or status == "upcoming"
        rows.append(BillingPeriodRead(
            id=period.id, sequence=period.sequence, starts_on=period.starts_on, ends_on=ends_on(period),
            months=period.months, licenses=period.licenses, license_price=period.license_price,
            amount=period.amount, note=period.note, status=status, added_by_name=period.added_by_name,
            created_at=period.created_at, can_edit=can_edit,
            earliest_start=ends_on(periods[index - 1]) + timedelta(days=1) if index else None,
            # Only the last period comes off, so the periods before it never move.
            can_remove=can_edit and index == len(periods) - 1,
        ))
    current = next((row.sequence for row in rows if row.status == "current"), None)
    return BillingSchedule(
        organisation_id=organisation.id,
        organisation_name=organisation.name,
        starts_on=rows[0].starts_on if rows else None,
        ends_on=rows[-1].ends_on if rows else None,
        total_months=sum(row.months for row in rows),
        total_amount=sum(row.amount for row in rows),
        current_sequence=current,
        next_starts_on=rows[-1].ends_on + timedelta(days=1) if rows else (organisation.billing_started_on or today),
        suggested_months=cycle_months(organisation.billing_cycle),
        suggested_licenses=organisation.seat_limit or 0,
        suggested_license_price=organisation.license_price or 0,
        periods=rows,
    )


def _snapshot(period: OrganisationBilling) -> dict:
    return {
        "sequence": period.sequence, "starts_on": period.starts_on.isoformat(), "months": period.months,
        "licenses": period.licenses, "license_price": period.license_price, "amount": period.amount,
    }


@router.get("/organisations/{organisation_id}/billing", response_model=BillingSchedule)
def get_schedule(organisation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    organisation = _organisation(db, organisation_id, user)
    return _schedule(organisation, _periods(db, organisation_id), user)


@router.post("/organisations/{organisation_id}/billing", response_model=BillingSchedule, status_code=201)
def add_period(
    organisation_id: str, payload: BillingPeriodInput,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    organisation = _organisation(db, organisation_id, user)
    periods = _periods(db, organisation_id)
    earliest = _earliest_start(periods, None)
    starts_on = payload.starts_on or earliest or organisation.billing_started_on or date.today()
    _check_start(starts_on, earliest)
    period = OrganisationBilling(
        organisation_id=organisation_id,
        sequence=(periods[-1].sequence if periods else 0) + 1,
        starts_on=starts_on,
        months=payload.months,
        licenses=payload.licenses,
        license_price=payload.license_price,
        amount=payload.amount if payload.amount is not None else payload.licenses * payload.license_price * payload.months,
        note=(payload.note or "").strip() or None,
        added_by_id=user.id,
        added_by_name=user.display_name,
    )
    db.add(period)
    db.flush()
    audit(db, user.id, "billing.period_added", "organisation", organisation_id, _snapshot(period))
    db.commit()
    if not _is_manager(user):
        notifications.alert_billing_period(db, organisation, period, ends_on(period), user)
    return _schedule(organisation, [*periods, period], user)


def _editable(db: Session, organisation_id: str, period_id: str, user: User):
    organisation = _organisation(db, organisation_id, user)
    periods = _periods(db, organisation_id)
    period = next((p for p in periods if p.id == period_id), None)
    if period is None:
        raise HTTPException(status_code=404, detail="Billing period not found")
    if not _is_manager(user) and status_of(period, date.today()) != "upcoming":
        raise HTTPException(status_code=403, detail="Only a Super Admin can change a period that has started")
    return organisation, periods, period


@router.patch("/organisations/{organisation_id}/billing/{period_id}", response_model=BillingSchedule)
def update_period(
    organisation_id: str, period_id: str, payload: BillingPeriodUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    organisation, periods, period = _editable(db, organisation_id, period_id, user)
    changes = payload.model_dump(exclude_unset=True)
    before = _snapshot(period)
    if "starts_on" in changes:
        if changes["starts_on"] is None:
            raise HTTPException(status_code=422, detail="Choose a start date")
        _check_start(changes["starts_on"], _earliest_start(periods, period))
        period.starts_on = changes["starts_on"]
    for key in ("months", "licenses", "license_price"):
        if changes.get(key) is not None:
            setattr(period, key, changes[key])
    if changes.get("amount") is not None:
        period.amount = changes["amount"]
    elif {"months", "licenses", "license_price"} & changes.keys():
        period.amount = period.licenses * period.license_price * period.months
    if "note" in changes:
        period.note = (changes["note"] or "").strip() or None
    _push_on(periods)
    audit(db, user.id, "billing.period_updated", "organisation", organisation_id,
          {"before": before, "after": _snapshot(period)})
    db.commit()
    return _schedule(organisation, periods, user)


@router.delete("/organisations/{organisation_id}/billing/{period_id}", response_model=BillingSchedule)
def remove_period(
    organisation_id: str, period_id: str,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    organisation, periods, period = _editable(db, organisation_id, period_id, user)
    if period is not periods[-1]:
        raise HTTPException(status_code=409, detail="Only the latest billing period can be removed")
    audit(db, user.id, "billing.period_removed", "organisation", organisation_id, _snapshot(period))
    db.delete(period)
    db.commit()
    return _schedule(organisation, periods[:-1], user)


EXPORT_COLUMNS = [
    "Organisation", "Billing", "Start date", "End date", "Months", "Licences",
    "Price per licence per month (AED)", "Total for the period (AED)", "Status", "Note", "Added by", "Added on",
]
EXPORT_WIDTHS = [28, 10, 14, 14, 9, 10, 18, 18, 11, 36, 20, 14]
STATUS_LABEL = {"past": "Past", "current": "Current", "upcoming": "Upcoming"}


def _export(db: Session, user: User, organisations: list[Organisation], scope: str, filename: str) -> Response:
    today = date.today()
    ids = [o.id for o in organisations]
    names = {o.id: o.name for o in organisations}
    periods = db.scalars(
        select(OrganisationBilling)
        .where(OrganisationBilling.organisation_id.in_(ids))
        .order_by(OrganisationBilling.organisation_id, OrganisationBilling.sequence)
    ).all() if ids else []
    rows = sorted(
        ([
            names[p.organisation_id], f"Billing {p.sequence}", p.starts_on, ends_on(p), p.months, p.licenses,
            Money(p.license_price / 100), Money(p.amount / 100), STATUS_LABEL[status_of(p, today)],
            p.note or "", p.added_by_name or "", p.created_at.date(),
        ] for p in periods),
        key=lambda row: (row[0].lower(), row[2]),
    )
    audit(db, user.id, "billing.periods_exported", "organisation", scope, {"rows": len(rows)})
    db.commit()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        workbook("Billing", EXPORT_COLUMNS, rows, EXPORT_WIDTHS),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}-{stamp}.xlsx"'},
    )


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:60] or "organisation"


@router.get("/organisations/{organisation_id}/billing/export")
def export_schedule(organisation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    organisation = _organisation(db, organisation_id, user)
    return _export(db, user, [organisation], organisation_id, f"billing-{_slug(organisation.name)}")


@router.get("/billing/organisations/export")
def export_all(user: User = Depends(require_permission("organisations")), db: Session = Depends(get_db)):
    organisations = list(db.scalars(select(Organisation).order_by(func.lower(Organisation.name))))
    return _export(db, user, organisations, "all", "billing-all-organisations")
