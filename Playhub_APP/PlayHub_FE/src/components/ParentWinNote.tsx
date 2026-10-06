import { cn } from "@/lib/utils";

export function ParentWinNote({ text, className }: { text: string; className?: string }) {
  const note = text.trim();
  if (!note) return null;

  return (
    <div
      className={cn(
        "mt-2 w-full rounded-xl border border-blue/10 bg-blue/5 px-3 py-2.5",
        className,
      )}
    >
      <p className="text-[10px] font-bold tracking-[0.12em] text-blue uppercase">Big Win</p>
      <p className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-line text-navy/80">
        {note}
      </p>
    </div>
  );
}
