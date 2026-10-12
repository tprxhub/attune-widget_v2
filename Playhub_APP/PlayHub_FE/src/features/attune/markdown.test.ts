import { describe, expect, test } from "bun:test";
import { parseInline, parseMarkdown } from "./markdown";

describe("Attune markdown", () => {
  test("reads headings, paragraphs and both kinds of list", () => {
    const blocks = parseMarkdown(
      "### Try this\nKeep it short\nand fun.\n\n- Bigger pegs\n- Sit at a table\n  with feet flat\n\n1. Warm up\n2) Play",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "list"]);
    expect(blocks[1]).toEqual({
      kind: "paragraph",
      inline: [{ kind: "text", text: "Keep it short and fun." }],
    });
    const bullets = blocks[2];
    expect(bullets?.kind === "list" && !bullets.ordered && bullets.items.length).toBe(2);
    expect(bullets?.kind === "list" && bullets.items[1]).toEqual([
      { kind: "text", text: "Sit at a table with feet flat" },
    ]);
    expect(blocks[3]?.kind === "list" && blocks[3].ordered).toBe(true);
  });

  test("reads bold, italic, code and only http(s) links", () => {
    expect(parseInline("**Stop** on a *win* with `pegs` [guide](https://x.com/a)")).toEqual([
      { kind: "strong", text: "Stop" },
      { kind: "text", text: " on a " },
      { kind: "em", text: "win" },
      { kind: "text", text: " with " },
      { kind: "code", text: "pegs" },
      { kind: "text", text: " " },
      { kind: "link", text: "guide", href: "https://x.com/a" },
    ]);
    expect(parseInline("[bad](javascript:alert(1))")).toEqual([
      { kind: "text", text: "[bad](javascript:alert(1))" },
    ]);
  });

  test("reads tables between other text", () => {
    const blocks = parseMarkdown(
      "Compare:\n| Toy | Skill |\n|---|:---:|\n| **Pegs** | Pinch |\n| Beads | Grip |\nDone.",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "table", "paragraph"]);
    const table = blocks[1];
    if (table?.kind !== "table") throw new Error("expected a table");
    expect(table.header.map((c) => c[0])).toEqual([
      { kind: "text", text: "Toy" },
      { kind: "text", text: "Skill" },
    ]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]?.[0]).toEqual([{ kind: "strong", text: "Pegs" }]);
  });
});
