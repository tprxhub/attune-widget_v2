import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { listChildrenForSession } from "@/api/children";
import { useSession } from "@/auth/session";
import type { Child } from "@/lib/types";
import { ChildAvatar } from "@/components/brand";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { activeChildSelected, selectActiveChildOverride } from "@/store/active-child-slice";

interface ActiveChildValue {
  children: Child[];
  activeChild: Child | undefined;
  activeChildId: string | undefined;
  setActiveChildId: (id: string) => void;
  isLoading: boolean;
}

export function useActiveChild(): ActiveChildValue {
  const { session } = useSession();
  const dispatch = useAppDispatch();
  const override = useAppSelector(selectActiveChildOverride);
  const { data, isLoading } = useQuery({
    queryKey: ["children", session.personaId],
    queryFn: () => listChildrenForSession(session),
  });

  return useMemo(() => {
    const list = data ?? [];
    const active = list.find((c) => c.id === override) ?? list[0];
    return {
      children: list,
      activeChild: active,
      activeChildId: active?.id,
      setActiveChildId: (id: string) => dispatch(activeChildSelected(id)),
      isLoading,
    };
  }, [data, override, isLoading, dispatch]);
}

/** Compact dropdown used in the top bar; the choice is shared app-wide via the store. */
export function ChildSwitcherDropdown({ className }: { className?: string }) {
  const { children, activeChild, activeChildId, setActiveChildId } = useActiveChild();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Only personas that actually juggle more than one child need a picker.
  if (children.length < 2 || !activeChild) return null;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected child: ${activeChild.name}`}
        className={cn(
          "inline-flex min-h-10 max-w-[13rem] items-center gap-2 rounded-full border border-navy/10 bg-card/80 py-1 pr-3 pl-1 text-sm font-bold text-navy shadow-[0_1px_0_rgba(16,42,74,0.04)] transition-colors hover:border-coral/40 hover:text-coral",
        )}
      >
        <ChildAvatar
          name={activeChild.name}
          token={activeChild.colorToken ?? "blue"}
          size={28}
          shape="rounded"
        />
        <span className="truncate">{activeChild.name}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose a child"
          className="absolute right-0 z-50 mt-2 max-h-72 w-56 overflow-y-auto rounded-2xl border border-navy/10 bg-card p-1.5 shadow-[0_16px_40px_-12px_rgba(15,42,74,0.35)]"
        >
          {children.map((child) => {
            const active = child.id === activeChildId;
            return (
              <li key={child.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setActiveChildId(child.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold transition-colors",
                    active ? "bg-navy text-white" : "text-navy hover:bg-navy/6",
                  )}
                >
                  <ChildAvatar
                    name={child.name}
                    token={child.colorToken ?? "blue"}
                    size={28}
                    shape="rounded"
                  />
                  <span className="min-w-0 flex-1 truncate">{child.name}</span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
