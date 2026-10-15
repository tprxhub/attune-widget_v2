"""The public subscription catalogue, editable only by the Super Admin."""
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from typing import Annotated
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import Role, SiteContent, User
from app.site_content import save_content


class PricePlan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    months: int = Field(ge=1, le=60, strict=True)
    amount: int = Field(ge=100, le=100000000, strict=True)  # fils
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=600)] = ""
    featured: bool = False
    badge_text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)] = "Best value"


class PricingCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid")
    currency: Literal["AED"] = "AED"
    plans: list[PricePlan] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def unique_options(self):
        if len({plan.months for plan in self.plans}) != len(self.plans):
            raise ValueError("Each plan must have a different month duration")
        return self


DEFAULT_PRICING = PricingCatalog(plans=[
    PricePlan(months=1, amount=6300, label="1-Month", note="A month of guided play to get started."),
    PricePlan(months=3, amount=18900, label="3-Month", note="Trying the programme or a short-term goal."),
    PricePlan(months=6, amount=33900, label="6-Month", note="A full development block across a term.", featured=True),
])
PRICING_KEY = "subscription_pricing"


def load_pricing(db: Session) -> PricingCatalog:
    row = db.get(SiteContent, PRICING_KEY)
    return PricingCatalog.model_validate(row.content) if row else DEFAULT_PRICING.model_copy(deep=True)


def billing_catalog(db: Session) -> dict:
    return {
        f"{plan.months}m": {"months": plan.months, "amount": plan.amount, "name": f"Play Hub — {plan.label}"}
        for plan in load_pricing(db).plans
    }


router = APIRouter(prefix="/api/v1/billing")


@router.get("/plans", response_model=PricingCatalog)
def get_pricing(db: Session = Depends(get_db)):
    return load_pricing(db)


@router.put("/plans", response_model=PricingCatalog)
def save_pricing(payload: PricingCatalog, actor: User = Depends(require_roles(Role.SUPER_ADMIN)), db: Session = Depends(get_db)):
    save_content(db=db, actor_id=actor.id, key=PRICING_KEY, content=payload.model_dump(mode="json"), action="billing.pricing_updated")
    return payload
