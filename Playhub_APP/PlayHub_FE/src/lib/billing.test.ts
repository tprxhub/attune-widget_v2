import { describe, expect, test } from "bun:test";
import {
  cycleLabel,
  cycleMonthsFromApi,
  cycleToApi,
  cycleUnit,
  monthsFromToday,
  monthsUntil,
} from "./billing";

const today = new Date(2026, 9, 19); // 19 October 2026

describe("organisation billing cycles", () => {
  test("API values map to months and back", () => {
    expect(cycleMonthsFromApi("monthly")).toBe(1);
    expect(cycleMonthsFromApi("annual")).toBe(12);
    expect(cycleMonthsFromApi("10_months")).toBe(10);
    expect(cycleMonthsFromApi(null)).toBe(12);
    expect([1, 12, 10].map(cycleToApi)).toEqual(["monthly", "annual", "10_months"]);
    expect([1, 12, 10].map(cycleLabel)).toEqual(["Monthly", "Annual", "10 months"]);
    expect(cycleUnit(10)).toBe("10 months");
  });

  test("a renewal date gives the months in the cycle", () => {
    expect(monthsUntil("2027-08-19", today)).toBe(10);
    expect(monthsUntil("2027-10-19", today)).toBe(12);
    expect(monthsUntil("2026-11-19", today)).toBe(1);
    expect(monthsUntil("2027-08-10", today)).toBe(10); // a few days early still counts as 10
    expect(monthsUntil("2026-10-01", today)).toBeNull();
  });

  test("months from today keep the day, or the month's last day", () => {
    expect(monthsFromToday(10, today)).toBe("2027-08-19");
    expect(monthsFromToday(1, new Date(2027, 0, 31))).toBe("2027-02-28");
  });
});
