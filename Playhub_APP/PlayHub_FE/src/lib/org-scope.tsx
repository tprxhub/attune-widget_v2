import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Users } from "lucide-react";
import { listOrgs } from "@/api/admin";
import { listChildrenForSession } from "@/api/children";
import { useSession } from "@/auth/session";
import type { Child } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { orgScopeSelected, selectOrgScope } from "@/store/org-scope-slice";

/**
 * Super Admin only: one platform-wide organisation filter, shared by every admin screen.
 * "b2b" = organisation accounts and "individual" = individual subscribers.
 */
export function useOrgScope() {
  const dispatch = useAppDispatch();
  const scopeId = useAppSelector(selectOrgScope);
  const { session } = useSession();
  const enabled = session.role === "super_admin";
  const { data } = useQuery({ queryKey: ["orgs"], queryFn: listOrgs, enabled });
  const children = useQuery({
    queryKey: ["children", session.personaId],
    queryFn: () => listChildrenForSession(session),
    enabled,
  });

  return useMemo(() => {
    const orgs = data ?? [];
    const subscribers = (children.data ?? []).filter((child) => child.accountType === "b2c");
    const scope = enabled ? scopeId : "all";
    const org = orgs.find((o) => o.id === scope);
    const subscriberId = scope.startsWith("subscriber:")
      ? scope.slice("subscriber:".length)
      : undefined;
    const subscriber = subscribers.find((child) => child.id === subscriberId);
    const isOrganisationScope = scope === "b2b" || Boolean(org);
    const isIndividualScope = scope === "individual" || Boolean(subscriber);
    return {
      orgs,
      subscribers,
      scopeId: scope,
      org,
      subscriber,
      isOrganisationScope,
      isIndividualScope,
      isAll: scope === "all",
      label:
        scope === "all"
          ? "All accounts"
          : scope === "b2b"
            ? "Organisations"
            : scope === "individual"
              ? "Individual subscribers"
              : (subscriber?.name ?? org?.name ?? "All accounts"),
      categoryLabel:
        scope === "all"
          ? "All accounts"
          : isOrganisationScope
            ? "Organisations"
            : "Individual subscribers",
      setScope: (id: string) => dispatch(orgScopeSelected(id)),
      /** Does a record belonging to `orgId` (undefined = family account) fall in scope? */
      matches: (orgId?: string | undefined) => {
        if (scope === "all") return true;
        if (scope === "b2b") return Boolean(orgId);
        if (scope === "individual") return !orgId;
        if (subscriber) return false;
        return orgId === scope;
      },
      matchesChild: (child: Child) => {
        if (scope === "all") return true;
        if (scope === "b2b") return child.accountType === "b2b";
        if (scope === "individual") return child.accountType === "b2c";
        if (subscriber) return child.id === subscriber.id;
        return child.orgId === scope;
      },
    };
  }, [data, children.data, scopeId, enabled, dispatch]);
}

export function OrgScopeDropdown({ className }: { className?: string }) {
  const { session } = useSession();
  const {
    orgs,
    subscribers,
    scopeId,
    org,
    subscriber,
    categoryLabel,
    isOrganisationScope,
    isIndividualScope,
    setScope,
  } = useOrgScope();
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

  if (session.role !== "super_admin") return null;

  const accountType = scopeId === "all" ? "all" : isOrganisationScope ? "b2b" : "individual";
  const triggerLabel =
    scopeId === "all"
      ? "All accounts"
      : isOrganisationScope
        ? `Organisations${org ? ` · ${org.name}` : ""}`
        : `Individual subscribers${subscriber ? ` · ${subscriber.name}` : ""}`;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Account filter: ${categoryLabel}`}
        className="inline-flex min-h-11 max-w-[18rem] items-center gap-2 rounded-xl border border-navy/10 bg-card/80 py-1.5 pr-3 pl-2.5 text-sm font-bold text-navy shadow-[0_1px_0_rgba(16,42,74,0.04)] transition-colors hover:border-blue/40"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue/12 text-blue">
          {isIndividualScope ? (
            <Users className="h-4 w-4" aria-hidden />
          ) : (
            <Building2 className="h-4 w-4" aria-hidden />
          )}
        </span>
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Account filter options"
          className="absolute top-full right-0 z-50 mt-2 w-80 rounded-2xl border border-navy/10 bg-card p-4 text-navy shadow-[0_18px_44px_-14px_rgba(15,42,74,0.35)]"
        >
          <p className="text-[11px] font-bold tracking-[0.14em] text-blue uppercase">
            Account filter
          </p>
          <fieldset className="mt-3">
            <legend className="text-xs font-bold text-navy/70">Show</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-navy/5 p-1">
              {[
                ["all", "All"],
                ["b2b", "Organisations"],
                ["individual", "Subscribers"],
              ].map(([value, label]) => (
                <button
                  key={value!}
                  type="button"
                  onClick={() => setScope(value!)}
                  className={cn(
                    "min-h-10 rounded-lg px-2 text-xs font-bold transition-colors",
                    accountType === value
                      ? "bg-navy text-white shadow-sm"
                      : "text-navy/65 hover:bg-card hover:text-navy",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {isOrganisationScope && (
            <div className="mt-4">
              <p className="text-xs font-bold text-navy/70">Organisation</p>
              <div className="mt-1.5 space-y-1 rounded-xl border border-navy/10 bg-cream p-1.5">
                <ScopeOption
                  active={scopeId === "b2b"}
                  label="All organisations"
                  onClick={() => setScope("b2b")}
                />
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {orgs.map((item) => (
                    <ScopeOption
                      key={item.id}
                      active={scopeId === item.id}
                      label={item.name}
                      onClick={() => {
                        setScope(item.id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {isIndividualScope && (
            <div className="mt-4">
              <p className="text-xs font-bold text-navy/70">Individual subscriber</p>
              <div className="mt-1.5 space-y-1 rounded-xl border border-navy/10 bg-cream p-1.5">
                <ScopeOption
                  active={scopeId === "individual"}
                  label="All individual subscribers"
                  onClick={() => setScope("individual")}
                />
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {subscribers.map((child) => (
                    <ScopeOption
                      key={child.id}
                      active={scopeId === `subscriber:${child.id}`}
                      label={
                        child.parentEmail ? `${child.name} · ${child.parentEmail}` : child.name
                      }
                      onClick={() => {
                        setScope(`subscriber:${child.id}`);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ScopeOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-sm font-semibold transition-colors",
        active ? "bg-blue/12 text-blue" : "text-navy/75 hover:bg-navy/6 hover:text-navy",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
