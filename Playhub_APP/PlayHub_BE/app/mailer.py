"""Outgoing email. Klaviyo when a private key is configured, else SMTP when configured (e.g. Amazon SES
SMTP credentials); otherwise the message is logged so password reset links still work in local
development."""
from __future__ import annotations

import logging
import smtplib
import uuid
from dataclasses import dataclass
from email.message import EmailMessage

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class OutgoingEmail:
    to: str
    subject: str
    text: str


# Tests read what would have been sent from here.
SENT: list[OutgoingEmail] = []

KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events"
KLAVIYO_REVISION = "2024-10-15"


def klaviyo_event(message: OutgoingEmail, metric: str) -> dict:
    """The Klaviyo event for one email; a flow triggered by `metric` sends it using
    {{ event.subject }} and {{ event.text }}."""
    return {
        "data": {
            "type": "event",
            "attributes": {
                "properties": {"subject": message.subject, "text": message.text},
                "metric": {"data": {"type": "metric", "attributes": {"name": metric}}},
                "profile": {"data": {"type": "profile", "attributes": {"email": message.to}}},
                "unique_id": str(uuid.uuid4()),
            },
        }
    }


def _send_with_klaviyo(message: OutgoingEmail, key: str, metric: str) -> None:
    try:
        response = httpx.post(
            KLAVIYO_EVENTS_URL,
            json=klaviyo_event(message, metric),
            headers={
                "Authorization": f"Klaviyo-API-Key {key}",
                "revision": KLAVIYO_REVISION,
                "accept": "application/vnd.api+json",
                "content-type": "application/vnd.api+json",
            },
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        # Never reveal delivery problems to the requester; the reset page always says "check your email".
        logger.exception("Could not send email to %s through Klaviyo", message.to)


def send_email(message: OutgoingEmail) -> None:
    settings = get_settings()
    if message.to.lower().endswith(".local"):
        # Seeded demo accounts use the reserved .local domain, which can never receive mail;
        # sending would only create bounces that hurt the sender's reputation.
        logger.info("Skipping email to undeliverable demo address %s: %s", message.to, message.subject)
        return
    if settings.environment == "test":
        SENT.append(message)
        return
    if settings.klaviyo_private_key:
        _send_with_klaviyo(message, settings.klaviyo_private_key, settings.klaviyo_email_metric)
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
