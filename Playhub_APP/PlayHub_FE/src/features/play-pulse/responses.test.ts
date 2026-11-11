import { describe, expect, test } from "bun:test";
import { AGE_BANDS, DEFAULT_OPTIONS, DOMAINS, PLAY_PULSE_GOALS } from "./data";
import { pulseResponses } from "./responses";
import type { AnswerValue } from "./scoring";

describe("Play Pulse answers in words", () => {
  test("every goal and age band has two questions per area, so eight answers in all", () => {
    for (const goal of PLAY_PULSE_GOALS) {
      for (const band of AGE_BANDS) {
        const answers = Object.fromEntries(DOMAINS.map((d) => [d, [90, 15] as AnswerValue[]]));
        const responses = pulseResponses(goal.id, band.id, answers);
        expect(responses).toHaveLength(8);
        for (const domain of DOMAINS)
          expect(responses.filter((r) => r.domain === domain)).toHaveLength(2);
        expect(responses.every((r) => r.question.length > 0 && r.answer)).toBe(true);
      }
    }
  });

  test("names the option chosen, and marks skipped questions", () => {
    const goal = PLAY_PULSE_GOALS[0]!;
    const responses = pulseResponses(goal.id, "preschool", {
      Sensory: [90, "skipped"],
      Motor: [40, 15],
      Cognition: [65, 90],
      Engagement: [15, 15],
    });
    const cognition = responses.filter((r) => r.domain === "Cognition");
    const question = goal.questions.preschool.Cognition[0]!;
    const options = typeof question === "string" ? DEFAULT_OPTIONS : question.options;
    expect(cognition[0]!.answer).toBe(options.find((o) => o.score === 65)!.label);
    const skipped = responses.find((r) => r.domain === "Sensory" && r.score === "skipped")!;
    expect(skipped.answer).toBeNull();
  });

  test("an unknown goal or age band gives no answers rather than failing", () => {
    expect(pulseResponses("nope", "preschool", {})).toEqual([]);
  });
});
