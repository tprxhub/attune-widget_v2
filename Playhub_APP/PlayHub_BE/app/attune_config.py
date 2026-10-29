"""Attune settings a Super Admin can change from Play Hub: the prompt, the guidance for each way into
Attune, the safety and handover texts, the labels people see, and the model and daily limit.

Only what differs from the built-in defaults is stored (one SiteContent row, key "attune"), so text
nobody has changed keeps following the code. The model provider and its API key stay in the server's
environment: they are secrets and are never shown or changed here.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.attune_rules import INSTRUCTIONS, MODE_GUIDANCE, SAFETY_OVERRIDE, SUMMARY_INSTRUCTIONS
from app.config import get_settings
from app.models import SiteContent

KEY = "attune"
SOURCES_PLACEHOLDER = "{sources}"
# The server setting (ATTUNE_DAILY_LIMIT) is capped at 30 questions a day, as before; a Super Admin
# can choose any limit up to 100 here.
DEFAULT_DAILY_CAP = 30
MAX_DAILY_LIMIT = 100

MODE_LABELS = {
    "idea": "Get an idea",
    "regulation": "My member is struggling",
    "progress": "What does this mean?",
}


class ModeTexts(BaseModel):
    idea: str = Field(min_length=1, max_length=8000)
    regulation: str = Field(min_length=1, max_length=8000)
    progress: str = Field(min_length=1, max_length=8000)

    @field_validator("idea", "regulation", "progress")
    @classmethod
    def _trimmed(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("can't be empty")
        return value


class ModeLabels(ModeTexts):
    idea: str = Field(min_length=1, max_length=60)
    regulation: str = Field(min_length=1, max_length=60)
    progress: str = Field(min_length=1, max_length=60)


class AttuneConfig(BaseModel):
    enabled: bool = True
    daily_limit: int = Field(ge=0, le=MAX_DAILY_LIMIT)
    consult_url: str = Field(min_length=1, max_length=500)
    model: str = Field(min_length=1, max_length=200)
    temperature: float = Field(ge=0, le=1.5)
    max_answer_tokens: int = Field(ge=200, le=8000)
    instructions: str = Field(min_length=200, max_length=60000)
    mode_guidance: ModeTexts
    mode_labels: ModeLabels
    safety_override: str = Field(min_length=1, max_length=8000)
    summary_instructions: str = Field(min_length=1, max_length=8000)

    @field_validator("consult_url")
    @classmethod
    def _https(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("https://"):
            raise ValueError("must be a full https:// link")
        return value

    @field_validator("model", "instructions", "safety_override", "summary_instructions")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("can't be empty")
        return value

    @field_validator("instructions")
    @classmethod
    def _keeps_sources(cls, value: str) -> str:
        # Answers name their references from the list put in place of {sources}; without it the
        # research icon would always be empty.
        if SOURCES_PLACEHOLDER not in value:
            raise ValueError("must keep {sources}, where Attune's reference list is inserted")
        return value


def defaults() -> AttuneConfig:
    settings = get_settings()
    deepinfra = settings.attune_provider == "deepinfra"
    return AttuneConfig(
        enabled=True,
        daily_limit=min(DEFAULT_DAILY_CAP, max(0, settings.attune_daily_limit)),
        consult_url=settings.attune_consult_url,
        model=settings.deepinfra_model if deepinfra else settings.openai_model,
        temperature=0.6,
        max_answer_tokens=1500 if deepinfra else 4000,
        instructions=INSTRUCTIONS,
        mode_guidance=ModeTexts(**MODE_GUIDANCE),
        mode_labels=ModeLabels(**MODE_LABELS),
        safety_override=SAFETY_OVERRIDE,
        summary_instructions=SUMMARY_INSTRUCTIONS,
    )


def _merge(base: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        elif key in merged:
            merged[key] = value
    return merged


def stored_changes(db: Session) -> dict[str, Any]:
    row = db.get(SiteContent, KEY)
    return dict(row.content) if row and isinstance(row.content, dict) else {}


def load(db: Session) -> AttuneConfig:
    """The settings in force: the defaults with any saved changes on top. A saved value that no
    longer passes validation (for example after a limit changed in code) falls back to its default
    rather than switching Attune off."""
    base = defaults().model_dump()
    config = base
    for key, value in stored_changes(db).items():
        candidate = _merge(config, {key: value})
        try:
            AttuneConfig.model_validate(candidate)
        except ValidationError:
            continue
        config = candidate
    return AttuneConfig.model_validate(config)


def changes_from_defaults(config: AttuneConfig) -> dict[str, Any]:
    """Only the fields (and, for the per-mode texts, the modes) that differ from the defaults."""
    base = defaults().model_dump()
    changes: dict[str, Any] = {}
    for key, value in config.model_dump().items():
        if isinstance(value, dict):
            diff = {k: v for k, v in value.items() if base[key].get(k) != v}
            if diff:
                changes[key] = diff
        elif base[key] != value:
            changes[key] = value
    return changes


def changed_fields(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    """Names of the settings a save changed, for the audit log (never the text itself)."""
    names = []
    for key in sorted(set(before) | set(after)):
        old, new = before.get(key), after.get(key)
        if isinstance(old, dict) or isinstance(new, dict):
            old, new = old or {}, new or {}
            names.extend(f"{key}.{sub}" for sub in sorted(set(old) | set(new)) if old.get(sub) != new.get(sub))
        elif old != new:
            names.append(key)
    return names
