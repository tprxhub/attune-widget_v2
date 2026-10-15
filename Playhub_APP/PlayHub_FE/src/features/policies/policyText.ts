import type { PolicySection } from "./PolicyLayout";

/** Editable plain text with ## headings and - bullet points; never interpreted as HTML. */
export function policyToText(intro: string[], sections: PolicySection[]): string {
  return [
    ...intro,
    ...sections.flatMap((section) => [
      ...(section.heading ? [`## ${section.heading}`] : []),
      ...(section.paragraphs ?? []),
      ...(section.items?.length ? [section.items.map((item) => `- ${item}`).join("\n")] : []),
      ...(section.after ?? []),
    ]),
  ].join("\n\n");
}

function appendPolicyBlock(intro: string[], sections: PolicySection[], block: string) {
  const text = block.trim();
  if (!text) return;
  let section = sections.at(-1);
  if (/^[-*]\s/.test(text)) {
    if (!section) {
      section = {};
      sections.push(section);
    }
    (section.items ??= []).push(text.replace(/^[-*]\s+/, ""));
    return;
  }
  if (!section) {
    intro.push(text);
    return;
  }
  const paragraphs = section.items?.length ? (section.after ??= []) : (section.paragraphs ??= []);
  paragraphs.push(text);
}

export function parsePolicyText(body: string): { intro: string[]; sections: PolicySection[] } {
  const intro: string[] = [];
  const sections: PolicySection[] = [];
  const blocks = body
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n|\n(?=##?\s|[-*]\s)/);
  for (const block of blocks) {
    const heading = block.match(/^##?\s+([^\n]+)\n?([\s\S]*)$/);
    if (heading) {
      sections.push({ heading: heading[1]!.trim(), paragraphs: [] });
      appendPolicyBlock(intro, sections, heading[2]!);
    } else {
      appendPolicyBlock(intro, sections, block);
    }
  }
  return { intro, sections };
}
