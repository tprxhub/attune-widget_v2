"""Attune: the OT-informed play and regulation partner. Parents, Moderators and staff ask about a
child's play or a hard moment; answers come from a language model following Attune's rules
(app.attune_rules) with the child's Play Plan, progress, Play Pulse and recent Sessions as context.

ATTUNE_PROVIDER chooses the model provider: OpenAI (Responses API) or DeepInfra (OpenAI-compatible
chat completions). Conversations are stored in Play Hub and each request sends the recent history,
so nothing depends on the provider keeping state. Without the chosen provider's key the feature
reports itself switched off and every question gets a 503."""
from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user, require_child_access, require_permission
from app.attune_rules import (MODE_GUIDANCE, SAFETY_OVERRIDE, SUMMARY_INSTRUCTIONS, Mode, build_rules,
                              plain_summary, safety_concern, split_reply, visible_text)
from app.attune_sources import references_for, register
from app.models import Activity, Attempt, AttuneConversation, AttuneMessage, Child, PlayPulseResult, User
from app.services import PROGRESS_LOAD, assigned_plan_id, audit, progress_summary

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/attune", tags=["attune"])

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEEPINFRA_CHAT_URL = "https://api.deepinfra.com/v1/openai/chat/completions"
HISTORY_MESSAGES = 12  # earlier turns sent back with each question
RECENT_SESSIONS = 10
MAX_STEPS = 12
# Only reasoning models accept `reasoning.effort`; others (gpt-4o, gpt-3.5…) reject the request.
REASONING_MODEL = re.compile(r"^(gpt-5|o\d)")

STATUS_LABEL = {"finished": "finished", "partly": "partly done", "stopped_early": "stopped early"}
HELP_LABEL = {
    "hands_on": "needed hands-on help",
    "few_reminders": "needed a few reminders",
    "one_reminder": "needed one reminder",
    "independent": "did it on their own",
}

def _as_utc(value: datetime) -> datetime:
    """SQLite hands back times without a zone; they are UTC, and the browser must be told so."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class AttuneMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    _utc = field_validator("created_at")(_as_utc)
    id: str
    role: str
    content: str
    activity_id: str | None
    feedback: str | None = None
    mode: str | None = None
    # Answers only: what the research icon lists, and whether the safety pathway was used.
    references: list[dict[str, str]] = Field(default_factory=list)
    safety: bool = False
    created_at: datetime


class AttuneConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    _utc = field_validator("created_at", "updated_at")(_as_utc)
    id: str
    child_id: str | None
    title: str
    created_at: datetime
    updated_at: datetime


class AttuneConversationDetail(AttuneConversationRead):
    messages: list[AttuneMessageRead]


class AttuneStatus(BaseModel):
    enabled: bool
    daily_limit: int
    used_today: int
    remaining_today: int
    free_plan: bool = False


class AttuneAsk(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    child_id: str | None = None
    activity_id: str | None = None
    # The way in the adult chose: "Get an idea", "My child is struggling" or "What does this mean?".
    mode: Mode | None = None


class AttuneRename(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class AttuneInsights(BaseModel):
    """Platform-wide Attune usage: counts only, never what anyone asked."""
    questions_today: int
    questions_7_days: int
    questions_30_days: int
    people_30_days: int
    children_30_days: int
    rated_up: int
    rated_down: int
    safety_30_days: int = 0
    shared_30_days: int = 0
    daily: list[dict]  # [{"date": "2026-10-12", "questions": 4}, …] for the last 14 days


class AttuneSummary(BaseModel):
    summary: str


class AttuneFeedback(BaseModel):
    value: Literal["up", "down"] | None


class AttuneAnswer(BaseModel):
    conversation: AttuneConversationRead
    question: AttuneMessageRead
    answer: AttuneMessageRead
    remaining_today: int


class AttuneUnavailable(Exception):
    """OpenAI could not answer (network, quota, bad key, refusal with no text)."""


# ---------- OpenAI ----------

def _output_text(payload: dict) -> str:
    parts = [
        content.get("text", "")
        for item in payload.get("output") or []
        if item.get("type") == "message"
        for content in item.get("content") or []
        if content.get("type") == "output_text"
    ]
    # File-search citations like 【4:0†source】 are noise in the chat.
    return re.sub(r"【[^】]*】", "", "".join(parts)).strip()


def attune_enabled() -> bool:
    settings = get_settings()
    key = settings.deepinfra_api_key if settings.attune_provider == "deepinfra" else settings.openai_api_key
    return bool(key)


def _post(url: str, key: str | None, body: dict) -> dict:
    try:
        response = httpx.post(
            url, json=body, headers={"Authorization": f"Bearer {key}"},
            timeout=get_settings().openai_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        log.warning("Attune request failed: %s", exc.__class__.__name__)
        raise AttuneUnavailable from exc
    if response.status_code != 200:
        # The error body names the problem (bad model, no credit) but never contains the key.
        log.warning("Attune provider error %s: %s", response.status_code, response.text[:500])
        raise AttuneUnavailable
    return response.json()


def _ask_openai(instructions: str, conversation: list[dict[str, str]]) -> str:
    settings = get_settings()
    body: dict = {
        "model": settings.openai_model,
        "instructions": instructions,
        "input": [{"role": m["role"], "content": m["content"]} for m in conversation],
        "max_output_tokens": 4000,
        "store": False,
    }
    effort = (settings.openai_reasoning_effort or "").strip()
    if effort and REASONING_MODEL.match(settings.openai_model):
        body["reasoning"] = {"effort": effort}
    if settings.openai_vector_store_id:
        body["tools"] = [{"type": "file_search", "vector_store_ids": [settings.openai_vector_store_id]}]
    return _output_text(_post(OPENAI_RESPONSES_URL, settings.openai_api_key, body))


def _ask_deepinfra(instructions: str, conversation: list[dict[str, str]]) -> str:
    settings = get_settings()
    body = {
        "model": settings.deepinfra_model,
        "messages": [{"role": "system", "content": instructions}, *conversation],
        "max_tokens": 1500,
        "temperature": 0.6,
    }
    payload = _post(DEEPINFRA_CHAT_URL, settings.deepinfra_api_key, body)
    text = ((payload.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    # Some open models show their working in <think> tags; only the answer belongs in the chat.
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def ask_model(instructions: str, conversation: list[dict[str, str]]) -> str:
    """Send the instructions and the conversation so far to the chosen provider; return the reply."""
    provider = get_settings().attune_provider
    text = (_ask_deepinfra if provider == "deepinfra" else _ask_openai)(instructions, conversation)
    if not text:
        log.warning("Attune provider %s returned no text", provider)
        raise AttuneUnavailable
    return text


_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)
_CITATION = re.compile(r"【[^】]*】")


def clean_partial(text: str) -> str:
    """The visible part of a reply that may still be arriving: hides <think> working and file
    citations, including ones whose closing tag hasn't arrived yet."""
    text = _CITATION.sub("", _THINK.sub("", text))
    if "<think>" in text:
        text = text[: text.index("<think>")]
    if "【" in text:
        text = text[: text.index("【")]
    for size in range(len("<think>") - 1, 0, -1):  # a tag that is still arriving, e.g. "<thi"
        if text.endswith("<think>"[:size]):
            text = text[:-size]
            break
    return text.lstrip()


def _stream_lines(url: str, key: str | None, body: dict) -> Iterator[str]:
    try:
        with httpx.stream(
            "POST", url, json=body, headers={"Authorization": f"Bearer {key}"},
            timeout=get_settings().openai_timeout_seconds,
        ) as response:
            if response.status_code != 200:
                log.warning("Attune provider error %s: %s", response.status_code, response.read()[:500])
                raise AttuneUnavailable
            yield from response.iter_lines()
    except httpx.HTTPError as exc:
        log.warning("Attune stream failed: %s", exc.__class__.__name__)
        raise AttuneUnavailable from exc


def _stream_deepinfra(instructions: str, conversation: list[dict[str, str]]) -> Iterator[str]:
    settings = get_settings()
    body = {
        "model": settings.deepinfra_model,
        "messages": [{"role": "system", "content": instructions}, *conversation],
        "max_tokens": 1500,
        "temperature": 0.6,
        "stream": True,
    }
    for line in _stream_lines(DEEPINFRA_CHAT_URL, settings.deepinfra_api_key, body):
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            return
        chunk = json.loads(data)
        if chunk.get("error"):
            log.warning("Attune stream error: %s", str(chunk["error"])[:300])
            raise AttuneUnavailable
        delta = ((chunk.get("choices") or [{}])[0].get("delta") or {}).get("content")
        if delta:
            yield delta


def _stream_openai(instructions: str, conversation: list[dict[str, str]]) -> Iterator[str]:
    settings = get_settings()
    body: dict = {
        "model": settings.openai_model,
        "instructions": instructions,
        "input": [{"role": m["role"], "content": m["content"]} for m in conversation],
        "max_output_tokens": 4000,
        "store": False,
        "stream": True,
    }
    effort = (settings.openai_reasoning_effort or "").strip()
    if effort and REASONING_MODEL.match(settings.openai_model):
        body["reasoning"] = {"effort": effort}
    if settings.openai_vector_store_id:
        body["tools"] = [{"type": "file_search", "vector_store_ids": [settings.openai_vector_store_id]}]
    for line in _stream_lines(OPENAI_RESPONSES_URL, settings.openai_api_key, body):
        if not line.startswith("data:"):
            continue
        event = json.loads(line[5:].strip())
        if event.get("type") == "response.output_text.delta":
            yield event.get("delta", "")
        elif event.get("type") in {"response.failed", "response.incomplete", "error"}:
            log.warning("Attune stream ended with %s", event.get("type"))
            raise AttuneUnavailable


def stream_model(instructions: str, conversation: list[dict[str, str]]) -> Iterator[str]:
    """Yield the visible reply in pieces as the chosen provider writes it."""
    provider = get_settings().attune_provider
    raw = (_stream_deepinfra if provider == "deepinfra" else _stream_openai)(instructions, conversation)
    full, sent = "", ""
    for piece in raw:
        full += piece
        visible = clean_partial(full)
        if visible.startswith(sent) and len(visible) > len(sent):
            yield visible[len(sent):]
            sent = visible


# ---------- Context ----------

def _age(born: date | None, today: date) -> str | None:
    if not born:
        return None
    months = (today.year - born.year) * 12 + today.month - born.month - (today.day < born.day)
    if months < 0:
        return None
    return f"{months} months" if months < 24 else f"{months // 12} years"


GAS = {"rookie": -1, "starter": 0, "pro": 1}
HEADLINE = {
    "first_dose": "first Play Dose at this level (completed or underway)",
    "progressing": "progressing: needed less help by the end of the dose than at the start",
    "holding_steady": "holding steady: about the same support as at the start of the dose",
    "needs_check_in": "Play Consult suggested: the Real-Life Try wasn't passed two doses in a row",
    "settling_in": "settling in to a new level",
    "insufficient_data": "a Play Dose is in progress; no verdict yet",
}
PULSE_TIER = {"ontrack": "On Track", "practice": "Needs Practice", "help": "Needs Help"}
PULSE_BAND = {"toddler": "toddler", "preschool": "preschooler", "school": "school-age"}


def _gas(level: str) -> str:
    gas = GAS.get(level, 0)
    return f"GAS {gas:+d}" if gas else "GAS 0"


def _level(dose) -> str:
    """e.g. "Starter level, GAS 0" or "Pro level, GAS +1"."""
    return f"{dose.level.value.title()} level, {_gas(dose.level.value)}"


def child_context(db: Session, child: Child, today: date | None = None, user: User | None = None) -> str:
    today = today or date.today()
    lines = [f"Child: {child.name}"]
    if age := _age(child.date_of_birth, today):
        lines.append(f"Age: {age}")
    lines.append("Account: family" if child.account_scope.value == "individual" else "Account: school or clinic")
    dose = child.current_play_dose
    if dose:
        lines.append(f"Current Play Plan: {dose.play_plan.name}")
        lines.append(f"Current Play Dose: {dose.title} ({_level(dose)})")
        if dose.smart_goal:
            lines.append(f"Goal of this Play Dose: {dose.smart_goal}")
        activities = [a.title for a in sorted(dose.activities, key=lambda a: a.sequence)]
        if activities:
            lines.append("Activities in this Play Dose (in order): " + "; ".join(activities))
        if dose.real_life_try_title:
            lines.append(f"Real-Life Try for this dose: {dose.real_life_try_title}"
                         + (f" (passed if: {dose.passed_if[:200]})" if dose.passed_if else ""))
        if dose.safety_note:
            lines.append(f"Safety note for this dose: {dose.safety_note[:300]}")
        lines.extend(plan_sequence(dose))
        lines.extend(dose_steps(db, user, dose))
    else:
        lines.append("No Play Plan chosen yet.")
    attempts = db.scalars(
        select(Attempt).where(Attempt.child_id == child.id)
        .order_by(Attempt.occurred_on.desc(), Attempt.created_at.desc()).limit(RECENT_SESSIONS)
    ).all()
    if attempts:
        total = db.scalar(select(func.count(Attempt.id)).where(Attempt.child_id == child.id)) or len(attempts)
        lines.append(f"Sessions logged in total: {total}")
        lines.append(f"Most recent Sessions (newest first, {len(attempts)} of {total} shown):")
        for a in attempts:
            what = a.activity.title if a.activity else a.play_dose.title
            parts = [STATUS_LABEL.get(a.completion_status.value, a.completion_status.value)]
            if a.help_level:
                parts.append(HELP_LABEL.get(a.help_level.value, a.help_level.value))
            parts.append(f"mood {a.mood_score}/5")
            line = f"- {a.occurred_on.isoformat()}: {what} — " + ", ".join(parts)
            if a.big_win:
                line += f". Big Win: {a.big_win[:200].rstrip('. ')}"
            if a.notes:
                line += f". Notes: {a.notes[:200]}"
            lines.append(line)
        lines.extend(progress_context(db, child))
    else:
        lines.append("No Sessions logged yet.")
    lines.extend(play_pulse_context(db, child))
    return "\n".join(lines)


def plan_sequence(dose) -> list[str]:
    """The whole Play Plan, level by level, and the materials it uses: what Attune may recommend
    moving to, and the only items it may suggest as alternatives."""
    plan = dose.play_plan
    doses = sorted((d for d in plan.play_doses if d.is_active), key=lambda d: (GAS.get(d.level.value, 0), d.sort_order))
    lines = ["Play Plan sequence (levels and their Activities, in order):"]
    for item in doses:
        titles = "; ".join(a.title for a in sorted(item.activities, key=lambda a: a.sequence)) or "no Activities yet"
        marker = " ← current" if item.id == dose.id else ""
        lines.append(f"- {_level(item)}: {item.title}{marker}. Activities: {titles}")
    materials = list(dict.fromkeys(m.strip() for d in doses for m in (d.real_life_try_items or []) if m.strip()))
    if materials:
        lines.append("Play Hub items used in this Play Plan: " + "; ".join(materials[:30]))
    return lines


def dose_steps(db: Session, user: User | None, dose) -> list[str]:
    """The current dose's Activity steps, short: what Attune grades and the materials it may suggest.
    Left out when this person can't open the dose (the free tier), so steps can't leak through Attune."""
    activities = sorted(dose.activities, key=lambda a: a.sequence)
    if not activities or user is None or not steps_open(db, user, activities[0]):
        return []
    lines = ["Steps of each Activity in the current Play Dose (shortened):"]
    for activity in activities:
        steps = [" ".join(step.split())[:160] for step in activity.instructions or [] if step.strip()][:6]
        if steps:
            lines.append(f"- {activity.title}: " + " / ".join(steps))
    return lines if len(lines) > 1 else []


def progress_context(db: Session, child: Child) -> list[str]:
    """Play Hub's own progress reading: the same numbers and signals as the Progress page."""
    summary = progress_summary(child.id, db.scalars(select(Attempt).options(*PROGRESS_LOAD).where(Attempt.child_id == child.id)).all(),
                               assigned_plan_id(child))
    points = [p for p in summary.weekly_points if p.play_plan_id == summary.current_play_plan_id][-6:]
    if not points:
        return []
    lines = ["Progress in the current Play Plan (oldest first; Support Score: lower = more independent):",
             f"- Overall: {HEADLINE.get(summary.headline_status, summary.headline_status)}"]
    for p in points:
        support = f"{round(p.support_score)}%" if p.support_score is not None else "not enough finished days"
        mood = f"{p.average_mood:g}/5" if p.average_mood is not None else "—"
        verdict = ("passed" if p.passed else "not passed") if p.complete else "in progress"
        level = p.level.value
        lines.append(
            f"- Dose {p.week_number} at {level.title()} level ({_gas(level)}), {p.week_start}–{p.week_end}: "
            f"Support Score {support}, mood {mood}, practice days finished {p.finished_count}/5, "
            f"Real-Life Try {'passed' if p.real_life_try_passed else 'not passed yet'}, {verdict}"
        )
    if summary.fast_track_offered:
        lines.append("- Play Hub signal: the last 3 Sessions were independent with good mood: ready to move up a level.")
    if summary.move_down_offered:
        lines.append("- Play Hub signal: the last 3 Sessions needed hands-on help, stopped early or had low mood: "
                     "consider moving down a level.")
    if any(p.consult_suggested for p in points[-1:]):
        lines.append("- Play Hub signal: a Play Consult is suggested.")
    return lines


def play_pulse_context(db: Session, child: Child) -> list[str]:
    """The child's latest Play Pulse, taken by someone who looks after them, matched by first name."""
    adults = {child.owner_id, child.admin_id, *child.moderator_ids} - {None}
    if not adults:
        return []
    first = child.name.split()[0].lower() if child.name.split() else ""
    rows = db.scalars(
        select(PlayPulseResult).where(PlayPulseResult.user_id.in_(adults))
        .order_by(PlayPulseResult.created_at.desc()).limit(20)
    ).all()
    result = next((r for r in rows if r.child_name.split() and r.child_name.split()[0].lower() == first), None)
    if not result:
        return []
    domains = ", ".join(f"{name}: {PULSE_TIER.get(tier, tier)}" for name, tier in (result.domain_tiers or {}).items())
    return [
        f"Latest Play Pulse ({_as_utc(result.created_at).date().isoformat()}, as a "
        f"{PULSE_BAND.get(result.age_band, result.age_band)}, goal: {result.goal_name}): "
        f"Support Score {result.support_score}% ({PULSE_TIER.get(result.tier, result.tier)}); {domains}. "
        "This is Play Hub's own quick check, not a screener: never call it a diagnosis or an assessment score."
    ]


def steps_open(db: Session, user: User, activity: Activity) -> bool:
    """Whether this person may see the Activity's steps: the same free-tier rule as the catalogue."""
    from app.api import _free_dose_id, _open_play_plan_ids  # local import: app.api is the larger module

    open_ids = _open_play_plan_ids(db, user)
    if open_ids is None:
        return True
    plan = activity.play_dose.play_plan
    doses = [dose for dose in plan.play_doses if dose.is_active]
    return plan.id in open_ids and _free_dose_id(doses) == activity.play_dose_id


def activity_context(activity: Activity, with_steps: bool = True) -> str:
    lines = [
        f"The adult is asking about this Activity: {activity.title}",
        f"(Play Plan: {activity.play_dose.play_plan.name}; Play Dose: {activity.play_dose.title})",
    ]
    if activity.duration_minutes:
        lines.append(f"Suggested time: {activity.duration_minutes} minutes")
    steps = [step for step in activity.instructions or [] if step.strip()][:MAX_STEPS] if with_steps else []
    if not with_steps:
        lines.append("(This Activity is locked on the free plan: do not describe its steps; you may suggest subscribing.)")
    if steps:
        lines.append("Steps:")
        lines.extend(f"{i}. {step}" for i, step in enumerate(steps, 1))
    return "\n".join(lines)


def build_instructions(
    db: Session, child: Child | None, activity: Activity | None, user: User, first_reply: bool = True,
    mode: str | None = None, safety: bool = False,
) -> str:
    sections = [
        build_rules(get_settings().attune_consult_url),
        f"You are talking with {user.display_name}. "
        + ("This is the start of the conversation." if first_reply
           else "The conversation is already under way: don't greet them again."),
    ]
    if mode in MODE_GUIDANCE:
        sections.append(MODE_GUIDANCE[mode])
    if safety:
        sections.append(SAFETY_OVERRIDE)
    if child:
        sections.append("Child context:\n" + child_context(db, child, user=user))
    if activity:
        sections.append(activity_context(activity, with_steps=steps_open(db, user, activity)))
    return "\n\n".join(sections)


# ---------- Helpers ----------

def _used_today(db: Session, user: User) -> int:
    start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
    return db.scalar(
        select(func.count(AttuneMessage.id))
        .join(AttuneConversation, AttuneConversation.id == AttuneMessage.conversation_id)
        .where(AttuneConversation.user_id == user.id, AttuneMessage.role == "user", AttuneMessage.created_at >= start)
    ) or 0


def _on_free_plan(db: Session, user: User) -> bool:
    """The free tier, decided the same way as the Play Plan catalogue's locks."""
    from app.api import _open_play_plan_ids  # local import: app.api is the larger module

    return _open_play_plan_ids(db, user) is not None


def _own_conversation(db: Session, conversation_id: str, user: User) -> AttuneConversation:
    conversation = db.get(AttuneConversation, conversation_id)
    if not conversation or conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _child(db: Session, child_id: str, user: User) -> Child:
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    require_child_access(child, user)
    return child


def _title(message: str) -> str:
    text = " ".join(message.split())
    return text if len(text) <= 80 else text[:77].rstrip() + "…"


# ---------- Routes ----------

@router.get("/status", response_model=AttuneStatus)
def attune_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    used = _used_today(db, user)
    free = _on_free_plan(db, user)
    settings = get_settings()
    limit = 0 if free else min(30, max(0, settings.attune_daily_limit))
    return AttuneStatus(
        enabled=attune_enabled(),
        daily_limit=limit,
        used_today=used,
        remaining_today=max(0, limit - used),
        free_plan=free,
    )


@router.get("/conversations", response_model=list[AttuneConversationRead])
def list_conversations(child_id: str | None = Query(default=None), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    query = select(AttuneConversation).where(AttuneConversation.user_id == user.id)
    if child_id:
        query = query.where(AttuneConversation.child_id == child_id)
    return db.scalars(query.order_by(AttuneConversation.updated_at.desc()).limit(50)).all()


@router.get("/conversations/{conversation_id}", response_model=AttuneConversationDetail)
def get_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _own_conversation(db, conversation_id, user)


@router.patch("/conversations/{conversation_id}", response_model=AttuneConversationRead)
def rename_conversation(conversation_id: str, payload: AttuneRename, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    conversation = _own_conversation(db, conversation_id, user)
    title = " ".join(payload.title.split())
    if not title:
        raise HTTPException(status_code=422, detail="Please give the chat a name.")
    conversation.title = title[:160]
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/insights", response_model=AttuneInsights)
def insights(_: User = Depends(require_permission("progress")), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    questions = select(AttuneMessage).where(AttuneMessage.role == "user")

    def count_since(start: datetime) -> int:
        return db.scalar(select(func.count()).select_from(questions.where(AttuneMessage.created_at >= start).subquery())) or 0

    month_ago = today - timedelta(days=29)
    recent = db.execute(
        select(AttuneMessage.created_at, AttuneConversation.user_id, AttuneConversation.child_id)
        .join(AttuneConversation, AttuneConversation.id == AttuneMessage.conversation_id)
        .where(AttuneMessage.role == "user", AttuneMessage.created_at >= month_ago)
    ).all()
    per_day: dict[date, int] = {}
    for created_at, _user_id, _child_id in recent:
        day = _as_utc(created_at).date()
        per_day[day] = per_day.get(day, 0) + 1
    safety_answers = db.scalar(
        select(func.count(AttuneMessage.id)).where(
            AttuneMessage.role == "assistant", AttuneMessage.safety.is_(True), AttuneMessage.created_at >= month_ago)
    ) or 0
    shared = db.scalar(
        select(func.count(AttuneMessage.id)).where(
            AttuneMessage.summary.is_not(None), AttuneMessage.created_at >= month_ago)
    ) or 0
    ratings = dict(db.execute(
        select(AttuneMessage.feedback, func.count()).where(AttuneMessage.feedback.is_not(None))
        .group_by(AttuneMessage.feedback)
    ).all())
    return AttuneInsights(
        questions_today=count_since(today),
        questions_7_days=count_since(today - timedelta(days=6)),
        questions_30_days=len(recent),
        people_30_days=len({row[1] for row in recent}),
        children_30_days=len({row[2] for row in recent if row[2]}),
        rated_up=ratings.get("up", 0),
        rated_down=ratings.get("down", 0),
        safety_30_days=safety_answers,
        shared_30_days=shared,
        daily=[
            {"date": (today - timedelta(days=offset)).date().isoformat(),
             "questions": per_day.get((today - timedelta(days=offset)).date(), 0)}
            for offset in range(13, -1, -1)
        ],
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_conversation(db, conversation_id, user))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/messages/{message_id}/feedback", response_model=AttuneMessageRead)
def rate_answer(message_id: str, payload: AttuneFeedback, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """Thumbs up or down on one of Attune's answers (or clear it), so the team can see what helps."""
    message = db.get(AttuneMessage, message_id)
    if not message or message.role != "assistant" or message.conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Answer not found")
    message.feedback = payload.value
    db.commit()
    db.refresh(message)
    return message


@router.post("/messages/{message_id}/summary", response_model=AttuneSummary)
def summarise(message_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """"Share this": a plain-language handover note of the conversation up to this answer, written
    once and kept, so tapping again is instant and costs nothing."""
    message = db.get(AttuneMessage, message_id)
    if not message or message.role != "assistant" or message.conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Answer not found")
    if message.summary:
        return AttuneSummary(summary=message.summary)
    if not attune_enabled():
        raise HTTPException(status_code=503, detail="Attune isn’t switched on yet.")
    turns = [m for m in message.conversation.messages if m.created_at <= message.created_at][-HISTORY_MESSAGES:]
    transcript = "\n\n".join(f"{'Parent' if m.role == 'user' else 'Guidance'}: {m.content}" for m in turns)
    try:
        summary = plain_summary(ask_model(SUMMARY_INSTRUCTIONS, [{"role": "user", "content": transcript}]))
    except AttuneUnavailable:
        raise HTTPException(status_code=502, detail="The summary couldn’t be written just now. Please try again.") from None
    if not summary:
        raise HTTPException(status_code=502, detail="The summary couldn’t be written just now. Please try again.")
    message.summary = summary
    audit(db, user.id, "attune.shared", "attune_conversation", message.conversation_id)
    db.commit()
    return AttuneSummary(summary=summary)


@router.get("/sources")
def source_register(_: User = Depends(require_permission("progress"))):
    """The versioned clinical source register behind Attune's references (Blueprint section 7)."""
    return register()


FAILED = "Attune couldn’t answer just now. Please try again in a moment."


@dataclass
class _Question:
    message: str
    conversation_id: str | None
    child_id: str | None
    activity_id: str | None
    history: list[dict[str, str]]
    instructions: str
    used_today: int
    daily_limit: int
    asked_at: datetime
    mode: str | None = None
    # The question itself matched a danger phrase (see attune_rules.safety_concern).
    safety_flag: bool = False

    @property
    def kind(self) -> str:
        return self.mode or "general"


def _prepare(payload: AttuneAsk, user: User, db: Session) -> _Question:
    """Every check that can refuse a question, done before anything is sent to the model."""
    if not attune_enabled():
        raise HTTPException(status_code=503, detail="Attune isn’t switched on yet.")
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Please type a question.")

    conversation = _own_conversation(db, payload.conversation_id, user) if payload.conversation_id else None
    child_id = conversation.child_id if conversation else payload.child_id
    child = _child(db, child_id, user) if child_id else None
    activity = db.get(Activity, payload.activity_id) if payload.activity_id else None
    if payload.activity_id and not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    used = _used_today(db, user)
    free = _on_free_plan(db, user)
    settings = get_settings()
    if free:
        raise HTTPException(
            status_code=403,
            detail="Attune is available on a paid plan. Subscribe to ask up to 30 questions a day.",
        )
    limit = min(30, max(0, settings.attune_daily_limit))
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"You’ve asked Attune {limit} questions today. Please come back tomorrow.",
        )
    history = [{"role": m.role, "content": m.content} for m in (conversation.messages if conversation else [])]
    flagged = safety_concern(message)
    return _Question(
        message=message,
        conversation_id=conversation.id if conversation else None,
        child_id=child.id if child else None,
        activity_id=activity.id if activity else None,
        history=history[-HISTORY_MESSAGES:] + [{"role": "user", "content": message}],
        instructions=build_instructions(db, child, activity, user, first_reply=not history,
                                        mode=payload.mode, safety=flagged),
        used_today=used,
        daily_limit=limit,
        asked_at=datetime.now(timezone.utc),
        mode=payload.mode,
        safety_flag=flagged,
    )


def _save(db: Session, user: User, question: _Question, raw_reply: str) -> AttuneAnswer:
    """Store the question and answer. Only done after a full answer, so a failed try doesn't count
    against the daily limit. The reply's hidden [[refs: …]] line becomes the references panel."""
    reply, ids, model_safety = split_reply(raw_reply)
    # A question that matched a danger phrase always shows the emergency contacts, whatever the model did.
    safety = model_safety or question.safety_flag
    if not reply:
        raise AttuneUnavailable
    conversation = db.get(AttuneConversation, question.conversation_id) if question.conversation_id else None
    if not conversation:
        conversation = AttuneConversation(user_id=user.id, child_id=question.child_id, title=_title(question.message))
        db.add(conversation)
        db.flush()
    answered_at = max(datetime.now(timezone.utc), question.asked_at + timedelta(microseconds=1))
    asked = AttuneMessage(conversation_id=conversation.id, role="user", content=question.message,
                          activity_id=question.activity_id, mode=question.mode, created_at=question.asked_at)
    answer = AttuneMessage(
        conversation_id=conversation.id, role="assistant", content=reply, mode=question.mode, safety=safety,
        sources=references_for(ids, "safety" if safety else question.kind), created_at=answered_at,
    )
    db.add_all([asked, answer])
    conversation.updated_at = answered_at
    # Only the fact of the question is audited; the conversation itself stays private to the asker.
    audit(db, user.id, "attune.asked", "attune_conversation", conversation.id,
          {"child_id": question.child_id, "mode": question.mode, "safety": safety})
    db.commit()
    for row in (conversation, asked, answer):
        db.refresh(row)
    return AttuneAnswer(
        conversation=AttuneConversationRead.model_validate(conversation),
        question=AttuneMessageRead.model_validate(asked),
        answer=AttuneMessageRead.model_validate(answer),
        remaining_today=max(0, question.daily_limit - question.used_today - 1),
    )


@router.post("/ask", response_model=AttuneAnswer)
def ask(payload: AttuneAsk, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    question = _prepare(payload, user, db)
    try:
        return _save(db, user, question, ask_model(question.instructions, question.history))
    except AttuneUnavailable:
        raise HTTPException(status_code=502, detail=FAILED) from None


@router.post("/ask/stream")
def ask_stream(payload: AttuneAsk, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The answer as newline-delimited JSON while it is written: {"type": "delta", "text": …} pieces,
    then {"type": "done", …the saved answer…} or {"type": "error", "detail": …}. Refusals (switched off,
    daily limit, no access) are ordinary HTTP errors before the stream starts."""
    question = _prepare(payload, user, db)

    def line(event: dict) -> str:
        return json.dumps(event, default=str) + "\n"

    def events() -> Iterator[str]:
        # The hidden [[refs: …]] line is held back from the adult as it arrives; only text they
        # should read is sent as deltas.
        raw, sent = "", ""
        try:
            for piece in stream_model(question.instructions, question.history):
                raw += piece
                visible = visible_text(raw)
                if visible.startswith(sent) and len(visible) > len(sent):
                    yield line({"type": "delta", "text": visible[len(sent):]})
                    sent = visible
            saved = _save(db, user, question, raw)
        except AttuneUnavailable:
            yield line({"type": "error", "detail": FAILED})
            return
        yield line({"type": "done", **saved.model_dump(mode="json")})

    return StreamingResponse(
        events(), media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
