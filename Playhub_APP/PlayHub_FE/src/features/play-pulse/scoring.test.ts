import { describe, expect, test } from "bun:test";
import { PLAY_PULSE_GOALS } from "./data";
import { computePlayPulseResult, emptyAnswers } from "./scoring";

describe("Play Pulse scoring", () => {
  test("matches the worked example in the scoring specification", () => {
    const goal = PLAY_PULSE_GOALS.find((item) => item.id === "pencil-grip")!;
    const answers = emptyAnswers();
    answers.Sensory = [40, 40];
    answers.Motor = [40, 40];
    answers.Cognition = [65, 65];
    answers.Engagement = [15, 40];

    const result = computePlayPulseResult(goal, "preschool", answers);

    expect(result.readiness).toBe(37);
    expect(result.supportScore).toBe(63);
    expect(result.tier).toBe("practice");
  });

  test("excludes skipped domains and labels them unassessed", () => {
    const goal = PLAY_PULSE_GOALS[0]!;
    const answers = emptyAnswers();
    answers.Motor = [90, 90];
    answers.Sensory = ["skipped", "skipped"];
    answers.Cognition = ["skipped", "skipped"];
    answers.Engagement = ["skipped", "skipped"];

    const result = computePlayPulseResult(goal, "preschool", answers);

    expect(result.supportScore).toBe(0);
    expect(result.domainTiers.Sensory).toBe("unknown");
    expect(result.domainTiers.Motor).toBe("ontrack");
  });

  test("softens a low-weight domain by one tier", () => {
    const goal = PLAY_PULSE_GOALS[0]!;
    const answers = emptyAnswers();
    answers.Sensory = [90, 90];
    answers.Motor = [90, 90];
    answers.Cognition = [90, 90];
    answers.Engagement = [15, 15];

    const result = computePlayPulseResult(goal, "preschool", answers);

    expect(result.domainTiers.Engagement).toBe("practice");
  });
});
