import { useRef, useState, type KeyboardEvent } from "react";
import {
  Bold,
  Eye,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  PencilLine,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { AttuneReply } from "@/features/attune/AttuneReply";
import { cn } from "@/lib/utils";
import {
  continueList,
  onListLine,
  previewText,
  shiftLines,
  toggleBold,
  toggleList,
  type TextEdit,
} from "./promptFormat";

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Keep the text selection: the toolbar mustn't take focus from the text.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-navy/75 transition-colors hover:bg-navy/8 disabled:opacity-35"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/**
 * A plain-text editor for what Attune is told, with buttons for bulleted and numbered lists,
 * indenting and bold. The text is kept exactly as written ("- ", "1. ", "**bold**"), because it
 * goes to the language model as is; Preview shows it formatted. Edits go through the browser's
 * own typing, so Cmd/Ctrl+Z undoes them.
 */
export function PromptEditor({
  id,
  label,
  value,
  onChange,
  rows,
  invalid,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const apply = (edit: TextEdit) => {
    const area = ref.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(edit.from, edit.to);
    // Typing the change keeps it on the browser's undo stack; fall back to setting the value.
    const typed = edit.insert
      ? document.execCommand("insertText", false, edit.insert)
      : edit.from === edit.to || document.execCommand("delete");
    if (!typed) onChange(value.slice(0, edit.from) + edit.insert + value.slice(edit.to));
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };
  const selection = () => {
    const area = ref.current;
    return area ? ([area.selectionStart, area.selectionEnd] as const) : ([0, 0] as const);
  };
  const run = (make: (text: string, start: number, end: number) => TextEdit) => {
    const [start, end] = selection();
    apply(make(value, start, end));
  };
  const history = (command: "undo" | "redo") => {
    ref.current?.focus();
    document.execCommand(command);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const [start, end] = selection();
    if (event.key === "Enter" && !event.shiftKey && start === end) {
      const edit = continueList(value, start);
      if (edit) {
        event.preventDefault();
        apply(edit);
      }
    } else if (event.key === "Tab" && onListLine(value, start)) {
      // Only on a list item, so Tab still moves on from the field everywhere else.
      event.preventDefault();
      apply(shiftLines(value, start, end, event.shiftKey));
    } else if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply(toggleBold(value, start, end));
    }
  };

  const divider = <span className="mx-1 h-5 w-px shrink-0 bg-navy/12" aria-hidden />;

  return (
    <div
      className={cn(
        "mt-1.5 overflow-hidden rounded-xl border bg-card transition focus-within:ring-2",
        invalid
          ? "border-coral focus-within:ring-coral/20"
          : "border-navy/15 focus-within:border-blue focus-within:ring-blue/25",
      )}
    >
      <div
        role="toolbar"
        aria-label={`${label} formatting`}
        className="flex flex-wrap items-center gap-0.5 border-b border-navy/10 bg-navy/[0.03] px-2 py-1.5"
      >
        <ToolButton icon={Undo2} label="Undo" disabled={preview} onClick={() => history("undo")} />
        <ToolButton icon={Redo2} label="Redo" disabled={preview} onClick={() => history("redo")} />
        {divider}
        <ToolButton
          icon={List}
          label="Bulleted list"
          disabled={preview}
          onClick={() => run((t, s, e) => toggleList(t, s, e, "bullet"))}
        />
        <ToolButton
          icon={ListOrdered}
          label="Numbered list"
          disabled={preview}
          onClick={() => run((t, s, e) => toggleList(t, s, e, "number"))}
        />
        <ToolButton
          icon={IndentDecrease}
          label="Outdent"
          disabled={preview}
          onClick={() => run((t, s, e) => shiftLines(t, s, e, true))}
        />
        <ToolButton
          icon={IndentIncrease}
          label="Indent"
          disabled={preview}
          onClick={() => run((t, s, e) => shiftLines(t, s, e))}
        />
        <ToolButton icon={Bold} label="Bold" disabled={preview} onClick={() => run(toggleBold)} />
        <span className="ml-auto flex rounded-lg bg-navy/6 p-0.5" role="group" aria-label="View">
          {(
            [
              [false, "Edit", PencilLine],
              [true, "Preview", Eye],
            ] as const
          ).map(([mode, text, Icon]) => (
            <button
              key={text}
              type="button"
              aria-pressed={preview === mode}
              onClick={() => setPreview(mode)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-bold",
                preview === mode ? "bg-card text-navy shadow-sm" : "text-navy/60 hover:text-navy",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {text}
            </button>
          ))}
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        hidden={preview}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        spellCheck
        className="block w-full resize-y bg-transparent px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-navy outline-none"
      />
      {preview && (
        <div
          aria-label={`${label} preview`}
          className="max-h-[32rem] overflow-y-auto px-4 py-3 text-sm"
          style={{ minHeight: `${rows * 1.4}rem` }}
        >
          <AttuneReply text={previewText(value)} />
        </div>
      )}
    </div>
  );
}
