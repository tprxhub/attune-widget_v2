import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { listChildrenForSession } from "@/api/children";
import { useSession } from "@/auth/session";
import type { Child } from "@/lib/types";
import { ChildAvatar } from "@/components/brand";
import { FloatingPanel } from "@/components/FloatingPanel";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { activeChildSelected, selectActiveChildOverride } from "@/store/active-child-slice";

/** Dashboard-only choice for school admins: show every child instead of one. */
export const ALL_CHILDREN = "all";

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
  const { session } = useSession();
  const override = useAppSelector(selectActiveChildOverride);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Only school admins and platform admins may enrol children (the API enforces the same).
  const canAddMember = session.role === "educator" || session.role === "super_admin";
  // School admins see every child at once on the dashboard.
  const showingAll =
    session.role === "educator" &&
    pathname === "/dashboard" &&
    (override === undefined || override === ALL_CHILDREN);
  const allowAll = session.role === "educator" && pathname === "/dashboard";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!boxRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Only personas that actually juggle more than one child need a picker; admins also get it
  // with a single child so "Add a Member" is always within reach.
  if (!activeChild || (children.length < 2 && !canAddMember)) return null;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected child: ${showingAll ? "All children" : activeChild.name}`}
        className={cn(
          "inline-flex min-h-10 max-w-[13rem] items-center gap-2 rounded-full border border-navy/10 bg-card/80 py-1 pr-3 pl-1 text-sm font-bold text-navy shadow-[0_1px_0_rgba(16,42,74,0.04)] transition-colors hover:border-coral/40 hover:text-coral",
        )}
      >
        {showingAll ? (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy text-cream">
            <Users className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <ChildAvatar
            name={activeChild.name}
            token={activeChild.colorToken ?? "blue"}
            size={28}
            shape="rounded"
          />
        )}
        <span className="truncate">{showingAll ? "All children" : activeChild.name}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <FloatingPanel
          anchorRef={triggerRef}
          panelRef={panelRef}
          align="right"
          className="w-56 rounded-2xl border border-navy/10 bg-card p-1.5 shadow-[0_16px_40px_-12px_rgba(15,42,74,0.35)]"
        >
          <ul role="listbox" aria-label="Choose a child">
            {allowAll && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={showingAll}
                  onClick={() => {
                    setActiveChildId(ALL_CHILDREN);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold transition-colors",
                    showingAll ? "bg-navy text-white" : "text-navy hover:bg-navy/6",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                      showingAll ? "bg-white/15" : "bg-navy/10",
                    )}
                  >
                    <Users className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">All children</span>
                  {showingAll && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
            )}
            {children.map((child) => {
              const active = !showingAll && child.id === activeChildId;
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
          {canAddMember && (
            <Link
              to="/org/enroll"
              onClick={() => setOpen(false)}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-navy/8 px-2 py-2.5 text-left text-sm font-bold text-coral transition-colors hover:bg-coral/8"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-coral/12">
                <Plus className="h-4 w-4" aria-hidden />
              </span>
              Add a Member
            </Link>
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
