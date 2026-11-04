"""Discounts on family subscriptions: coupons the Super Admin sets up, offered on the Subscription
page ("Available offers") or applied by code at checkout.

The price is always worked out here, on the server: the browser only sends the code. Checkout
charges the reduced price through Stripe, and the signed Stripe webhook records the redemption,
so an abandoned checkout never uses up a coupon.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Child, Discount, DiscountRedemption, Role, Subscription, User
from app.pricing import billing_catalog
from app.services import audit

# Stripe's smallest charge in dirhams is AED 2.00; a discount never takes a price below it.
MIN_CHARGE = 200
CODE = re.compile(r"^[A-Z0-9][A-Z0-9_-]{2,39}$")


class DiscountError(ValueError):
    """Why a code can't be used, worded for the person checking out."""


@dataclass(frozen=True)
class Quote:
    discount: Discount
    list_amount: int
    discount_amount: int

    @property
    def final_amount(self) -> int:
        return self.list_amount - self.discount_amount


def normalise_code(code: str) -> str:
    return re.sub(r"\s+", "", code or "").upper()


def _uses(db: Session, discount: Discount, user: User | None = None) -> int:
    query = select(func.count(DiscountRedemption.id)).where(DiscountRedemption.discount_id == discount.id)
    if user is not None:
        query = query.where(DiscountRedemption.user_id == user.id)
    return db.scalar(query) or 0


def _has_paid_before(db: Session, user: User) -> bool:
    return bool(db.scalar(
        select(func.count(Subscription.id)).join(Child, Child.id == Subscription.child_id)
        .where(Child.owner_id == user.id, Subscription.stripe_checkout_session_id.is_not(None))
    ))


def amount_off(discount: Discount, list_amount: int) -> int:
    """What the discount takes off this price, never leaving less than Stripe's minimum charge."""
    if discount.kind == "percent":
        off = round(list_amount * discount.value / 100)
        if discount.max_discount:
            off = min(off, discount.max_discount)
    else:
        off = discount.value
    return max(0, min(off, list_amount - MIN_CHARGE))


def check_usable(db: Session, discount: Discount, user: User, plan: str, today: date | None = None) -> None:
    today = today or date.today()
    if not discount.is_active:
        raise DiscountError("This code isn’t active right now.")
    if discount.starts_on and today < discount.starts_on:
        raise DiscountError(f"This offer starts on {discount.starts_on:%-d %b %Y}.")
    if discount.ends_on and today > discount.ends_on:
        raise DiscountError("This offer has ended.")
    months = int(plan.rstrip("m")) if plan[:-1].isdigit() else None
    if discount.plans and months not in discount.plans:
        names = ", ".join(f"{m}-month" for m in sorted(discount.plans))
        raise DiscountError(f"This code works on the {names} plan{'s' if len(discount.plans) > 1 else ''} only.")
    if discount.max_uses is not None and _uses(db, discount) >= discount.max_uses:
        raise DiscountError("This offer has been fully used.")
    if discount.once_per_account and _uses(db, discount, user):
        raise DiscountError("You’ve already used this code.")
    if discount.new_customers_only and _has_paid_before(db, user):
        raise DiscountError("This offer is for a first subscription only.")


def quote(db: Session, code: str, user: User, plan: str, list_amount: int) -> Quote:
    discount = db.scalar(select(Discount).where(Discount.code == normalise_code(code)))
    if discount is None:
        raise DiscountError("That code isn’t valid. Check it and try again.")
    check_usable(db, discount, user, plan)
    off = amount_off(discount, list_amount)
    if off <= 0:
        raise DiscountError("This code doesn’t lower the price of this plan.")
    return Quote(discount=discount, list_amount=list_amount, discount_amount=off)


# ---------- Schemas ----------

Text80 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class DiscountInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=3, max_length=40)
    title: Text80
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""
    kind: Literal["percent", "amount"]
    value: int = Field(ge=1)
    max_discount: int | None = Field(default=None, ge=100)
    plans: list[int] = Field(default_factory=list, max_length=10)
    starts_on: date | None = None
    ends_on: date | None = None
    max_uses: int | None = Field(default=None, ge=1, le=1_000_000)
    once_per_account: bool = True
    new_customers_only: bool = False
    show_in_offers: bool = True
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _code(cls, value: str) -> str:
        value = normalise_code(value)
        if not CODE.match(value):
            raise ValueError("Use 3–40 letters, numbers, - or _, e.g. WELCOME10")
        return value

    @field_validator("plans")
    @classmethod
    def _plans(cls, value: list[int]) -> list[int]:
        if any(not 1 <= months <= 60 for months in value):
            raise ValueError("Plans are month durations from 1 to 60")
        return sorted(set(value))

    @model_validator(mode="after")
    def _consistent(self):
        if self.kind == "percent" and not 1 <= self.value <= 90:
            raise ValueError("A percentage discount is 1–90%")
        if self.kind == "amount" and self.value > 100_000_000:
            raise ValueError("That amount is too large")
        if self.kind == "amount" and self.max_discount is not None:
            self.max_discount = None  # only a percentage needs a cap
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("The end date must be on or after the start date")
        return self


class DiscountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    title: str
    description: str | None
    kind: str
    value: int
    max_discount: int | None
    plans: list[int]
    starts_on: date | None
    ends_on: date | None
    max_uses: int | None
    once_per_account: bool
    new_customers_only: bool
    show_in_offers: bool
    is_active: bool
    created_at: datetime
    uses: int = 0
    total_saved: int = 0
    status: Literal["active", "scheduled", "ended", "used_up", "paused"] = "active"


class OfferRead(BaseModel):
    code: str
    title: str
    description: str | None
    kind: str
    value: int
    max_discount: int | None
    plans: list[int]
    ends_on: date | None
    new_customers_only: bool


class DiscountCheck(BaseModel):
    code: str = Field(min_length=1, max_length=60)
    plan: str = Field(pattern=r"^[1-9][0-9]?m$", max_length=3)


class DiscountQuote(BaseModel):
    code: str
    title: str
    list_amount: int
    discount_amount: int
    final_amount: int


def _status(db: Session, discount: Discount, today: date) -> str:
    if not discount.is_active:
        return "paused"
    if discount.starts_on and today < discount.starts_on:
        return "scheduled"
    if discount.ends_on and today > discount.ends_on:
        return "ended"
    if discount.max_uses is not None and _uses(db, discount) >= discount.max_uses:
        return "used_up"
    return "active"


def _read(db: Session, discount: Discount) -> DiscountRead:
    saved = db.scalar(
        select(func.coalesce(func.sum(DiscountRedemption.discount_amount), 0))
        .where(DiscountRedemption.discount_id == discount.id)
    ) or 0
    return DiscountRead.model_validate(discount).model_copy(update={
        "uses": _uses(db, discount), "total_saved": saved, "status": _status(db, discount, date.today()),
    })


# ---------- Routes ----------

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])
super_admin = require_roles(Role.SUPER_ADMIN)


@router.get("/offers", response_model=list[OfferRead])
def list_offers(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The offers this person can use today, best first, for the "Available offers" list."""
    catalogue = billing_catalog(db)
    offers: list[tuple[int, Discount]] = []
    for discount in db.scalars(select(Discount).where(Discount.is_active.is_(True), Discount.show_in_offers.is_(True))):
        best = 0
        for plan, item in catalogue.items():
            try:
                check_usable(db, discount, user, plan)
            except DiscountError:
                continue
            best = max(best, amount_off(discount, item["amount"]))
        if best > 0:
            offers.append((best, discount))
    offers.sort(key=lambda pair: -pair[0])
    return [OfferRead.model_validate(discount, from_attributes=True) for _, discount in offers]


@router.post("/discounts/check", response_model=DiscountQuote)
def check_discount(payload: DiscountCheck, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """What a code would take off a plan, before going to payment."""
    item = billing_catalog(db).get(payload.plan)
    if item is None:
        raise HTTPException(status_code=422, detail="This subscription plan is no longer available.")
    try:
        result = quote(db, payload.code, user, payload.plan, item["amount"])
    except DiscountError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return DiscountQuote(code=result.discount.code, title=result.discount.title, list_amount=result.list_amount,
                         discount_amount=result.discount_amount, final_amount=result.final_amount)


@router.get("/discounts", response_model=list[DiscountRead])
def list_discounts(_: User = Depends(super_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(Discount).order_by(Discount.created_at.desc())).all()
    return [_read(db, row) for row in rows]


def _taken(db: Session, code: str, except_id: str | None = None) -> bool:
    query = select(Discount.id).where(Discount.code == code)
    if except_id:
        query = query.where(Discount.id != except_id)
    return db.scalar(query) is not None


@router.post("/discounts", response_model=DiscountRead, status_code=status.HTTP_201_CREATED)
def create_discount(payload: DiscountInput, actor: User = Depends(super_admin), db: Session = Depends(get_db)):
    if _taken(db, payload.code):
        raise HTTPException(status_code=409, detail="A discount with this code already exists")
    discount = Discount(**payload.model_dump(), created_by_id=actor.id)
    db.add(discount)
    db.flush()
    audit(db, actor.id, "billing.discount_created", "discount", discount.id, {"code": discount.code})
    db.commit()
    db.refresh(discount)
    return _read(db, discount)


@router.put("/discounts/{discount_id}", response_model=DiscountRead)
def update_discount(discount_id: str, payload: DiscountInput, actor: User = Depends(super_admin),
                    db: Session = Depends(get_db)):
    discount = db.get(Discount, discount_id)
    if discount is None:
        raise HTTPException(status_code=404, detail="Discount not found")
    if _taken(db, payload.code, discount.id):
        raise HTTPException(status_code=409, detail="A discount with this code already exists")
    if payload.code != discount.code and _uses(db, discount):
        raise HTTPException(status_code=409, detail="This code has been used, so it can’t be renamed. Create a new discount instead.")
    for key, value in payload.model_dump().items():
        setattr(discount, key, value)
    audit(db, actor.id, "billing.discount_updated", "discount", discount.id, {"code": discount.code})
    db.commit()
    db.refresh(discount)
    return _read(db, discount)


@router.delete("/discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount(discount_id: str, actor: User = Depends(super_admin), db: Session = Depends(get_db)):
    discount = db.get(Discount, discount_id)
    if discount is None:
        raise HTTPException(status_code=404, detail="Discount not found")
    if _uses(db, discount):
        raise HTTPException(status_code=409, detail="This code has been used, so it stays for your records. Pause it instead.")
    audit(db, actor.id, "billing.discount_deleted", "discount", discount.id, {"code": discount.code})
    db.delete(discount)
    db.commit()


def record_redemption(db: Session, metadata, field, *, session_id: str, user_id: str | None, child_id: str,
                      plan: str) -> None:
    """Called from the Stripe webhook once a discounted payment is confirmed."""
    discount_id = field(metadata, "discount_id")
    if not discount_id or db.get(Discount, discount_id) is None:
        return
    if db.scalar(select(DiscountRedemption.id).where(DiscountRedemption.stripe_checkout_session_id == session_id)):
        return
    try:
        list_amount = int(field(metadata, "list_amount"))
        discount_amount = int(field(metadata, "discount_amount"))
    except (TypeError, ValueError):
        return
    if user_id and db.get(User, user_id) is None:
        user_id = None  # the account was deleted before the payment was confirmed
    db.add(DiscountRedemption(
        discount_id=discount_id, user_id=user_id, child_id=child_id, plan=plan,
        list_amount=list_amount, discount_amount=discount_amount, stripe_checkout_session_id=session_id,
    ))
