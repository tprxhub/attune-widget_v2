"""Outgoing email. SMTP when configured (e.g. Amazon SES SMTP credentials); otherwise the message is
logged so password reset links still work in local development."""
from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class OutgoingEmail:
    to: str
    subject: str
    text: str


# Tests read what would have been sent from here.
SENT: list[OutgoingEmail] = []


def send_email(message: OutgoingEmail) -> None:
    settings = get_settings()
    if settings.environment == "test":
        SENT.append(message)
        return
    if not settings.smtp_host:
        logger.warning("SMTP is not configured; email to %s not sent.\nSubject: %s\n%s", message.to, message.subject, message.text)
        return
    email = EmailMessage()
    email["From"] = settings.smtp_from
    email["To"] = message.to
    email["Subject"] = message.subject
    email.set_content(message.text)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password or "")
            smtp.send_message(email)
    except (OSError, smtplib.SMTPException):
        # Never reveal delivery problems to the requester; the reset page always says "check your email".
        logger.exception("Could not send email to %s", message.to)
