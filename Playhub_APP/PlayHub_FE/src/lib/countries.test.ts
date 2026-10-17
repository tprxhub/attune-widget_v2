import { describe, expect, test } from "bun:test";
import { COUNTRIES, DEFAULT_COUNTRY, flagOf, joinPhone, splitPhone } from "./countries";

const byCode = (code: string) => COUNTRIES.find((c) => c.code === code)!;

describe("phone country codes", () => {
  test("defaults to the UAE and keeps a local number in the chosen country", () => {
    expect(DEFAULT_COUNTRY.code).toBe("AE");
    expect(splitPhone("50 123 4567")).toEqual({
      country: DEFAULT_COUNTRY,
      national: "50 123 4567",
    });
  });

  test("a pasted international number picks its country", () => {
    expect(splitPhone("+44 7700 900123")).toEqual({
      country: byCode("GB"),
      national: "7700 900123",
    });
    expect(splitPhone("+971501234567").country.code).toBe("AE");
    expect(splitPhone("+1 212 555 0100").country.code).toBe("US");
    expect(splitPhone("+1 242 555 0100").country.code).toBe("BS");
    // Shared codes keep the country already chosen.
    expect(splitPhone("+1 416 555 0100", byCode("CA")).country.code).toBe("CA");
  });

  test("the saved number drops the home trunk 0, except for Italy", () => {
    expect(joinPhone(byCode("AE"), "050 123 4567")).toBe("+971 50 123 4567");
    expect(joinPhone(byCode("IT"), "06 1234 5678")).toBe("+39 06 1234 5678");
    expect(joinPhone(byCode("GB"), "  ")).toBe("");
  });

  test("flags come from the two-letter code", () => {
    expect(flagOf("AE")).toBe("🇦🇪");
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code) && /^\d{1,4}$/.test(c.dial))).toBe(
      true,
    );
  });
});
