import { describe, expect, test } from "bun:test";
import { fmtMoney, perMonthLabel, planPriceLabel } from "./money";

describe("prices in UAE dirhams", () => {
  test("labels", () => {
    expect(fmtMoney(0)).toBe("AED 0");
    expect(fmtMoney(1250)).toBe("AED 1,250");
    expect(planPriceLabel("6m")).toBe("AED 339");
    expect(planPriceLabel("weekly")).toBeNull();
    expect(perMonthLabel("3m")).toBe("AED 63 / month");
    expect(perMonthLabel("6m")).toBe("AED 56.50 / month");
    expect(perMonthLabel("12m")).toBe("AED 48.25 / month");
  });
});
