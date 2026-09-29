import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Activity, Plus, UserCog, UserPlus, Users } from "lucide-react";
import { assignSupporter, listChildrenForSession } from "@/api/children";
import { getOrg, listSupporters } from "@/api/org";
import { getProgress } from "@/api/progress";
import { listPlans } from "@/api/plans";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { ChildAvatar, TOKEN_BG } from "@/components/brand";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import type { Child } from "@/lib/types";
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
  });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });

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
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-navy/15 bg-card px-5 text-sm font-bold text-navy transition-colors hover:border-navy/40"
              >
                <UserPlus className="h-4 w-4" aria-hidden /> Add a Moderator
              </Link>
              <Link
                to="/org/enroll"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" aria-hidden /> Enrol a child
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* Caseload summary strip */}
      {list.length > 0 && (
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
              value={new Set(list.map((c) => c.currentPlanId.split("-")[0])).size}
            />
          </div>
        </div>
      )}

      {kids.isLoading ? (
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
                planTitle={plans.data?.find((p) => p.id === child.currentPlanId)?.title ?? "—"}
                supporterName={supporters.data?.find((s) => s.id === child.supporterId)?.name}
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
  planTitle,
  supporterName,
}: {
  child: Child;
  planTitle: string;
  supporterName?: string | undefined;
}) {
  const report = useQuery({
    queryKey: ["progress", child.id],
    queryFn: () => getProgress(child.id),
  });
  return (
    <li className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
      <ChildAvatar name={child.name} token={child.colorToken ?? "blue"} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-navy">{child.name}</span>
        <span className="block text-xs text-navy/55">Age {child.age}</span>
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-xs text-navy/60 lg:block">
        {planTitle}
      </span>
      <span className="shrink-0 rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold text-navy/70">
        {supporterName ?? "No Moderator"}
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
  const token = child.colorToken ?? "blue";

  return (
    <article
      className="ph-card ph-rise group relative flex flex-col overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-xl"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <ChildAvatar name={child.name} token={token} size={48} />
          <div className="min-w-0">
            <h2 className="truncate text-lg leading-tight font-bold">{child.name}</h2>
            <p className="truncate text-xs text-navy/55">Age {child.age}</p>
          </div>
        </div>

        <div className="mt-4">
          {report.data && <StatusBadge status={report.data.status} size="sm" />}
        </div>

        <div className="mt-3 rounded-2xl bg-navy/4 p-3">
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
