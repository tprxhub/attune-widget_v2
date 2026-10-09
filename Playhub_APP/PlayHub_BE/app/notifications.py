"""The emails Play Hub sends when something happens to an account. Each one is plain text and goes
through `send_email`, so Klaviyo (or SMTP) delivers them all with the same template."""
from __future__ import annotations

from datetime import date

from app.config import get_settings
from app.mailer import OutgoingEmail, send_email
from app.models import Invitation, Role, User

SIGN_OFF = "The Play Hub team\nThe Toy Pharmacy"

ROLE_LABEL = {
    Role.SUPER_ADMIN: "Super Admin",
    Role.ADMIN: "Admin",
    Role.MODERATOR: "Moderator",
    Role.MEMBER: "Member",
    Role.TTP_EMPLOYEE: "Toy Pharmacy team member",
}


def _link(path: str) -> str:
    return f"{get_settings().frontend_base_url.rstrip('/')}{path}"


def _day(value: date) -> str:
    return f"{value.day} {value:%b %Y}"


def _money(fils: int) -> str:
    return f"AED {fils / 100:,.2f}"


def _send(to: str | None, subject: str, *paragraphs: str) -> None:
    if not to:
        return
    send_email(OutgoingEmail(to=to, subject=subject, text="\n\n".join([*paragraphs, SIGN_OFF])))


def welcome(user: User, child_name: str) -> None:
    _send(
        user.email,
        "Welcome to Play Hub",
        f"Hi {user.display_name},",
        f"Welcome to Play Hub! {child_name}’s account is ready.",
        "Start with Play Pulse to see where to focus, then choose a Play Plan and log your first Session. "
        "On the free plan you can open the Rookie Play Dose of one Play Plan; subscribe any time to unlock them all.",
        f"Open Play Hub: {_link('/dashboard')}",
    )


def invitation(invite: Invitation, token: str, inviter: User, organisation_name: str | None = None) -> None:
    where = f" at {organisation_name}" if organisation_name else ""
    _send(
        invite.email,
        "You’re invited to Play Hub",
        f"Hi {invite.display_name or invite.email.split('@', 1)[0]},",
        f"{inviter.display_name} has invited you to join Play Hub as {ROLE_LABEL.get(invite.role, 'a member')}{where}.",
        f"Set your password and activate your account here (the link works until {_day(invite.expires_at.date())}):"
        f"\n\n{_link(f'/accept-invite?token={token}')}",
        "If you weren’t expecting this, you can ignore this email.",
    )


def payment_confirmed(
    owner: User | None, child_name: str, plan_name: str, amount: int, ends_on: date, renewal: bool
) -> None:
    if not owner:
        return
    _send(
        owner.email,
        "Your Play Hub subscription is active" if not renewal else "Your Play Hub subscription is renewed",
        f"Hi {owner.display_name},",
        f"Thank you! We received your payment of {_money(amount)} for {plan_name}.",
        f"{child_name} now has every Play Plan and Play Dose unlocked until {_day(ends_on)}.",
        "Changed your mind? You can ask for a full refund from the Subscription page within 7 days of paying.",
        f"Open Play Hub: {_link('/plans')}",
    )


def refund_started(owner: User | None, child_name: str, keeps_until: date | None) -> None:
    if not owner:
        return
    access = (
        f"{child_name} keeps the time already paid for, until {_day(keeps_until)}."
        if keeps_until
        else f"{child_name} is back on the free plan."
    )
    _send(
        owner.email,
        "Your Play Hub refund has started",
        f"Hi {owner.display_name},",
        "We’ve started your refund. It usually reaches your card within 5–10 business days, "
        "depending on your bank.",
        access,
        f"Subscribe again any time: {_link('/subscription')}",
    )


def refund_completed(owner: User | None, child_name: str) -> None:
    if not owner:
        return
    _send(
        owner.email,
        "Your Play Hub refund is complete",
        f"Hi {owner.display_name},",
        f"Your refund for {child_name}’s Play Hub subscription has been completed by our payment provider.",
    )


def refund_failed(owner: User | None, child_name: str) -> None:
    if not owner:
        return
    _send(
        owner.email,
        "We couldn’t complete your Play Hub refund",
        f"Hi {owner.display_name},",
        f"Your refund for {child_name}’s subscription didn’t go through, so the subscription stays active.",
        "Reply to this email and we’ll sort it out for you.",
    )


def password_changed(user: User) -> None:
    _send(
        user.email,
        "Your Play Hub password was changed",
        f"Hi {user.display_name},",
        "The password for your Play Hub account was just changed.",
        f"If this wasn’t you, reset your password straight away: {_link('/forgot-password')} "
        "and reply to this email so we can help.",
    )


def renewal_reminder(owner: User | None, child_name: str, ends_on: date, days_left: int) -> None:
    if not owner:
        return
    when = "today" if days_left == 0 else "tomorrow" if days_left == 1 else f"in {days_left} days"
    _send(
        owner.email,
        f"{child_name}’s Play Hub subscription ends {when}",
        f"Hi {owner.display_name},",
        f"{child_name}’s Play Hub subscription ends on {_day(ends_on)}.",
        "Renew now to keep every Play Plan and Play Dose open. The new period starts the day after the "
        "current one ends, so no paid days are lost.",
        f"Renew: {_link('/subscription')}",
    )


def subscription_ended(owner: User | None, child_name: str, ended_on: date) -> None:
    if not owner:
        return
    _send(
        owner.email,
        f"{child_name}’s Play Hub subscription has ended",
        f"Hi {owner.display_name},",
        f"{child_name}’s subscription ended on {_day(ended_on)}, so the account is back on the free plan. "
        "Every Session you logged stays saved.",
        f"Subscribe again any time to unlock every Play Plan: {_link('/subscription')}",
    )


def account_status(user: User, active: bool) -> None:
    if active:
        _send(
            user.email,
            "Your Play Hub account is active again",
            f"Hi {user.display_name},",
            "Your Play Hub account has been re-enabled. You can log in again.",
            f"Log in: {_link('/login')}",
        )
    else:
        _send(
            user.email,
            "Your Play Hub account has been disabled",
            f"Hi {user.display_name},",
            "Your Play Hub account has been disabled, so you can’t log in for now. Any Sessions you logged stay saved.",
            "If you think this is a mistake, reply to this email or contact the person who manages your account.",
        )
