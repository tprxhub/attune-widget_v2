import { describe, expect, test } from "bun:test";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "./privacy";
import { TERMS_INTRO, TERMS_SECTIONS } from "./terms";
import { parsePolicyText, policyToText } from "./policyText";

describe("editable policy text", () => {
  test.each([
    [PRIVACY_INTRO, PRIVACY_SECTIONS],
    [TERMS_INTRO, TERMS_SECTIONS],
  ] as const)(
    "retains every paragraph, heading and bullet of existing policies",
    (intro, sections) => {
      const body = policyToText(intro, sections);
      const parsed = parsePolicyText(body);
      expect(parsed.intro).toEqual(intro);
      expect(policyToText(parsed.intro, parsed.sections)).toBe(body);
    },
  );

  test("handles edited headings, bullet lists, and paragraphs after lists", () => {
    const parsed = parsePolicyText("Intro.\n\n## Your choices\n\n- First\n- Second\n\nContact us.");
    expect(parsed).toEqual({
      intro: ["Intro."],
      sections: [
        {
          heading: "Your choices",
          paragraphs: [],
          items: ["First", "Second"],
          after: ["Contact us."],
        },
      ],
    });
  });

  test("keeps HTML as plain text", () => {
    expect(parsePolicyText("<script>alert(1)</script>").intro).toEqual([
      "<script>alert(1)</script>",
    ]);
  });
});
