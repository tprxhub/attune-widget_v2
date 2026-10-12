"""Attune: the AI play assistant. Parents, Moderators and staff ask questions about a child's play;
answers come from a language model with the child's Play Plan and recent Sessions as context.

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
from app.models import Activity, Attempt, AttuneConversation, AttuneMessage, Child, User
from app.services import audit

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

INSTRUCTIONS = """You are Attune™, the play assistant inside Play Hub by The Toy Pharmacy.
You help parents, teachers and therapists support young children's fine motor development through play.

Play Hub words (use them the same way):
- Play Plan: a goal area, e.g. "Pinch & Grip Development".
- Play Dose: a short set of play Activities inside a Play Plan, at a level (Rookie, Starter, Pro).
- Session: one logged try of an Activity, with how it went (finished / partly / stopped early),
  how much help the child needed, and their mood (1–5).
- Real-Life Try: using the new skill in everyday life. Big Win: a moment worth celebrating.
- Play Pulse: a short check that suggests which Play Plan to focus on.

How to answer:
- Be warm, practical and brief. Start with the most useful idea. Use short bullet points.
- Give concrete changes the adult can make today: make it easier (bigger pieces, fewer steps,
  hand-over-hand), make it harder, change the position, make it a game, shorten the Session.
- Use the child context below when it helps. Never invent Sessions, scores or details you were not given.
  If you need to know something (age, what happened), ask one short question.
- Answer the question first. Greet the adult by name only in your first reply of a conversation,
  and don't open every answer with praise or a recap of the child's progress.
- Celebrate effort and Big Wins when it fits. Keep frustration low: suggest stopping on a success.
- You only see the most recent Sessions listed below. If asked about older ones, say you can't see
  them rather than saying they don't exist; point the adult to the Progress page for the full history.
- You are not a doctor or therapist and you do not diagnose. If the adult describes pain, regression,
  loss of skills, safety concerns or worries about development, gently suggest speaking to their
  paediatrician or an occupational therapist.
- Safety: remind adults to supervise small objects with young children.
- Answer in the language the adult writes in. Only answer questions about children, play,
  development, parenting routines and using Play Hub; politely steer other topics back."""


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


class AttuneAsk(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    child_id: str | None = None
    activity_id: str | None = None


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
    daily: list[dict]  # [{"date": "2026-10-12", "questions": 4}, …] for the last 14 days


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


def child_context(db: Session, child: Child, today: date | None = None) -> str:
    today = today or date.today()
    lines = [f"Child: {child.name}"]
    if age := _age(child.date_of_birth, today):
        lines.append(f"Age: {age}")
    lines.append("Account: family" if child.account_scope.value == "individual" else "Account: school or clinic")
    dose = child.current_play_dose
    if dose:
        lines.append(f"Current Play Plan: {dose.play_plan.name}")
        lines.append(f"Current Play Dose: {dose.title} ({dose.level.value.title()} level)")
        if dose.smart_goal:
            lines.append(f"Goal of this Play Dose: {dose.smart_goal}")
        activities = [a.title for a in sorted(dose.activities, key=lambda a: a.sequence)]
        if activities:
            lines.append("Activities in this Play Dose: " + "; ".join(activities))
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
    else:
        lines.append("No Sessions logged yet.")
    return "\n".join(lines)


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
    db: Session, child: Child | None, activity: Activity | None, user: User, first_reply: bool = True
) -> str:
    sections = [
        INSTRUCTIONS,
        f"You are talking with {user.display_name}. "
        + ("This is the start of the conversation." if first_reply
           else "The conversation is already under way: don't greet them again."),
    ]
    if child:
        sections.append("Child context:\n" + child_context(db, child))
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
    settings = get_settings()
    used = _used_today(db, user)
    return AttuneStatus(
        enabled=attune_enabled(),
        daily_limit=settings.attune_daily_limit,
        used_today=used,
        remaining_today=max(0, settings.attune_daily_limit - used),
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
    asked_at: datetime


def _prepare(payload: AttuneAsk, user: User, db: Session) -> _Question:
    """Every check that can refuse a question, done before anything is sent to the model."""
    settings = get_settings()
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
    if used >= settings.attune_daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"You’ve asked Attune {settings.attune_daily_limit} questions today. Please come back tomorrow.",
        )
    history = [{"role": m.role, "content": m.content} for m in (conversation.messages if conversation else [])]
    return _Question(
        message=message,
        conversation_id=conversation.id if conversation else None,
        child_id=child.id if child else None,
        activity_id=activity.id if activity else None,
        history=history[-HISTORY_MESSAGES:] + [{"role": "user", "content": message}],
        instructions=build_instructions(db, child, activity, user, first_reply=not history),
        used_today=used,
        asked_at=datetime.now(timezone.utc),
    )


def _save(db: Session, user: User, question: _Question, reply: str) -> AttuneAnswer:
    """Store the question and answer. Only done after a full answer, so a failed try doesn't count
    against the daily limit."""
    conversation = db.get(AttuneConversation, question.conversation_id) if question.conversation_id else None
    if not conversation:
        conversation = AttuneConversation(user_id=user.id, child_id=question.child_id, title=_title(question.message))
        db.add(conversation)
        db.flush()
    answered_at = max(datetime.now(timezone.utc), question.asked_at + timedelta(microseconds=1))
    asked = AttuneMessage(conversation_id=conversation.id, role="user", content=question.message,
                          activity_id=question.activity_id, created_at=question.asked_at)
    answer = AttuneMessage(conversation_id=conversation.id, role="assistant", content=reply, created_at=answered_at)
    db.add_all([asked, answer])
    conversation.updated_at = answered_at
    # Only the fact of the question is audited; the conversation itself stays private to the asker.
    audit(db, user.id, "attune.asked", "attune_conversation", conversation.id, {"child_id": question.child_id})
    db.commit()
    for row in (conversation, asked, answer):
        db.refresh(row)
    return AttuneAnswer(
        conversation=AttuneConversationRead.model_validate(conversation),
        question=AttuneMessageRead.model_validate(asked),
        answer=AttuneMessageRead.model_validate(answer),
        remaining_today=max(0, get_settings().attune_daily_limit - question.used_today - 1),
    )


@router.post("/ask", response_model=AttuneAnswer)
def ask(payload: AttuneAsk, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    question = _prepare(payload, user, db)
    try:
        reply = ask_model(question.instructions, question.history)
    except AttuneUnavailable:
        raise HTTPException(status_code=502, detail=FAILED) from None
    return _save(db, user, question, reply)


@router.post("/ask/stream")
def ask_stream(payload: AttuneAsk, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The answer as newline-delimited JSON while it is written: {"type": "delta", "text": …} pieces,
    then {"type": "done", …the saved answer…} or {"type": "error", "detail": …}. Refusals (switched off,
    daily limit, no access) are ordinary HTTP errors before the stream starts."""
    question = _prepare(payload, user, db)

    def line(event: dict) -> str:
        return json.dumps(event, default=str) + "\n"

    def events() -> Iterator[str]:
        parts: list[str] = []
        try:
            for piece in stream_model(question.instructions, question.history):
                parts.append(piece)
                yield line({"type": "delta", "text": piece})
        except AttuneUnavailable:
            yield line({"type": "error", "detail": FAILED})
            return
        reply = "".join(parts).strip()
        if not reply:
            yield line({"type": "error", "detail": FAILED})
            return
        yield line({"type": "done", **_save(db, user, question, reply).model_dump(mode="json")})

    return StreamingResponse(
        events(), media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
