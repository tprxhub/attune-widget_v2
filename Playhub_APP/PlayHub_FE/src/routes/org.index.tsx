import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Activity,
  Check,
  Loader2,
  Pencil,
  Plus,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { assignSupporter, listChildrenForSession, renameChild } from "@/api/children";
import { getOrg, listSupporters } from "@/api/org";
import { getProgress } from "@/api/progress";
import { listPlans } from "@/api/plans";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { LicenceLimitModal, OrgLicenseNote } from "@/components/OrgLicenseNote";
import { licencesFull } from "@/lib/licences";
import { ChildProgressIcon } from "@/components/ChildProgressIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import type { Child, LicenseType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/org/")({
  head: () => ({
    meta: [
      { title: "Caseload — Play Hub for schools & clinics" },
      {
        name: "description",
        content:
          "Every enrolled member, their Play Plan, status and assigned Moderator in one view.",
      },
      { property: "og:title", content: "Caseload — Play Hub for schools & clinics" },
      { property: "og:description", content: "Every enrolled child, their Play Plan and status." },
    ],
  }),
  component: () => (
    <Protected roles={["educator", "supporter"]} accountTypes={["b2b"]}>
      <OrgChildren />
    </Protected>
  ),
});

function OrgChildren() {
  const { session } = useSession();
  const [view, setView] = useViewMode("org-children");
  const kids = useQuery({
    queryKey: ["children", session.personaId],
    queryFn: () => listChildrenForSession(session),
  });
  const supporters = useQuery({
    queryKey: ["supporters", session.orgId],
    queryFn: () => listSupporters(session.orgId),
    // The staff list comes from admin-only endpoints; Moderators would just get 403s.
    enabled: session.role === "educator",
  });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });
  // Which "licences are all used" message is open, if any.
  const [limit, setLimit] = useState<LicenseType | null>(null);

  const list = kids.data ?? [];
  const assigned = list.filter((c) => c.supporterId).length;

  return (
    <>
      <PageHeader
        eyebrow={org.data ? `${org.data.name} · ${org.data.kind}` : "Caseload"}
        title="Children"
        description="Every child enrolled under your organisation, with their current Play Plan and status."
        actions={
          session.role === "educator" ? (
            <div className="flex flex-wrap gap-2">
              <Link
                to="/org/supporters"
                onClick={(event) => {
                  if (!licencesFull(org.data, "moderators")) return;
                  event.preventDefault();
                  setLimit("moderators");
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-navy/15 bg-card px-5 text-sm font-bold text-navy transition-colors hover:border-navy/40"
              >
                <UserPlus className="h-4 w-4" aria-hidden /> Add a Moderator
              </Link>
              <Link
                to="/org/enroll"
                onClick={(event) => {
                  if (!licencesFull(org.data, "children")) return;
                  event.preventDefault();
                  setLimit("children");
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" aria-hidden /> Enrol a child in a Play Plan
              </Link>
            </div>
          ) : undefined
        }
      />
      {/* Licences are the organisation admin's business; Moderators don't see them. */}
      {session.role === "educator" && <OrgLicenseNote org={org.data} kind="children" />}
      {limit && org.data && (
        <LicenceLimitModal org={org.data} kind={limit} onClose={() => setLimit(null)} />
      )}

      {/* Caseload summary strip */}
      {list.length > 0 && !plans.isLoading && (
        <div className="ph-card relative overflow-hidden bg-navy p-5 text-cream">
          <span
            className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 bg-cream/8"
            style={{ borderRadius: "9999px" }}
            aria-hidden
          />
          <div className="relative grid gap-4 sm:grid-cols-3">
            <SummaryStat label="Children enrolled" value={list.length} />
            <SummaryStat label="With a Moderator" value={`${assigned} / ${list.length}`} />
            <SummaryStat
              label="Skill areas in play"
              value={
                new Set(
                  list
                    .map(
                      (child) =>
                        plans.data?.find((plan) => plan.id === child.currentPlanId)?.goalId,
                    )
                    .filter(Boolean),
                ).size
              }
            />
          </div>
        </div>
      )}

      {kids.isLoading || plans.isLoading || supporters.isLoading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : list.length === 0 ? (
        <div className="ph-card mt-5 p-10 text-center">
          <Users className="mx-auto h-9 w-9 text-navy/35" aria-hidden />
          <p className="mt-3 text-lg font-bold">No children enrolled yet</p>
          <p className="mt-2 text-sm text-navy/65">
            Enrol your first child to start assigning Play Plans.
          </p>
        </div>
      ) : view === "list" ? (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
              {list.length} child{list.length === 1 ? "" : "ren"}
            </p>
            <ViewToggle mode={view} onChange={setView} />
          </div>
          <ul className="ph-card mt-3 divide-y divide-navy/8 p-0">
            {list.map((child) => (
              <ChildRow
                key={child.id}
                child={child}
                canRename={session.role === "educator"}
                planTitle={plans.data?.find((p) => p.id === child.currentPlanId)?.title ?? "—"}
                supporterName={
                  child.supporterId === session.userId
                    ? session.name
                    : supporters.data?.find((s) => s.id === child.supporterId)?.name
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
              {list.length} child{list.length === 1 ? "" : "ren"}
            </p>
            <ViewToggle mode={view} onChange={setView} />
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((child, i) => (
              <ChildCard
                key={child.id}
                index={i}
                child={child}
                planTitle={plans.data?.find((p) => p.id === child.currentPlanId)?.title ?? "—"}
                supporters={supporters.data ?? []}
                canAssign={session.role === "educator"}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ChildRow({
  child,
  canRename,
  planTitle,
  supporterName,
}: {
  child: Child;
  canRename: boolean;
  planTitle: string;
  supporterName?: string | undefined;
}) {
  const report = useQuery({
    queryKey: ["progress", child.id],
    queryFn: () => getProgress(child.id),
  });
  return (
    <li className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
      <ChildProgressIcon childId={child.id} size={40} />
      <div className="min-w-0 flex-1">
        <ChildName child={child} canRename={canRename} className="text-sm text-navy" />
        <span className="block text-xs text-navy/55">Age {child.age}</span>
      </div>
      <span className="hidden min-w-0 flex-1 truncate text-xs text-navy/60 lg:block">
        {planTitle}
      </span>
      <span className="shrink-0 rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold text-navy/70">
        {supporterName ?? (child.supporterId ? "Moderator assigned" : "No Moderator")}
      </span>
      {report.data && <StatusBadge status={report.data.status} size="sm" />}
      <Link
        to="/plans/$planId"
        params={{ planId: child.currentPlanId }}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-navy/15 px-4 text-xs font-bold text-navy hover:border-navy/40"
      >
        Open Play Plan <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </li>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.14em] text-cream/60 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-amber">{value}</p>
    </div>
  );
}

function ChildCard({
  child,
  planTitle,
  supporters,
  canAssign,
  index,
}: {
  child: Child;
  planTitle: string;
  supporters: { id: string; name: string }[];
  canAssign: boolean;
  index: number;
}) {
  const queryClient = useQueryClient();
  const report = useQuery({
    queryKey: ["progress", child.id],
    queryFn: () => getProgress(child.id),
  });
  const assign = useMutation({
    mutationFn: (supporterId: string) => assignSupporter(child.id, supporterId || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children"] }),
  });

  return (
    <article
      className="ph-card ph-rise group relative flex flex-col overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-xl"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5">
          <ChildProgressIcon childId={child.id} size={64} />
          <div className="min-w-0">
            <ChildName child={child} canRename={canAssign} heading className="text-lg" />
            <p className="truncate text-xs text-navy/55">Age {child.age}</p>
            {report.data && (
              <div className="mt-1.5">
                <StatusBadge status={report.data.status} size="sm" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-navy/4 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
            <Activity className="h-3.5 w-3.5" aria-hidden /> Current Play Plan
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-bold text-navy">{planTitle}</p>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-blue/8 p-3">
            <dt className="font-bold tracking-wide text-blue/70 uppercase">Sessions</dt>
            <dd className="mt-0.5 text-2xl font-bold text-blue">
              {report.data?.totalSessions ?? "—"}
            </dd>
          </div>
          <div className="rounded-2xl bg-coral/8 p-3">
            <dt className="font-bold tracking-wide text-coral/80 uppercase">Activities</dt>
            <dd className="mt-0.5 text-2xl font-bold text-coral">
              {report.data?.activitiesCompleted ?? "—"}
            </dd>
          </div>
        </dl>

        {canAssign && (
          <label className="mt-4 block">
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
              <UserCog className="h-3.5 w-3.5" aria-hidden /> Assigned Moderator
            </span>
            <Select
              value={child.supporterId ?? ""}
              onChange={(nextId) => assign.mutate(nextId)}
              options={[
                { value: "", label: "Not assigned" },
                ...supporters.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="mt-1.5 min-h-11 rounded-xl border-2 border-navy/12"
            />
          </label>
        )}

        <Link
          to="/plans/$planId"
          params={{ planId: child.currentPlanId }}
          className="mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-navy px-5 pt-0 text-sm font-bold text-cream transition-colors hover:bg-blue"
          style={{ marginTop: "1rem" }}
        >
          Open Play Plan{" "}
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </article>
  );
}

/** A child's name, with an inline rename for the organisation admin. */
function ChildName({
  child,
  canRename,
  heading = false,
  className,
}: {
  child: Child;
  canRename: boolean;
  heading?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rename = useMutation({
    mutationFn: (name: string) => renameChild(child.id, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["children"] });
      setDraft(null);
      setError("");
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : "Could not rename this child."),
  });
  const Name = heading ? "h2" : "span";
  const inputId = `child-name-${child.id}`;

  if (draft === null) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Name className={cn("block truncate leading-tight font-bold", className)}>
          {child.name}
        </Name>
        {canRename && (
          <button
            type="button"
            onClick={() => {
              setDraft(child.name);
              setError("");
            }}
            aria-label={`Edit ${child.name}'s name`}
            title="Edit name"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-navy/50 transition hover:bg-navy/6 hover:text-navy"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </span>
    );
  }

  const save = () => {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return setError("Please enter the child's name.");
    if (name === child.name) return setDraft(null);
    rename.mutate(name);
  };
  return (
    <form
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Child's name
      </label>
      <div className="flex min-w-0 items-center gap-1">
        <input
          id={inputId}
          autoFocus
          maxLength={120}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDraft(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="min-h-9 w-full min-w-0 flex-1 rounded-xl border border-navy/15 bg-card px-3 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25"
        />
        <button
          type="submit"
          disabled={rename.isPending}
          aria-label="Save name"
          title="Save"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-white disabled:opacity-60"
        >
          {rename.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          aria-label="Cancel"
          title="Cancel"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-navy/60 hover:bg-navy/6"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-coral">
          {error}
        </p>
      )}
    </form>
  );
}
