import httpx
import pytest

from app import attune
from app.config import get_settings
from test_free_play_plan import make_plan_with_steps, register_family


@pytest.fixture
def openai(monkeypatch):
    """Switch Attune on and record what would be sent to OpenAI instead of calling it."""
    settings = get_settings()
    monkeypatch.setattr(settings, "attune_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "attune_daily_limit", 30)
    calls = []

    def fake(instructions, conversation):
        calls.append({"instructions": instructions, "conversation": conversation})
        return f"Answer {len(calls)}"

    monkeypatch.setattr(attune, "ask_model", fake)
    return calls


def ask(client, headers, **body):
    return client.post("/api/v1/attune/ask", headers=headers, json=body)


def test_attune_is_off_without_an_api_key(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "attune_provider", "openai")
    monkeypatch.setattr(get_settings(), "openai_api_key", None)
    family = register_family(client, "off@example.com")
    assert client.get("/api/v1/attune/status", headers=family).json()["enabled"] is False
    assert ask(client, family, message="Hello").status_code == 503
    assert client.get("/api/v1/attune/status").status_code == 401


def test_a_conversation_keeps_its_history_and_child_context(client, openai):
    family = register_family(client, "chat@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]

    first = ask(client, family, message="  She gets frustrated with pegs  ", child_id=child["id"])
    assert first.status_code == 200
    body = first.json()
    assert body["conversation"]["title"] == "She gets frustrated with pegs"
    assert body["conversation"]["child_id"] == child["id"]
    assert body["answer"]["content"] == "Answer 1"
    assert body["remaining_today"] == 29
    assert "Child: Free Child" in openai[0]["instructions"]
    assert "No Sessions logged yet." in openai[0]["instructions"]

    conversation_id = body["conversation"]["id"]
    second = ask(client, family, message="What about tweezers?", conversation_id=conversation_id)
    assert second.status_code == 200
    assert [m["content"] for m in openai[1]["conversation"]] == [
        "She gets frustrated with pegs", "Answer 1", "What about tweezers?",
    ]

    detail = client.get(f"/api/v1/attune/conversations/{conversation_id}", headers=family).json()
    # Times always carry their zone, so browsers don't read UTC as local time.
    assert detail["updated_at"].endswith(("+00:00", "Z"))
    assert all(m["created_at"].endswith(("+00:00", "Z")) for m in detail["messages"])
    assert [(m["role"], m["content"]) for m in detail["messages"]] == [
        ("user", "She gets frustrated with pegs"), ("assistant", "Answer 1"),
        ("user", "What about tweezers?"), ("assistant", "Answer 2"),
    ]
    listed = client.get(f"/api/v1/attune/conversations?child_id={child['id']}", headers=family).json()
    assert [c["id"] for c in listed] == [conversation_id]
    status = client.get("/api/v1/attune/status", headers=family).json()
    assert status == {"enabled": True, "daily_limit": 30, "used_today": 2, "remaining_today": 28}


def test_sessions_and_the_current_play_dose_reach_the_context(client, platform_admin, openai):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Grip", "slug": "grip"}).json()
    dose = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin,
                       json={"level": "starter", "title": "Peg Power"}).json()
    activity = client.post(f"/api/v1/play-doses/{dose['id']}/activities", headers=platform_admin,
                           json={"sequence": 0, "title": "Peg Hand Switch", "instructions": ["Pass the peg", "Swap hands"]}).json()
    client.patch(f"/api/v1/play-plans/{plan['id']}", headers=platform_admin, json={"publication_status": "published"})
    child = client.post("/api/v1/children", headers=platform_admin, json={
        "name": "Amira", "account_scope": "individual", "current_play_dose_id": dose["id"],
    }).json()
    logged = client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin, json={
        "play_dose_id": dose["id"], "activity_id": activity["id"], "occurred_on": "2026-10-01",
        "completion_score": 3, "mood_score": 4, "big_win": "Used her left hand",
    })
    assert logged.status_code == 201, logged.text

    assert ask(client, platform_admin, message="Ideas?", child_id=child["id"], activity_id=activity["id"]).status_code == 200
    context = openai[0]["instructions"]
    assert "Current Play Plan: Grip" in context
    assert "Current Play Dose: Peg Power (Starter level)" in context
    assert "2026-10-01: Peg Hand Switch" in context and "mood 4/5" in context
    assert "Big Win: Used her left hand" in context
    assert "asking about this Activity: Peg Hand Switch" in context
    assert "1. Pass the peg" in context


def test_free_families_cannot_read_locked_steps_through_attune(client, platform_admin, openai):
    plan_id = make_plan_with_steps(client, platform_admin, "Locked Grip")
    activity_id = client.get("/api/v1/play-plans?include_inactive=true", headers=platform_admin).json()
    activity_id = next(p for p in activity_id if p["id"] == plan_id)["play_doses"][0]["activities"][0]["id"]
    family = register_family(client, "locked@example.com")
    assert ask(client, family, message="How do I do it?", activity_id=activity_id).status_code == 200
    assert "Do the thing" not in openai[0]["instructions"]
    assert "locked on the free plan" in openai[0]["instructions"]

    child = client.get("/api/v1/children", headers=family).json()[0]
    client.put(f"/api/v1/children/{child['id']}/free-play-plan", headers=family, json={"play_plan_id": plan_id})
    assert ask(client, family, message="And now?", activity_id=activity_id).status_code == 200
    assert "1. Do the thing" in openai[1]["instructions"]


def test_people_only_see_their_own_conversations_and_children(client, platform_admin, openai):
    family = register_family(client, "mine@example.com")
    other = register_family(client, "other@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    conversation_id = ask(client, family, message="Hi", child_id=child["id"]).json()["conversation"]["id"]

    assert ask(client, other, message="Hi", child_id=child["id"]).status_code == 403
    assert ask(client, other, message="Hi", conversation_id=conversation_id).status_code == 404
    assert client.get(f"/api/v1/attune/conversations/{conversation_id}", headers=other).status_code == 404
    assert client.delete(f"/api/v1/attune/conversations/{conversation_id}", headers=other).status_code == 404
    assert client.get("/api/v1/attune/conversations", headers=other).json() == []

    assert client.delete(f"/api/v1/attune/conversations/{conversation_id}", headers=family).status_code == 204
    assert client.get(f"/api/v1/attune/conversations/{conversation_id}", headers=family).status_code == 404
    events = client.get("/api/v1/audit-events", headers=platform_admin).json()
    asked = [e for e in events if e["action"] == "attune.asked"]
    assert asked and "Hi" not in str(asked[0]["metadata_json"])


def test_the_daily_limit_and_failed_answers(client, monkeypatch, openai):
    monkeypatch.setattr(get_settings(), "attune_daily_limit", 1)
    family = register_family(client, "limit@example.com")

    def broken(*_):
        raise attune.AttuneUnavailable

    monkeypatch.setattr(attune, "ask_model", broken)
    assert ask(client, family, message="One").status_code == 502
    assert client.get("/api/v1/attune/conversations", headers=family).json() == []  # nothing saved

    monkeypatch.setattr(attune, "ask_model", lambda *_: "Fine")
    assert ask(client, family, message="One").status_code == 200
    limited = ask(client, family, message="Two")
    assert limited.status_code == 429
    assert "1 questions today" in limited.json()["detail"]


def test_openai_request_and_reply_parsing(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "attune_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "openai_model", "gpt-5-test")
    monkeypatch.setattr(settings, "openai_reasoning_effort", "low")
    monkeypatch.setattr(settings, "openai_vector_store_id", "vs_123")
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, json=json, headers=headers)
        return httpx.Response(200, json={"output": [
            {"type": "reasoning", "summary": []},
            {"type": "message", "content": [{"type": "output_text", "text": "Try bigger pegs【4:0†guide.pdf】."}]},
        ]})

    monkeypatch.setattr(attune.httpx, "post", fake_post)
    reply = attune.ask_model("Be kind", [{"role": "user", "content": "Help"}])
    assert reply == "Try bigger pegs."
    assert sent["url"] == "https://api.openai.com/v1/responses"
    assert sent["headers"]["Authorization"] == "Bearer sk-test"
    assert sent["json"]["model"] == "gpt-5-test"
    assert sent["json"]["instructions"] == "Be kind"
    assert sent["json"]["input"] == [{"role": "user", "content": "Help"}]
    assert sent["json"]["reasoning"] == {"effort": "low"}
    assert sent["json"]["tools"] == [{"type": "file_search", "vector_store_ids": ["vs_123"]}]

    monkeypatch.setattr(settings, "openai_model", "gpt-4o-mini")
    attune.ask_model("Be kind", [{"role": "user", "content": "Help"}])
    assert "reasoning" not in sent["json"]  # only reasoning models get an effort setting

    monkeypatch.setattr(attune.httpx, "post", lambda *a, **k: httpx.Response(401, json={"error": {"message": "bad key"}}))
    with pytest.raises(attune.AttuneUnavailable):
        attune.ask_model("Be kind", [{"role": "user", "content": "Help"}])


def test_deepinfra_uses_chat_completions_and_hides_thinking(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "attune_provider", "deepinfra")
    monkeypatch.setattr(settings, "deepinfra_api_key", "di-test")
    monkeypatch.setattr(settings, "deepinfra_model", "deepseek-test")
    monkeypatch.setattr(settings, "openai_api_key", None)
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, json=json, headers=headers)
        return httpx.Response(200, json={"choices": [{"message": {
            "role": "assistant", "content": "<think>planning…</think>\n- Use chunky crayons",
        }}]})

    monkeypatch.setattr(attune.httpx, "post", fake_post)
    family = register_family(client, "deepinfra@example.com")
    assert client.get("/api/v1/attune/status", headers=family).json()["enabled"] is True
    answer = ask(client, family, message="Grip ideas?")
    assert answer.status_code == 200
    assert answer.json()["answer"]["content"] == "- Use chunky crayons"
    assert sent["url"] == "https://api.deepinfra.com/v1/openai/chat/completions"
    assert sent["headers"]["Authorization"] == "Bearer di-test"
    assert sent["json"]["model"] == "deepseek-test"
    assert sent["json"]["messages"][0]["role"] == "system"
    assert "You are Attune" in sent["json"]["messages"][0]["content"]
    assert sent["json"]["messages"][1:] == [{"role": "user", "content": "Grip ideas?"}]

    monkeypatch.setattr(settings, "deepinfra_api_key", None)
    assert client.get("/api/v1/attune/status", headers=family).json()["enabled"] is False


def stream_events(response):
    import json
    return [json.loads(line) for line in response.text.splitlines() if line]


def test_streamed_answers_arrive_in_pieces_and_are_saved_once_complete(client, monkeypatch, openai):
    monkeypatch.setattr(attune, "stream_model", lambda *_: iter(["Try ", "chunky ", "crayons."]))
    family = register_family(client, "stream@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]

    response = client.post("/api/v1/attune/ask/stream", headers=family,
                           json={"message": "Grip ideas?", "child_id": child["id"]})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    events = stream_events(response)
    assert [e["text"] for e in events if e["type"] == "delta"] == ["Try ", "chunky ", "crayons."]
    done = events[-1]
    assert done["type"] == "done"
    assert done["answer"]["content"] == "Try chunky crayons."
    assert done["remaining_today"] == 29
    conversation_id = done["conversation"]["id"]

    monkeypatch.setattr(attune, "stream_model", lambda _, history: iter([f"Seen {len(history)} messages"]))
    events = stream_events(client.post("/api/v1/attune/ask/stream", headers=family,
                                       json={"message": "More?", "conversation_id": conversation_id}))
    assert events[-1]["answer"]["content"] == "Seen 3 messages"
    detail = client.get(f"/api/v1/attune/conversations/{conversation_id}", headers=family).json()
    assert len(detail["messages"]) == 4


def test_a_stream_that_fails_saves_nothing_and_refusals_are_plain_errors(client, monkeypatch, openai):
    family = register_family(client, "stream-fail@example.com")

    def broken(*_):
        yield "Half an ans"
        raise attune.AttuneUnavailable

    monkeypatch.setattr(attune, "stream_model", broken)
    events = stream_events(client.post("/api/v1/attune/ask/stream", headers=family, json={"message": "Hi"}))
    assert events[-1] == {"type": "error", "detail": attune.FAILED}
    assert client.get("/api/v1/attune/conversations", headers=family).json() == []

    monkeypatch.setattr(get_settings(), "attune_daily_limit", 0)
    refused = client.post("/api/v1/attune/ask/stream", headers=family, json={"message": "Hi"})
    assert refused.status_code == 429


def test_partial_replies_hide_thinking_and_citations_until_complete():
    assert attune.clean_partial("<thi") == ""
    assert attune.clean_partial("<think>planning") == ""
    assert attune.clean_partial("<think>plan</think>\nHello") == "Hello"
    assert attune.clean_partial("Use pegs【4:0") == "Use pegs"
    assert attune.clean_partial("Use pegs【4:0†guide】 daily") == "Use pegs daily"


def test_deepinfra_stream_is_read_from_server_sent_events(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "attune_provider", "deepinfra")
    monkeypatch.setattr(settings, "deepinfra_api_key", "di-test")
    lines = [
        'data: {"choices":[{"delta":{"role":"assistant"}}]}',
        'data: {"choices":[{"delta":{"content":"<think>hm</think>"}}]}',
        'data: {"choices":[{"delta":{"content":"Big "}}]}',
        "",
        'data: {"choices":[{"delta":{"content":"pegs"}}]}',
        "data: [DONE]",
    ]
    sent = {}

    def fake_lines(url, key, body):
        sent.update(url=url, key=key, body=body)
        yield from lines

    monkeypatch.setattr(attune, "_stream_lines", fake_lines)
    assert "".join(attune.stream_model("Be kind", [{"role": "user", "content": "Help"}])) == "Big pegs"
    assert sent["url"] == attune.DEEPINFRA_CHAT_URL and sent["body"]["stream"] is True


def test_answers_can_be_rated_by_their_asker_only(client, openai):
    family = register_family(client, "rate@example.com")
    other = register_family(client, "rate-other@example.com")
    body = ask(client, family, message="Ideas?").json()
    answer_id, question_id = body["answer"]["id"], body["question"]["id"]
    url = f"/api/v1/attune/messages/{answer_id}/feedback"

    assert client.put(url, headers=family, json={"value": "up"}).json()["feedback"] == "up"
    assert client.put(url, headers=family, json={"value": "down"}).json()["feedback"] == "down"
    detail = client.get(f"/api/v1/attune/conversations/{body['conversation']['id']}", headers=family).json()
    assert detail["messages"][1]["feedback"] == "down"
    assert client.put(url, headers=family, json={"value": None}).json()["feedback"] is None
    assert client.put(url, headers=other, json={"value": "up"}).status_code == 404
    assert client.put(f"/api/v1/attune/messages/{question_id}/feedback", headers=family,
                      json={"value": "up"}).status_code == 404
    assert client.put(url, headers=family, json={"value": "meh"}).status_code == 422


def test_follow_ups_are_told_not_to_greet_again_and_see_session_totals(client, openai):
    family = register_family(client, "greet@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    first = ask(client, family, message="Hi", child_id=child["id"]).json()
    ask(client, family, message="And?", conversation_id=first["conversation"]["id"])
    assert "This is the start of the conversation." in openai[0]["instructions"]
    assert "don't greet them again" in openai[1]["instructions"]


def test_people_can_rename_their_own_chats(client, openai):
    family = register_family(client, "rename@example.com")
    other = register_family(client, "rename-other@example.com")
    conversation_id = ask(client, family, message="Ideas?").json()["conversation"]["id"]
    url = f"/api/v1/attune/conversations/{conversation_id}"
    renamed = client.patch(url, headers=family, json={"title": "  Pegs   plan  "})
    assert renamed.status_code == 200 and renamed.json()["title"] == "Pegs plan"
    assert client.patch(url, headers=family, json={"title": "   "}).status_code == 422
    assert client.patch(url, headers=other, json={"title": "Mine"}).status_code == 404


def test_insights_count_usage_without_revealing_questions(client, platform_admin, openai):
    family = register_family(client, "insight@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    first = ask(client, family, message="Secret worry", child_id=child["id"]).json()
    ask(client, family, message="Follow-up", conversation_id=first["conversation"]["id"])
    client.put(f"/api/v1/attune/messages/{first['answer']['id']}/feedback", headers=family, json={"value": "up"})

    assert client.get("/api/v1/attune/insights", headers=family).status_code == 403
    data = client.get("/api/v1/attune/insights", headers=platform_admin).json()
    assert data["questions_today"] == 2 and data["questions_7_days"] == 2 and data["questions_30_days"] == 2
    assert data["people_30_days"] == 1 and data["children_30_days"] == 1
    assert data["rated_up"] == 1 and data["rated_down"] == 0
    assert len(data["daily"]) == 14 and data["daily"][-1]["questions"] == 2
    assert "Secret worry" not in str(data)
