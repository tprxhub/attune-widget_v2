import { describe, expect, test } from "bun:test";
import { DEFAULT_HOMEPAGE_CONTENT, mergeHomepageContent } from "./homepage";

const legacySteps = [
  {
    when: "Day 0",
    title: "Introduction",
    body: "Watch the short intro, then run the first Play Dose the same day.",
  },
  {
    when: "Days 1–2",
    title: "Finding the rhythm",
    body: "Two more Play Doses, scored as you go.",
  },
  {
    when: "Days 3–5",
    title: "Redo Day",
    body: "The same Activity comes back so the skill sticks, then two fresh Play Doses.",
  },
  {
    when: "Week end",
    title: "Level-Up Prompt",
    body: "The Final Redo Day closes the week and Play Hub suggests the next level.",
  },
];

describe("homepage content migration", () => {
  test("replaces the unchanged legacy week structure", () => {
    const content = mergeHomepageContent({
      week: {
        steps: legacySteps,
        stats: [
          { value: "9", label: "entries in every Play Plan week" },
          { value: "7", label: "loggable sessions, scored 1–5" },
          { value: "3", label: "levels for every skill area" },
          { value: "1", label: "Fine Motor Play Kit throughout" },
        ],
      },
    });

    expect(content.week.steps).toEqual(DEFAULT_HOMEPAGE_CONTENT.week.steps);
    expect(content.week.stats).toEqual(DEFAULT_HOMEPAGE_CONTENT.week.stats);
  });

  test("preserves intentionally customised week copy", () => {
    const customSteps = legacySteps.map((step) => ({ ...step }));
    customSteps[1]!.body = "Our custom Activity explanation.";

    const content = mergeHomepageContent({ week: { steps: customSteps } });

    expect(content.week.steps[1]?.body).toBe("Our custom Activity explanation.");
  });
});
