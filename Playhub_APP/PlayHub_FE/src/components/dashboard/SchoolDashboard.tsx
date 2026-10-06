import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  ChevronDown,
  HeartHandshake,
  Plus,
  TriangleAlert,
  Users,
} from "lucide-react";
import { getOrg, listSupporters } from "@/api/org";
import { listGoals } from "@/api/plans";
import { getProgress, STATUS_META } from "@/api/progress";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { ChildAvatar } from "@/components/brand";
import { CardSkeleton } from "@/components/Skeletons";
import { ConsultationCard, ComingSoonTiles } from "@/components/dashboard/DashboardExtras";
import { ProgressChart } from "@/features/progress/LazyProgressChart";
import { StatusBadge } from "@/components/StatusBadge";
import { ALL_CHILDREN, useActiveChild } from "@/lib/active-child";
import { fmtDate } from "@/lib/format";
import type { Child, ProgressReport, StaffMember, StatusKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgressPage } from "@/routes/progress";
import { useAppSelector } from "@/store/hooks";
import { selectActiveChildOverride } from "@/store/active-child-slice";

const NEEDS_ATTENTION: StatusKey[] = ["needs_check_in", "holding_steady"];

interface Row {
  child: Child;
  report: ProgressReport | undefined;
  supporter: StaffMember | undefined;
}

export function SchoolDashboard() {
  const { session } = useSession();
  const { children, isLoading, setActiveChildId } = useActiveChild();
  const override = useAppSelector(selectActiveChildOverride);
  const [filter, setFilter] = useState<StatusKey | "all" | "attention">("all");

  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });
  const supporters = useQuery({
    queryKey: ["supporters", session.orgId],
    queryFn: () => listSupporters(session.orgId),
  });
  const goals = useQuery({ queryKey: ["goals"], queryFn: () => listGoals() });
  // The graph follows one Play Plan (a goal) through its levels, like the Progress page.
  const chartPlans = useMemo(
    () => (goals.data ?? []).map((goal) => ({ id: goal.id, title: goal.name })),
    [goals.data],
  );
  const reports = useQueries({
    queries: children.map((child) => ({
      queryKey: ["progress", child.id],
      queryFn: () => getProgress(child.id),
    })),
  });

  const rows: Row[] = useMemo(
    () =>
      children.map((child, index) => {
        return {
          child,
          report: reports[index]?.data,
          supporter: supporters.data?.find((member) => member.id === child.supporterId),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children, supporters.data, reports.map((r) => r.dataUpdatedAt).join(",")],
  );

  const selected =
    override && override !== ALL_CHILDREN
      ? rows.find((row) => row.child.id === override)
      : undefined;
  const firstName = session.name.split(" ")[0];

  if (isLoading) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <CardSkeleton lines={4} />
      </div>
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/check-in"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/40"
      >
        <CalendarCheck className="h-4 w-4" aria-hidden /> Daily Check-In
      </Link>
      <Link
        to="/org/enroll"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white shadow-[var(--shadow-card)]"
      >
        <Plus className="h-4 w-4" aria-hidden /> Enrol a child
      </Link>
    </div>
  );

  if (children.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Welcome back" title={`Hello, ${firstName}`} actions={actions} />
        <div className="ph-card p-10 text-center">
          <Users className="mx-auto h-9 w-9 text-navy/35" aria-hidden />
          <p className="mt-3 text-lg font-bold">No children enrolled yet</p>
          <p className="mt-2 text-sm text-navy/65">
            Enrol your first child to see progress, moderators and check-ins here.
          </p>
        </div>
      </>
    );
  }

  if (selected) {
    return <ProgressPage />;
  }

  const withModerator = rows.filter((row) => row.child.supporterId).length;
  const sessions = rows.reduce((sum, row) => sum + (row.report?.totalSessions ?? 0), 0);
  const attention = rows.filter((row) => row.report && NEEDS_ATTENTION.includes(row.report.status));
  const unassigned = rows.filter((row) => !row.child.supporterId);

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.report?.status ?? "no_data";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const visible = rows.filter((row) => {
    if (filter === "all") return true;
    const status = row.report?.status ?? "no_data";
    return filter === "attention" ? NEEDS_ATTENTION.includes(status) : status === filter;
  });

  return (
    <>
      <PageHeader
        eyebrow="Welcome back"
        title="Here's your Play Hub"
        description={`Every child, every moderator and what needs your eye today${
          org.data ? ` at ${org.data.name}` : ""
        }.`}
        actions={actions}
      />

      <section aria-label="Overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} tone="blue" label="Children enrolled" value={rows.length} />
        <Stat
          icon={HeartHandshake}
          tone="coral"
          label="With a moderator"
          value={`${withModerator} / ${rows.length}`}
          hint={unassigned.length ? `${unassigned.length} still unassigned` : "Everyone is covered"}
        />
        <Stat icon={Activity} tone="navy" label="Sessions logged" value={sessions} />
        <Stat
          icon={TriangleAlert}
          tone={attention.length ? "amber" : "blue"}
          label="Need attention"
          value={attention.length}
          hint={attention.length ? "Holding steady or needs a check-in" : "All on track"}
          onClick={attention.length ? () => setFilter("attention") : undefined}
        />
      </section>

      <section aria-label="Children" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow text-blue">Children</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              All <span className="opacity-60">{rows.length}</span>
            </Chip>
            {attention.length > 0 && (
              <Chip active={filter === "attention"} onClick={() => setFilter("attention")}>
                Needs attention <span className="opacity-60">{attention.length}</span>
              </Chip>
            )}
            {(Object.keys(STATUS_META) as StatusKey[])
              .filter((key) => counts[key])
              .map((key) => (
                <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>
                  {STATUS_META[key].label} <span className="opacity-60">{counts[key]}</span>
                </Chip>
              ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="ph-card mt-4 p-8 text-center text-sm text-navy/65">
            No children match this filter.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
            {visible.map((row, index) => (
              <ChildTile
                key={row.child.id}
                row={row}
                chartPlans={chartPlans}
                index={index}
                onOpen={() => setActiveChildId(row.child.id)}
              />
            ))}
          </div>
        )}
      </section>

      <ModeratorPanel
        supporters={(supporters.data ?? []).filter((member) => member.role === "supporter")}
        unassigned={unassigned.length}
      />

      <ComingSoonTiles />
      <ConsultationCard />
    </>
  );
}

/* ---------- pieces ---------- */

const TONES = {
  blue: "bg-blue/12 text-blue",
  coral: "bg-coral/12 text-coral",
  amber: "bg-amber/30 text-navy",
  navy: "bg-navy/10 text-navy",
} as const;

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  onClick,
}: {
  icon: typeof Users;
  tone: keyof typeof TONES;
  label: string;
  value: string | number;
  hint?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  const body = (
    <>
      <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", TONES[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-3xl leading-none font-bold text-navy">{value}</p>
      <p className="mt-1.5 text-sm font-semibold text-navy/70">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-navy/50">{hint}</p>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="ph-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {body}
    </button>
  ) : (
    <div className="ph-card p-5">{body}</div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition",
        active
          ? "border-navy bg-navy text-white"
          : "border-navy/15 bg-card text-navy/75 hover:border-navy/35",
      )}
    >
      {children}
    </button>
  );
}

function ModeratorChip({ supporter }: { supporter: StaffMember | undefined }) {
  return supporter ? (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full bg-navy/5 py-1 pr-3 pl-1 text-xs font-bold text-navy">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-[10px] text-cream">
        {supporter.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="truncate">{supporter.name}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/30 px-3 py-1.5 text-xs font-bold text-navy">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Not assigned
    </span>
  );
}

function ChildTile({
  row,
  chartPlans,
  index,
  onOpen,
}: {
  row: Row;
  chartPlans: Array<{ id: string; title: string }>;
  index: number;
  onOpen: () => void;
}) {
  const { child, report, supporter } = row;
  const [open, setOpen] = useState(false);
  return (
    <article
      className={cn("ph-card ph-rise flex flex-col p-5 sm:p-6", open && "2xl:col-span-2")}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <ChildAvatar name={child.name} token={child.colorToken ?? "blue"} size={56} />
          <div className="min-w-0">
            <h3 className="truncate text-xl leading-tight font-bold">{child.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-navy/55">Age {child.age}</span>
              <StatusBadge status={report?.status ?? "no_data"} size="sm" />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 text-xs font-bold text-white transition hover:bg-navy/90"
        >
          View <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* Same three columns on every card, so the figures line up across the grid. */}
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-navy/8 pt-4 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:gap-x-8">
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
            Sessions
          </dt>
          <dd className="mt-1.5 text-xl leading-none font-bold">{report?.totalSessions ?? 0}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] whitespace-nowrap text-navy/45 uppercase">
            Last check-in
          </dt>
          <dd className="mt-1.5 text-sm leading-5 font-semibold whitespace-nowrap text-navy/75">
            {report?.lastCheckIn ? fmtDate(report.lastCheckIn) : "None yet"}
          </dd>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
            Moderator
          </dt>
          <dd className="mt-1">
            <ModeratorChip supporter={supporter} />
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`progress-graph-${child.id}`}
        className="mt-5 flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-navy/[0.035] px-4 text-left text-sm font-bold text-navy transition hover:bg-navy/[0.06]"
      >
        <span>{open ? "Hide progress graph" : "Show progress graph"}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div id={`progress-graph-${child.id}`} className="mt-4">
          {report && report.points.length > 0 ? (
            <ProgressChart
              points={report.points}
              plans={chartPlans}
              currentPlanId={report.currentPlanId}
            />
          ) : (
            <div className="grid h-40 place-items-center rounded-2xl bg-navy/[0.035] px-4 text-center text-sm text-navy/55">
              Progress appears after the first check-in.
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ModeratorPanel({
  supporters,
  unassigned,
}: {
  supporters: StaffMember[];
  unassigned: number;
}) {
  return (
    <section className="ph-card mt-7 p-5" aria-label="Moderators">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-blue">Moderators</p>
        <Link to="/org/supporters" className="text-xs font-bold text-coral hover:underline">
          Manage
        </Link>
      </div>
      {supporters.length === 0 ? (
        <p className="mt-3 text-sm text-navy/65">
          No moderators yet. Add one so check-ins can be logged for their children.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {supporters.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-navy/[0.035] p-3"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-cream">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{member.name}</span>
                  <span className="block text-[11px] text-navy/50">
                    {member.invitationPending ? "Invitation pending" : "Active"}
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-bold text-navy">
                {member.childCount} {member.childCount === 1 ? "child" : "children"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {unassigned > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border-l-4 border-amber bg-amber/15 p-3 text-xs text-navy/80">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong>{unassigned}</strong> {unassigned === 1 ? "child has" : "children have"} no
            moderator, so nobody is logging their check-ins.{" "}
            <Link to="/org" className="font-bold text-coral hover:underline">
              Assign now
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
