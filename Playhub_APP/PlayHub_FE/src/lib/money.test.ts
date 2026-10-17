import { describe, expect, test } from "bun:test";
import { fmtMoney } from "./money";

describe("prices in UAE dirhams", () => {
  test("labels", () => {
    expect(fmtMoney(0)).toBe("AED 0");
    expect(fmtMoney(1250)).toBe("AED 1,250");
    expect(fmtMoney(56.5)).toBe("AED 56.50");
  });
});
