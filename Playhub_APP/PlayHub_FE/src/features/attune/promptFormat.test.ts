import { describe, expect, test } from "bun:test";
import {
  continueList,
  onListLine,
  previewText,
  shiftLines,
  toggleBold,
  toggleList,
  type TextEdit,
} from "./promptFormat";

const apply = (text: string, edit: TextEdit) =>
  text.slice(0, edit.from) + edit.insert + text.slice(edit.to);

describe("Attune prompt formatting", () => {
  test("turns selected lines into a bulleted list and back, leaving other lines alone", () => {
    const text = "RULES\nBe warm\n\nBe brief\nAFTER";
    const start = text.indexOf("Be warm");
    const end = text.indexOf("Be brief") + "Be brief".length;
    const bulleted = apply(text, toggleList(text, start, end, "bullet"));
    expect(bulleted).toBe("RULES\n- Be warm\n\n- Be brief\nAFTER");
    const back = apply(
      bulleted,
      toggleList(bulleted, bulleted.indexOf("- Be"), bulleted.indexOf("AFTER") - 1, "bullet"),
    );
    expect(back).toBe(text);
  });

  test("numbers lines from 1, and switches a bulleted list to numbers", () => {
    const text = "- One\n- Two\n- Three";
    expect(apply(text, toggleList(text, 0, text.length, "number"))).toBe(
      "1. One\n2. Two\n3. Three",
    );
    const caretOnly = "Just this line";
    expect(apply(caretOnly, toggleList(caretOnly, 3, 3, "number"))).toBe("1. Just this line");
  });

  test("keeps indentation when making a list", () => {
    const text = "  nested a\n  nested b";
    expect(apply(text, toggleList(text, 0, text.length, "bullet"))).toBe(
      "  - nested a\n  - nested b",
    );
  });

  test("indents and outdents whole lines", () => {
    const text = "- a\n- b";
    const indented = apply(text, shiftLines(text, 0, text.length));
    expect(indented).toBe("  - a\n  - b");
    expect(apply(indented, shiftLines(indented, 0, indented.length, true))).toBe(text);
  });

  test("bold wraps the selection and unwraps it again", () => {
    const text = "Say hello now";
    const start = text.indexOf("hello");
    const edit = toggleBold(text, start, start + 5);
    const bold = apply(text, edit);
    expect(bold).toBe("Say **hello** now");
    expect(bold.slice(edit.selectionStart, edit.selectionEnd)).toBe("hello");
    expect(apply(bold, toggleBold(bold, edit.selectionStart, edit.selectionEnd))).toBe(text);
  });

  test("Enter continues a list and an empty item ends it", () => {
    const bullets = "- first";
    const next = continueList(bullets, bullets.length)!;
    expect(apply(bullets, next)).toBe("- first\n- ");
    const numbered = "  3. third";
    expect(apply(numbered, continueList(numbered, numbered.length)!)).toBe("  3. third\n  4. ");
    const empty = "- first\n- ";
    expect(apply(empty, continueList(empty, empty.length)!)).toBe("- first\n");
    expect(continueList("Plain line", 10)).toBeNull();
  });

  test("knows when the caret is on a list item", () => {
    const text = "Intro\n    12. deep item";
    expect(onListLine(text, 2)).toBe(false);
    expect(onListLine(text, text.length)).toBe(true);
  });
});

describe("Attune prompt preview", () => {
  test("shows capital-letter section titles as headings", () => {
    expect(previewText("WHO YOU HELP\nParents and carers.\n- Not a tool")).toBe(
      "\n### WHO YOU HELP\n\nParents and carers.\n- Not a tool",
    );
    expect(previewText("ANSWER FORMAT (fixed order; keep each part short)")).toBe(
      "ANSWER FORMAT (fixed order; keep each part short)",
    );
    expect(previewText("OK\nUAE call 999")).toBe("OK\nUAE call 999");
  });
});
