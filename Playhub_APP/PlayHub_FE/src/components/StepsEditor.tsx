import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** Older activities only have a list of plain steps; open them as a numbered list. */
export function stepsToHtml(steps: string[]): string {
  const lines = steps.map((step) => step.trim()).filter(Boolean);
  return lines.length
    ? `<ol>${lines.map((line) => `<li><p>${escapeHtml(line)}</p></li>`).join("")}</ol>`
    : "";
}

/**
 * Plain-text steps for places that count or preview them (e.g. "Day 1 · 3 steps"): each list
 * item becomes one step, every other block (heading, paragraph, quote) becomes one too.
 */
export function stepsFromEditor(editor: Editor): string[] {
  const lines: string[] = [];
  editor.state.doc.forEach((block) => {
    if (block.type.name === "bulletList" || block.type.name === "orderedList") {
      block.forEach((item) => lines.push(item.textContent.trim()));
    } else {
      lines.push(block.textContent.trim());
    }
  });
  return lines.filter(Boolean);
}

type BlockStyle = "paragraph" | "h2" | "h3" | "h4";

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? false}
      disabled={disabled}
      // Keep the text selection: don't let the toolbar take focus from the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-35",
        active ? "bg-navy text-cream" : "text-navy/75 hover:bg-navy/8",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: (e.isActive("heading", { level: 2 })
        ? "h2"
        : e.isActive("heading", { level: 3 })
          ? "h3"
          : e.isActive("heading", { level: 4 })
            ? "h4"
            : "paragraph") as BlockStyle,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  const setBlock = (value: BlockStyle) => {
    if (value === "paragraph") chain().setParagraph().run();
    else
      chain()
        .setHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 })
        .run();
  };

  const toggleLink = () => {
    if (state.link) return void chain().unsetLink().run();
    const url = window.prompt("Link address", "https://");
    if (!url || url === "https://") return;
    chain().extendMarkRange("link").setLink({ href: url }).run();
  };

  const divider = <span className="mx-1 h-5 w-px shrink-0 bg-navy/12" aria-hidden />;

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-navy/10 bg-navy/[0.03] px-2 py-1.5"
    >
      <ToolButton
        icon={Undo2}
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
      {divider}
      <select
        aria-label="Text style"
        value={state.block}
        onChange={(event) => setBlock(event.target.value as BlockStyle)}
        className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-navy outline-none hover:bg-navy/8 focus-visible:ring-2 focus-visible:ring-blue/30"
      >
        <option value="paragraph">Normal text</option>
        <option value="h2">Heading</option>
        <option value="h3">Subheading</option>
        <option value="h4">Small heading</option>
      </select>
      {divider}
      <ToolButton
        icon={Bold}
        label="Bold"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="Underline"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      {divider}
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton icon={Link2} label="Link" active={state.link} onClick={toggleLink} />
      {divider}
      <ToolButton
        icon={RemoveFormatting}
        label="Clear formatting"
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      />
    </div>
  );
}

/**
 * A small Google Docs-style editor for an activity's steps: headings, bold/italic/underline,
 * numbered and bulleted lists (Tab nests a list item), quotes and links. Shift+Enter adds a line
 * break inside a step.
 */
export function StepsEditor({
  id,
  html,
  steps,
  onChange,
}: {
  id: string;
  /** Saved formatted steps, if any. */
  html: string | undefined;
  /** Plain steps, used when the activity has never been formatted. */
  steps: string[];
  onChange: (value: { html: string; steps: string[] }) => void;
}) {
  const editor = useEditor({
    // The app renders on the server first; the editor only exists in the browser.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: html || stepsToHtml(steps),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Steps",
        class: "px-4 py-3",
      },
    },
    onUpdate: ({ editor: e }) => {
      const lines = stepsFromEditor(e);
      onChange({ html: lines.length ? e.getHTML() : "", steps: lines });
    },
  });

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-navy/15 bg-card focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/20">
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} className="ph-rich max-h-[28rem] overflow-y-auto" />
        </>
      ) : (
        <div className="h-48 animate-pulse bg-navy/5" aria-hidden />
      )}
    </div>
  );
}
