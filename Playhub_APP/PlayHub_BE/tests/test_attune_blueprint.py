"""Attune Product Reasoning Blueprint: rules, ways in, safety pathway, references, briefing and
the "Share this" handover note."""
import json

from app import attune
from app.attune_rules import INSTRUCTIONS, build_rules, safety_concern, split_reply, visible_text
from app.attune_sources import CITABLE, register
from app.config import get_settings
from app.models import AuditEvent
from conftest import TestingSession
from test_attune import ask, openai, subscribe  # noqa: F401  (fixture)
from test_free_play_plan import register_family

CONSULT = get_settings().attune_consult_url


def test_the_rules_carry_the_blueprint():
    rules = build_rules(CONSULT)
    for part in ("**What might be happening**", "**What matters right now**", "**What you can try**",
                 "**Adapt it**", "**What to notice**", "**Let's Attune**"):
        assert part in rules
    assert "created by a licensed occupational therapist" in rules
    assert "Rookie = -1" in rules and "Starter = 0" in rules and "Pro = +1" in rules
    assert "12. Invite adaptation" in rules and "One question at most" in rules
    assert "ONE dimension at a time" in rules
    assert "SAFETY PATHWAY" in rules and "999" in rules and "998" in rules
    assert CONSULT in rules and "{consult_url}" not in rules and "{sources}" not in rules
    # The trademarked programme is only ever named in the line that forbids it.
    assert [line for line in rules.splitlines() if "Zones of Regulation" in line] == [
        line for line in rules.splitlines() if line.startswith("- Never use the trademarked")
    ]
    assert "never reproduce, score or claim to administer the Ages & Stages Questionnaires" in INSTRUCTIONS
    # Only sources cleared for citing can be named; the ASQ and unreviewed sources can't.
    cited = {source.id for source in CITABLE}
    assert {"asq", "co-regulation", "floortime"}.isdisjoint(cited)
    assert "- asq:" not in rules and "- nmt:" in rules


def test_each_way_in_adds_its_guidance(client, openai):
    family = register_family(client, "modes@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    for mode, marker in (("idea", "Get an idea"), ("regulation", "My child is struggling"),
                         ("progress", "What does this mean?")):
        assert ask(client, family, message="Help", child_id=child["id"], mode=mode).status_code == 200
        assert f"THIS QUESTION: {marker}" in openai[-1]["instructions"]
    assert ask(client, family, message="Help", child_id=child["id"]).status_code == 200
    assert "THIS QUESTION:" not in openai[-1]["instructions"]
    assert ask(client, family, message="Help", mode="diagnose").status_code == 422


def test_danger_phrases_start_the_safety_pathway_without_exception(client, monkeypatch, openai):
    for message in ("He swallowed a button battery", "my baby is not breathing", "She is choking on a bead",
                    "I want to hurt my child", "I think he is being abused", "she hit her head and won't wake up",
                    "I might kill myself"):
        assert safety_concern(message), message
    for message in ("Is this bead a choking hazard?", "He gets frustrated fitting the pegs",
                    "She melts down when we leave the playground", "I am losing my patience"):
        assert not safety_concern(message), message

    family = register_family(client, "safety@example.com")
    # The model didn't mark it, but the question did: the answer still shows the emergency contacts.
    reply = ask(client, family, message="He swallowed a magnet just now").json()["answer"]
    assert "SAFETY CHECK TRIGGERED" in openai[-1]["instructions"]
    assert reply["safety"] is True
    assert {r["id"] for r in reply["references"]} == {"nmt", "polyvagal"}

    calm = ask(client, family, message="Ideas for the pegboard?").json()["answer"]
    assert "SAFETY CHECK TRIGGERED" not in openai[-1]["instructions"]
    assert calm["safety"] is False

    # The model can also take the safety pathway on its own.
    monkeypatch.setattr(attune, "ask_model", lambda *_: "Please call 998 now.\n[[refs: nmt | safety]]")
    flagged = ask(client, family, message="Something is very wrong").json()["answer"]
    assert flagged["safety"] is True and flagged["content"] == "Please call 998 now."

    with TestingSession() as db:
        events = db.query(AuditEvent).filter_by(action="attune.asked").all()
        assert all("magnet" not in json.dumps(event.metadata_json or {}) for event in events)


def test_references_come_only_from_the_register(client, monkeypatch, openai):
    family = register_family(client, "refs@example.com")
    monkeypatch.setattr(attune, "ask_model",
                        lambda *_: "Stay close and keep words few.\n\n[[refs: NMT, polyvagal, asq, made-up]]")
    answer = ask(client, family, message="Meltdown at bedtime", mode="regulation").json()["answer"]
    assert answer["content"] == "Stay close and keep words few."
    assert [r["id"] for r in answer["references"]] == ["nmt", "polyvagal"]
    assert answer["references"][0]["title"] == "Neurosequential Model of Therapeutics (Dr. Bruce Perry)"
    assert answer["mode"] == "regulation"

    # No marker: the panel lists the sources behind that kind of answer.
    monkeypatch.setattr(attune, "ask_model", lambda *_: "Try chunky pegs.")
    idea = ask(client, family, message="Pegboard ideas", mode="idea").json()["answer"]
    assert [r["id"] for r in idea["references"]] == ["ot-grading", "gas", "pyramid"]

    # Saved with the chat, so the panel is there when the chat is opened again.
    chats = client.get("/api/v1/attune/conversations", headers=family).json()
    saved = client.get(f"/api/v1/attune/conversations/{chats[0]['id']}", headers=family).json()["messages"][-1]
    assert [r["id"] for r in saved["references"]] == ["ot-grading", "gas", "pyramid"]


def test_the_hidden_marker_never_reaches_the_screen():
    assert visible_text("Calm voice.\n[") == "Calm voice.\n"
    assert visible_text("Calm voice.\n[[refs: nm") == "Calm voice.\n"
    assert visible_text("Calm voice.\n[[refs: nmt]]") == "Calm voice.\n"
    assert visible_text("See [the plan](https://x.y)") == "See [the plan](https://x.y)"
    assert split_reply("A\n[[refs: gas, ot-grading]]") == ("A", ["gas", "ot-grading"], False)
    assert split_reply("Call 999.\n[[refs: nmt | safety]]") == ("Call 999.", ["nmt"], True)


def test_streamed_answers_hide_the_marker_and_keep_the_references(client, monkeypatch, openai):
    from test_attune import stream_events

    family = register_family(client, "stream-refs@example.com")
    pieces = ["Stay close.", " Fewer words.\n[", "[refs: n", "mt, kuy", "pers]]"]
    monkeypatch.setattr(attune, "stream_model", lambda *_: iter(pieces))
    events = stream_events(client.post("/api/v1/attune/ask/stream", headers=family,
                                       json={"message": "Upset at pick-up", "mode": "regulation"}))
    deltas = "".join(e["text"] for e in events if e["type"] == "delta")
    assert "[" not in deltas and deltas.strip() == "Stay close. Fewer words."
    done = events[-1]
    assert done["type"] == "done"
    assert done["answer"]["content"] == "Stay close. Fewer words."
    assert [r["id"] for r in done["answer"]["references"]] == ["nmt", "kuypers"]


def test_the_briefing_has_the_plan_sequence_progress_and_play_pulse(client, platform_admin, openai):
    plan = client.post("/api/v1/play-plans", headers=platform_admin, json={"name": "Grip Seq", "slug": "grip-seq"}).json()
    doses, activities = {}, {}
    for level, title, items in (("rookie", "Peg Start", ["Chunky pegs"]), ("starter", "Peg Power", ["Tweezers", "Pom-poms"]),
                                ("pro", "Peg Pro", ["Small beads"])):
        doses[level] = client.post(f"/api/v1/play-plans/{plan['id']}/play-doses", headers=platform_admin,
                                   json={"level": level, "title": title, "real_life_try_items": items}).json()
        activities[level] = client.post(f"/api/v1/play-doses/{doses[level]['id']}/activities", headers=platform_admin,
                                        json={"sequence": 0, "day": 1, "title": f"{title} 1",
                                              "instructions": ["Pinch pom-poms with tweezers", "Drop them in the cup"]}).json()
    client.patch(f"/api/v1/play-plans/{plan['id']}", headers=platform_admin, json={"publication_status": "published"})

    family = register_family(client, "brief@example.com")
    child = client.get("/api/v1/children", headers=family).json()[0]
    assert client.patch(f"/api/v1/children/{child['id']}", headers=platform_admin,
                        json={"current_play_dose_id": doses["starter"]["id"]}).status_code == 200
    activity = activities["starter"]
    assert client.post(f"/api/v1/children/{child['id']}/attempts", headers=platform_admin, json={
        "play_dose_id": doses["starter"]["id"], "activity_id": activity["id"], "occurred_on": "2026-10-02",
        "completion_score": 3, "mood_score": 4,
    }).status_code == 201
    pulse = client.post("/api/v1/play-pulse/results", headers=family, json={
        "child_name": "Free", "age_band": "preschool", "goal_id": "colour-lines", "support_score": 53,
        "tier": "practice", "areas_on_track": 2, "areas_assessed": 4,
        "domain_tiers": {"Sensory": "help", "Motor": "practice", "Cognition": "ontrack", "Engagement": "ontrack"},
        "answers": {"Sensory": [15, 40], "Motor": [65, 40], "Cognition": [90, 90], "Engagement": [65, 90]},
    })
    assert pulse.status_code == 201, pulse.text

    # On the free plan the Starter steps stay locked, so Attune isn't given them.
    assert ask(client, family, message="Ideas?", child_id=child["id"], mode="idea").status_code == 200
    assert "Steps of each Activity" not in openai[-1]["instructions"]
    subscribe(client, family)
    assert ask(client, family, message="What does this mean?", child_id=child["id"], mode="progress").status_code == 200
    context = openai[-1]["instructions"]
    assert "Play Plan sequence" in context
    assert "- Rookie level, GAS -1: Peg Start. Activities: Peg Start 1" in context
    assert "- Starter level, GAS 0: Peg Power ← current" in context
    assert "- Pro level, GAS +1: Peg Pro" in context
    assert "Steps of each Activity in the current Play Dose" in context
    assert "- Peg Power 1: Pinch pom-poms with tweezers / Drop them in the cup" in context
    assert "Progress in the current Play Plan" in context and "Dose 1 at Starter level" in context
    assert "Latest Play Pulse" in context and "Support Score 53% (Needs Practice)" in context
    assert "Sensory: Needs Help" in context and "not a screener" in context


def test_share_this_writes_a_plain_handover_note_once(client, monkeypatch, openai):
    family = register_family(client, "share@example.com")
    answer = ask(client, family, message="Meltdowns leaving the park", mode="regulation").json()["answer"]

    calls = []

    def note(instructions, conversation, config=None):
        calls.append((instructions, conversation))
        return ("## Note\n- Leaving the park has been hard for Free.\n\n**Try** a two-minute warning.\n"
                "[[refs: nmt]]\n\nWatch for a quicker recovery.")

    monkeypatch.setattr(attune, "ask_model", note)
    first = client.post(f"/api/v1/attune/messages/{answer['id']}/summary", headers=family)
    assert first.status_code == 200, first.text
    summary = first.json()["summary"]
    assert summary == ("Leaving the park has been hard for Free.\n\nTry a two-minute warning.\n\n"
                       "Watch for a quicker recovery.")
    assert "**" not in summary and "- " not in summary and "[[" not in summary and "#" not in summary
    instructions, conversation = calls[0]
    assert "3 to 5 short paragraphs" in instructions and "no mention of" in instructions
    assert "Parent: Meltdowns leaving the park" in conversation[0]["content"]

    # Kept: a second tap is instant and doesn't call the model again.
    assert client.post(f"/api/v1/attune/messages/{answer['id']}/summary", headers=family).json()["summary"] == summary
    assert len(calls) == 1

    stranger = register_family(client, "stranger@example.com")
    assert client.post(f"/api/v1/attune/messages/{answer['id']}/summary", headers=stranger).status_code == 404
    question_id = client.get(f"/api/v1/attune/conversations", headers=family).json()[0]["id"]
    detail = client.get(f"/api/v1/attune/conversations/{question_id}", headers=family).json()
    asked = next(m for m in detail["messages"] if m["role"] == "user")
    assert client.post(f"/api/v1/attune/messages/{asked['id']}/summary", headers=family).status_code == 404


def test_the_source_register_and_monitoring_counts(client, platform_admin, monkeypatch, openai):
    family = register_family(client, "register@example.com")
    assert client.get("/api/v1/attune/sources", headers=family).status_code == 403
    body = client.get("/api/v1/attune/sources", headers=platform_admin).json()
    assert body == register()
    first = body["sources"][0]
    assert set(first) >= {"id", "reference", "citation", "status", "status_label", "supports", "evidence",
                          "limitations", "licensing", "review"}
    assert {s["id"]: s["status"] for s in body["sources"]}["asq"] == "background"

    ask(client, family, message="He swallowed a coin")
    answer = ask(client, family, message="Leaving the park is hard").json()["answer"]
    monkeypatch.setattr(attune, "ask_model", lambda *_: "A note.")
    client.post(f"/api/v1/attune/messages/{answer['id']}/summary", headers=family)
    insights = client.get("/api/v1/attune/insights", headers=platform_admin).json()
    assert insights["safety_30_days"] == 1 and insights["shared_30_days"] == 1
