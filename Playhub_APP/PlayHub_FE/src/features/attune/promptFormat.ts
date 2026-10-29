/**
 * Plain-text formatting for Attune's prompt editor. The prompt goes to the language model as
 * written, so lists stay as text ("- " bullets, "1. " numbers) instead of HTML: what the Super
 * Admin sees is exactly what Attune is told.
 *
 * Every helper returns the slice of text to replace and where the selection lands afterwards, so
 * the editor can apply it as one typed edit (keeping the browser's own undo).
 */

export interface TextEdit {
  /** Replace text[from, to) with `insert`. */
  from: number;
  to: number;
  insert: string;
  /** Selection after the edit, in the new text. */
  selectionStart: number;
  selectionEnd: number;
}

const LIST_ITEM = /^(\s*)(?:[-*•]\s+|\d+[.)]\s+)/;
const BULLET = /^(\s*)[-*•]\s+/;
const NUMBER = /^(\s*)\d+[.)]\s+/;
const INDENT = "  ";

/** The whole lines a selection touches: [start of first line, end of last line). */
function lineRange(text: string, start: number, end: number) {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  // A selection ending at the very start of a line doesn't include that line.
  const stop = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const next = text.indexOf("\n", stop);
  return { from, to: next === -1 ? text.length : next };
}

function replaceLines(
  text: string,
  start: number,
  end: number,
  transform: (lines: string[]) => string[],
): TextEdit {
  const { from, to } = lineRange(text, start, end);
  const insert = transform(text.slice(from, to).split("\n")).join("\n");
  return { from, to, insert, selectionStart: from, selectionEnd: from + insert.length };
}

/**
 * Turn the selected lines into a bulleted or numbered list, or back into plain lines when they
 * already are that kind of list. Blank lines are left alone; numbering restarts at 1.
 */
export function toggleList(
  text: string,
  start: number,
  end: number,
  kind: "bullet" | "number",
): TextEdit {
  const marker = kind === "bullet" ? BULLET : NUMBER;
  return replaceLines(text, start, end, (lines) => {
    const filled = lines.filter((line) => line.trim());
    const already = filled.length > 0 && filled.every((line) => marker.test(line));
    let n = 0;
    return lines.map((line) => {
      if (!line.trim()) return line;
      const indent = line.match(/^\s*/)![0];
      const content = line.replace(LIST_ITEM, "").trimStart();
      if (already) return indent + content;
      n += 1;
      return indent + (kind === "bullet" ? "- " : `${n}. `) + content;
    });
  });
}

/** Indent the selected lines by two spaces, or remove up to two when `outdent`. */
export function shiftLines(text: string, start: number, end: number, outdent = false): TextEdit {
  return replaceLines(text, start, end, (lines) =>
    lines.map((line) => {
      if (!line.trim()) return line;
      return outdent ? line.replace(/^ {1,2}|^\t/, "") : INDENT + line;
    }),
  );
}

/** Wrap the selection in **bold** markers, or remove them if it already is. */
export function toggleBold(text: string, start: number, end: number): TextEdit {
  const selected = text.slice(start, end);
  if (selected.startsWith("**") && selected.endsWith("**") && selected.length >= 4) {
    const inner = selected.slice(2, -2);
    return {
      from: start,
      to: end,
      insert: inner,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  if (text.slice(start - 2, start) === "**" && text.slice(end, end + 2) === "**") {
    return {
      from: start - 2,
      to: end + 2,
      insert: selected,
      selectionStart: start - 2,
      selectionEnd: end - 2,
    };
  }
  const word = selected || "bold text";
  return {
    from: start,
    to: end,
    insert: `**${word}**`,
    selectionStart: start + 2,
    selectionEnd: start + 2 + word.length,
  };
}

/**
 * Enter at the end of a list item starts the next item ("- " or the next number) at the same
 * indent; Enter on an empty item ends the list. Returns null when Enter should behave normally.
 */
export function continueList(text: string, caret: number): TextEdit | null {
  const from = text.lastIndexOf("\n", caret - 1) + 1;
  const lineEnd = text.indexOf("\n", caret);
  const line = text.slice(from, lineEnd === -1 ? text.length : lineEnd);
  const match = line.match(/^(\s*)(?:([-*•])|(\d+)([.)]))\s+/);
  if (!match) return null;
  const prefix = match[0];
  if (caret - from < prefix.length) return null; // caret inside the marker itself
  if (!line.slice(prefix.length).trim()) {
    // An empty item: remove its marker and stop the list.
    const to = from + line.length;
    return {
      from,
      to,
      insert: match[1] ?? "",
      selectionStart: from + (match[1] ?? "").length,
      selectionEnd: from + (match[1] ?? "").length,
    };
  }
  const indent = match[1] ?? "";
  const next = match[2] ? `${match[2]} ` : `${Number(match[3]) + 1}${match[4]} `;
  const insert = `\n${indent}${next}`;
  return {
    from: caret,
    to: caret,
    insert,
    selectionStart: caret + insert.length,
    selectionEnd: caret + insert.length,
  };
}

/** Whether the caret's line is a list item (Tab then indents instead of leaving the field). */
export function onListLine(text: string, caret: number): boolean {
  const from = text.lastIndexOf("\n", caret - 1) + 1;
  const end = text.indexOf("\n", from);
  return LIST_ITEM.test(text.slice(from, end === -1 ? text.length : end));
}

/**
 * The prompt's section titles are lines in capitals ("WHO YOU HELP"). For Preview only, they are
 * shown as headings so a title doesn't run into the paragraph under it; the saved text is unchanged.
 */
export function previewText(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      /^[A-Z][A-Z0-9 &'’/,:()-]{2,}$/.test(line.trim()) && /[A-Z]{3}/.test(line)
        ? `\n### ${line.trim()}\n`
        : line,
    )
    .join("\n");
}
