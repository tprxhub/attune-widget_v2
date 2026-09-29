import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "card" | "list";

const PREFIX = "playhub_view_";

export function useViewMode(key: string, initial: ViewMode = "card") {
  const [mode, setMode] = useState<ViewMode>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PREFIX + key);
    if (stored === "card" || stored === "list") setMode(stored);
  }, [key]);

  const set = useCallback(
    (next: ViewMode) => {
      setMode(next);
      if (typeof window !== "undefined") window.localStorage.setItem(PREFIX + key, next);
    },
    [key],
  );

  return [mode, set] as const;
}

export function ViewToggle({
  mode,
  onChange,
  className,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Switch between card view and list view"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-navy/12 bg-card p-1",
        className,
      )}
    >
      <Option mode={mode} value="card" label="Card view" onChange={onChange} icon={LayoutGrid} />
      <Option mode={mode} value="list" label="List view" onChange={onChange} icon={List} />
    </div>
  );
}

function Option({
  mode,
  value,
  label,
  onChange,
  icon: Icon,
}: {
  mode: ViewMode;
  value: ViewMode;
  label: string;
  onChange: (mode: ViewMode) => void;
  icon: typeof LayoutGrid;
}) {
  const active = mode === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors",
        active ? "bg-navy text-cream" : "text-navy/60 hover:text-navy",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{value === "card" ? "Cards" : "List"}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
