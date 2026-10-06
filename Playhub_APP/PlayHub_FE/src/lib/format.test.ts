import { describe, expect, test } from "bun:test";
import { fmtDate, fmtDateRange, fmtDateTime, fmtShortDate, ordinal } from "./format";

describe("dates read the same everywhere", () => {
  test("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
  });

  test("calendar days and timestamps", () => {
    expect(fmtDate("2026-10-08")).toBe("8th Oct, 2026");
    expect(fmtDate(new Date(2026, 9, 13, 12, 10))).toBe("13th Oct, 2026");
    expect(fmtDateTime(new Date(2026, 9, 13, 12, 10, 5))).toBe("13th Oct, 2026 at 12:10");
    expect(fmtShortDate("2026-09-24")).toBe("24th Sep");
    expect(fmtDate("not a date")).toBe("");
  });

  test("ranges drop what repeats", () => {
    expect(fmtDateRange("2026-09-18", "2026-09-23")).toBe("18th – 23rd Sep, 2026");
    expect(fmtDateRange("2026-09-28", "2026-10-04")).toBe("28th Sep – 4th Oct, 2026");
    expect(fmtDateRange("2026-12-30", "2027-01-02")).toBe("30th Dec, 2026 – 2nd Jan, 2027");
    expect(fmtDateRange("2026-09-18", "2026-09-18")).toBe("18th Sep, 2026");
  });
});
