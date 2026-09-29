import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, FlaskConical, X } from "lucide-react";
import { apiRequest, type ApiRole, type ApiScope } from "@/api/client";
import { useSession } from "@/auth/session";
import { cn } from "@/lib/utils";

/** Dev-only. It must be explicitly enabled and the API must allow test personas. */
export function personaSwitcherEnabled() {
  return import.meta.env["VITE_ENABLE_PERSONA_SWITCHER"] === "true";
}

export function PersonaSwitcher() {
  const { session, switchPersona } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const personas = useQuery({
    queryKey: ["developer-personas"],
    queryFn: () =>
      apiRequest<
        Array<{
          id: string;
          display_name: string;
          role: ApiRole;
          account_scope: ApiScope;
          organisation_id: string | null;
        }>
      >("/developer/personas"),
    enabled: personaSwitcherEnabled() && session.role !== "anonymous",
    retry: false,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!personaSwitcherEnabled() || !personas.data?.length) return null;

  const pick = async (id: string) => {
    const next = await switchPersona(id);
    setOpen(false);
    await navigate({ to: next.homePath });
  };

  return (
    <div ref={ref} className="fixed right-3 bottom-20 z-50 sm:right-4 sm:bottom-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-11 items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-lift)] transition-transform active:scale-95"
      >
        <FlaskConical className="h-4 w-4 shrink-0 text-amber" aria-hidden />
        <span className="hidden max-w-[11rem] truncate sm:inline">{session.personaLabel}</span>
        <span className="sm:hidden">Persona</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch test persona"
          className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded-3xl bg-card p-3 shadow-[var(--shadow-lift)] sm:absolute sm:inset-auto sm:right-0 sm:bottom-14 sm:w-80"
        >
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <div>
              <p className="eyebrow text-coral">Dev only</p>
              <p className="text-sm font-bold">Test persona</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close persona switcher"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-navy/5"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <ul className="space-y-1">
            {personas.data.map((p) => {
              const active = p.id === session.userId;
              const accountType =
                p.account_scope === "organisation"
                  ? "Organisation"
                  : p.account_scope === "individual"
                    ? "Individual"
                    : "Platform";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => void pick(p.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-navy/8" : "hover:bg-navy/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        p.role === "super_admin"
                          ? "bg-navy/10 text-navy"
                          : p.role === "admin"
                            ? "bg-blue/12 text-blue"
                            : "bg-coral/12 text-coral",
                      )}
                    >
                      {accountType}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.display_name}</span>
                      <span className="block text-xs leading-snug text-navy/60">
                        {p.role.replace("_", " ")}
                      </span>
                    </span>
                    {active && <Check className="mt-1 h-4 w-4 shrink-0 text-blue" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
