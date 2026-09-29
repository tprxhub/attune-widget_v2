import { describe, expect, test } from "bun:test";
import { entryActivities, isEntitled } from "./plans";
import type { PlanEntry, Session } from "@/lib/types";

const freeSession: Session = {
  personaId: "free-parent",
  personaLabel: "Free Parent",
  userId: "free-parent",
  name: "Free Parent",
  email: "free@example.com",
  role: "parent",
  accountType: "b2c",
  tier: "free",
  childIds: ["child-1"],
  homePath: "/dashboard",
};

const entry: PlanEntry = {
  id: "dose-1",
  kind: "dose",
  day: 7,
  label: "Play Dose #5",
  title: "Complete dose",
  activity: "Fallback activity",
  loggable: true,
  minutes: 10,
  instructions: ["Fallback instruction"],
  videoLabel: "Fallback video",
  activities: [
    {
      id: "activity-1",
      name: "First Activity",
      minutes: 5,
      instructions: ["First instruction"],
      videoLabel: "First video",
    },
    {
      id: "activity-2",
      name: "Second Activity",
      minutes: 5,
      instructions: ["Second instruction"],
      videoLabel: "Second video",
    },
  ],
};

describe("Play Plan access", () => {
  test("keeps every dose unlocked for a free family", () => {
    expect(isEntitled(freeSession, entry, 99)).toBe(true);
  });

  test("returns every Activity configured inside a Play Dose", () => {
    expect(entryActivities(entry).map((activity) => activity.name)).toEqual([
      "First Activity",
      "Second Activity",
    ]);
  });
});
