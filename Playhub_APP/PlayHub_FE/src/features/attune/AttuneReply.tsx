import { useMemo } from "react";
import { parseMarkdown, type Inline } from "./markdown";

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case "strong":
            return <strong key={i}>{part.text}</strong>;
          case "em":
            return <em key={i}>{part.text}</em>;
          case "code":
            return (
              <code key={i} className="ph-r-md bg-navy/8 px-1 py-0.5 text-[0.9em]">
                {part.text}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue underline underline-offset-2"
              >
                {part.text}
              </a>
            );
          default:
            return <span key={i}>{part.text}</span>;
        }
      })}
    </>
  );
}

/** Attune's answer, formatted from its Markdown without ever rendering raw HTML. */
export function AttuneReply({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p key={i} dir="auto" className="font-bold">
              <InlineText parts={block.inline} />
            </p>
          );
        }
        if (block.kind === "table") {
          return (
            <div key={i} className="ph-r-lg overflow-x-auto border border-navy/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-navy/5">
                  <tr>
                    {block.header.map((cell, j) => (
                      <th key={j} className="px-3 py-2 font-bold">
                        <InlineText parts={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r} className="border-t border-navy/8">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 align-top">
                          <InlineText parts={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              dir="auto"
              className={block.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}
            >
              {block.items.map((item, j) => (
                <li key={j} dir="auto">
                  <InlineText parts={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} dir="auto">
            <InlineText parts={block.inline} />
          </p>
        );
      })}
    </div>
  );
}
