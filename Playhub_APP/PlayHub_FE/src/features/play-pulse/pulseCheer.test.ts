import { describe, expect, test } from "bun:test";
import { pulseCheer } from "./pulseCheer";

describe("pulseCheer", () => {
  test("celebrates the areas on track and names the focus", () => {
    const cheer = pulseCheer(
      "Kai",
      "Fix the Pencil Grip",
      "practice",
      { Sensory: "ontrack", Motor: "practice", Cognition: "ontrack", Engagement: "unknown" },
      "Motor",
    );
    expect(cheer.headline).toBe("Kai is getting there!");
    expect(cheer.message).toContain("Motor skills");
    expect(cheer.wins).toEqual(["Sensory on track", "Cognition on track"]);
    expect([cheer.onTrack, cheer.assessed]).toEqual([2, 3]);
  });

  test("still has something positive when no area is on track yet", () => {
    const cheer = pulseCheer(
      "Kai",
      "Goal",
      "help",
      { Sensory: "help", Motor: "help", Cognition: "practice", Engagement: "help" },
      "Sensory",
    );
    expect(cheer.wins).toEqual(["Every step counts"]);
  });

  test("names an area that needs practice even without a given focus", () => {
    const cheer = pulseCheer(
      "Kai",
      "Goal",
      "practice",
      { Sensory: "ontrack", Motor: "practice", Cognition: "ontrack", Engagement: "ontrack" },
      null,
    );
    expect(cheer.message).toContain("Motor skills");
  });
});
