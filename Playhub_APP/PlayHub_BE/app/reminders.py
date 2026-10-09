"""Daily subscription emails: a reminder when the renewal window opens, and a notice once a paid
period has ended. Runs in the background of the API process; `python -m app.reminders` runs it once."""
from __future__ import annotations

import asyncio
import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import notifications
from app.models import RENEWAL_WINDOW_DAYS, Child, Subscription, SubscriptionStatus

logger = logging.getLogger(__name__)

CHECK_EVERY_SECONDS = 60 * 60


def send_subscription_notices(db: Session, today: date | None = None) -> int:
    """Send any reminder or ended notice that is due; returns how many emails went out."""
    today = today or date.today()
    sent = 0
    rows = db.scalars(
        select(Subscription)
        .options(selectinload(Subscription.child).selectinload(Child.owner))
        .where(Subscription.status == SubscriptionStatus.ACTIVE, Subscription.ends_on.is_not(None))
    ).all()
    for sub in rows:
        days_left = (sub.ends_on - today).days
        owner = sub.child.owner if sub.child else None
        if days_left < 0:
            if sub.ended_notice_for != sub.ends_on:
                notifications.subscription_ended(owner, sub.child.name, sub.ends_on)
                sub.ended_notice_for = sub.ends_on
                sub.renewal_reminder_for = sub.ends_on  # too late for a reminder now
                sent += 1
        elif days_left <= RENEWAL_WINDOW_DAYS and sub.renewal_reminder_for != sub.ends_on:
            notifications.renewal_reminder(owner, sub.child.name, sub.ends_on, days_left)
            sub.renewal_reminder_for = sub.ends_on
            sent += 1
    db.commit()
    return sent


def run_once() -> int:
    from app.database import SessionLocal

    with SessionLocal() as db:
        return send_subscription_notices(db)


async def notice_loop() -> None:
    while True:
        try:
            sent = await asyncio.to_thread(run_once)
            if sent:
                logger.info("Sent %s subscription email(s)", sent)
        except Exception:  # keep the loop alive; the next check retries
            logger.exception("Subscription emails failed")
        await asyncio.sleep(CHECK_EVERY_SECONDS)


if __name__ == "__main__":
    print(f"Sent {run_once()} subscription email(s)")
