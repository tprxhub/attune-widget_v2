import { describe, expect, test } from "bun:test";
import { celebrate, type MoodDay } from "./supportMood";

const days = (...moods: number[]): MoodDay[] =>
  moods.map((mood, i) => ({ date: `2026-10-0${i + 1}`, mood, weekday: "Mon" }));

describe("celebrate", () => {
  test("cheers a child who needs little help and loves it", () => {
    const result = celebrate("Rahul", 17, days(5, 5, 4));
    expect(result.headline).toBe("Rahul is flying!");
    expect(result.wins).toEqual(["3 happy days", "Needing less help", "3 days of play"]);
  });

  test("calls out doing it solo at 0% support", () => {
    expect(celebrate("Noor", 0, days(3)).wins).toContain("Did it solo");
  });

  test("stays positive when help is still needed", () => {
    const result = celebrate("Sam", 67, days(2, 3));
    expect(result.headline).toBe("Every Session counts");
    expect(result.wins).toEqual(["2 days of play"]);
  });

  test("invites the first Session when nothing is logged", () => {
    expect(celebrate("Ava", null, []).headline).toBe("Ava’s first win is coming");
  });
});
