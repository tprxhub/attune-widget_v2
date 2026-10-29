import pytest

from app import attune
from app.attune_rules import INSTRUCTIONS, MODE_GUIDANCE
from app.config import get_settings
from app.models import AuditEvent, SiteContent
from conftest import TestingSession
from test_attune import subscribe
from test_free_play_plan import register_family
from test_google_and_billing import _ttp_employee

URL = "/api/v1/attune/settings"


@pytest.fixture
def model(monkeypatch):
    """Attune switched on (DeepInfra) with the model call recorded instead of made."""
    settings = get_settings()
    monkeypatch.setattr(settings, "attune_provider", "deepinfra")
    monkeypatch.setattr(settings, "deepinfra_api_key", "sk-di-test")
    monkeypatch.setattr(settings, "attune_daily_limit", 30)
    monkeypatch.setattr(attune, "_on_free_plan", lambda _db, _user: False)
    calls = []

    def fake(instructions, conversation, config=None):
        calls.append({"instructions": instructions, "conversation": conversation, "config": config})
        return "Try chunky pegs.\n[[refs: nmt]]"

    monkeypatch.setattr(attune, "ask_model", fake)
    return calls


def edited(client, headers, **changes):
    settings = client.get(URL, headers=headers).json()["settings"]
    for key, value in changes.items():
        if isinstance(value, dict):
            settings[key] = {**settings[key], **value}
        else:
            settings[key] = value
    return settings


def test_only_a_super_admin_sees_or_changes_attune_settings(client, platform_admin, model):
    family = register_family(client, "settings-family@example.com")
    staff = _ttp_employee(client, platform_admin, ["progress", "children"])
    for headers in (family, staff):
        assert client.get(URL, headers=headers).status_code == 403
        assert client.put(URL, headers=headers, json={}).status_code == 403
        assert client.delete(URL, headers=headers).status_code == 403
        assert client.post(f"{URL}/test", headers=headers, json={}).status_code == 403

    data = client.get(URL, headers=platform_admin).json()
    assert data["customised"] == [] and data["updated_at"] is None
    assert data["provider"] == "deepinfra" and data["key_configured"] is True
    assert data["settings"] == data["defaults"]
    assert data["settings"]["instructions"] == INSTRUCTIONS
    assert data["settings"]["mode_guidance"]["idea"] == MODE_GUIDANCE["idea"]
    assert data["settings"]["daily_limit"] == 30 and data["settings"]["enabled"] is True
    # The API key is a server secret: it is never part of the settings.
    assert "sk-di-test" not in str(data)


def test_saved_settings_shape_every_question_and_only_changes_are_stored(client, platform_admin, model):
    custom_prompt = "You are Attune, speaking like a calm play coach.\n" + "Keep it short. " * 20 + "\n{sources}"
    settings = edited(
        client, platform_admin,
        instructions=custom_prompt,
        mode_guidance={"idea": "THIS QUESTION: give exactly one idea."},
        mode_labels={"regulation": "Hard moment"},
        daily_limit=2,
        model="meta-llama/Llama-3.3-70B-Instruct",
        temperature=0.2,
    )
    saved = client.put(URL, headers=platform_admin, json=settings)
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert sorted(body["customised"]) == [
        "daily_limit", "instructions", "mode_guidance.idea", "mode_labels.regulation", "model", "temperature",
    ]
    assert body["updated_by_name"] == "Platform Admin" and body["updated_at"]

    with TestingSession() as db:
        stored = db.get(SiteContent, "attune").content
        event = db.query(AuditEvent).filter(AuditEvent.action == "site_content.attune_updated").one()
    # Untouched texts aren't copied, so they keep following the code.
    assert set(stored) == {"instructions", "mode_guidance", "mode_labels", "daily_limit", "model", "temperature"}
    assert stored["mode_guidance"] == {"idea": "THIS QUESTION: give exactly one idea."}
    # The audit log names what changed, never the text.
    assert "calm play coach" not in str(event.metadata_json)
    assert "instructions" in event.metadata_json["fields"]

    family = register_family(client, "settings-ask@example.com")
    subscribe(client, family)
    status = client.get("/api/v1/attune/status", headers=family).json()
    assert status["daily_limit"] == 2
    assert status["mode_labels"]["regulation"] == "Hard moment"

    answer = client.post("/api/v1/attune/ask", headers=family, json={"message": "Pegs?", "mode": "idea"})
    assert answer.status_code == 200, answer.text
    sent = model[-1]
    assert sent["instructions"].startswith("You are Attune, speaking like a calm play coach.")
    assert "{sources}" not in sent["instructions"]  # replaced by the reference list
    assert "THIS QUESTION: give exactly one idea." in sent["instructions"]
    assert sent["config"].model == "meta-llama/Llama-3.3-70B-Instruct"
    assert sent["config"].temperature == 0.2

    assert client.post("/api/v1/attune/ask", headers=family, json={"message": "Again"}).status_code == 200
    limited = client.post("/api/v1/attune/ask", headers=family, json={"message": "Third"})
    assert limited.status_code == 429 and "2 questions today" in limited.json()["detail"]


def test_settings_are_checked_before_saving(client, platform_admin, model):
    base = client.get(URL, headers=platform_admin).json()["settings"]
    for change in (
        {"instructions": base["instructions"].replace("{sources}", "")},
        {"consult_url": "http://example.com/book"},
        {"daily_limit": 101},
        {"temperature": 2},
        {"model": "  "},
        {"mode_labels": {**base["mode_labels"], "idea": ""}},
    ):
        response = client.put(URL, headers=platform_admin, json={**base, **change})
        assert response.status_code == 422, change
    with TestingSession() as db:
        assert db.get(SiteContent, "attune") is None


def test_switching_attune_off_and_resetting(client, platform_admin, model):
    assert client.put(URL, headers=platform_admin, json=edited(client, platform_admin, enabled=False)).status_code == 200
    family = register_family(client, "settings-off@example.com")
    subscribe(client, family)
    assert client.get("/api/v1/attune/status", headers=family).json()["enabled"] is False
    refused = client.post("/api/v1/attune/ask", headers=family, json={"message": "Hello"})
    assert refused.status_code == 503 and "switched off" in refused.json()["detail"]
    assert model == []

    reset = client.delete(URL, headers=platform_admin)
    assert reset.status_code == 200 and reset.json()["customised"] == []
    assert client.get("/api/v1/attune/status", headers=family).json()["enabled"] is True

    # Saving settings identical to the defaults stores nothing.
    defaults = client.get(URL, headers=platform_admin).json()["defaults"]
    assert client.put(URL, headers=platform_admin, json=defaults).json()["customised"] == []
    with TestingSession() as db:
        assert db.get(SiteContent, "attune") is None


def test_a_draft_can_be_tried_without_saving_it(client, platform_admin, model, monkeypatch):
    draft = edited(client, platform_admin, enabled=False,
                   instructions="DRAFT PROMPT for testing only. " + "Be warm. " * 30 + "{sources}")
    tried = client.post(f"{URL}/test", headers=platform_admin,
                        json={"settings": draft, "message": "How do I help with pencil grip?", "mode": "idea"})
    assert tried.status_code == 200, tried.text
    result = tried.json()
    assert result["answer"] == "Try chunky pegs."
    assert [ref["id"] for ref in result["references"]] == ["nmt"]
    assert result["safety"] is False
    assert model[-1]["instructions"].startswith("DRAFT PROMPT for testing only.")
    # Nothing was saved, nothing was asked on anyone's behalf, and Attune stays as it was.
    assert client.get(URL, headers=platform_admin).json()["customised"] == []
    assert client.get("/api/v1/attune/conversations", headers=platform_admin).json() == []

    def broken(*_):
        raise attune.AttuneUnavailable

    monkeypatch.setattr(attune, "ask_model", broken)
    failed = client.post(f"{URL}/test", headers=platform_admin, json={"settings": draft, "message": "Hi"})
    assert failed.status_code == 502 and "model name" in failed.json()["detail"]


def test_the_model_settings_reach_the_provider(monkeypatch):
    sent = {}

    def capture(url, key, body):
        sent.update(body)
        return {"choices": [{"message": {"content": "Hello"}}]}

    monkeypatch.setattr(get_settings(), "attune_provider", "deepinfra")
    monkeypatch.setattr(attune, "_post", capture)
    config = attune.attune_config.defaults().model_copy(
        update={"model": "some/model", "temperature": 0.3, "max_answer_tokens": 900})
    assert attune.ask_model("Be kind", [{"role": "user", "content": "Help"}], config) == "Hello"
    assert sent["model"] == "some/model" and sent["temperature"] == 0.3 and sent["max_tokens"] == 900


def test_the_share_note_uses_the_saved_summary_instructions(client, platform_admin, model):
    settings = edited(client, platform_admin, summary_instructions="Write one friendly sentence only.")
    assert client.put(URL, headers=platform_admin, json=settings).status_code == 200
    family = register_family(client, "settings-share@example.com")
    subscribe(client, family)
    answer = client.post("/api/v1/attune/ask", headers=family, json={"message": "Pegs?"}).json()["answer"]
    note = client.post(f"/api/v1/attune/messages/{answer['id']}/summary", headers=family)
    assert note.status_code == 200, note.text
    assert model[-1]["instructions"] == "Write one friendly sentence only."
