import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  ChevronDown,
  HeartHandshake,
  Plus,
  Smile,
  TriangleAlert,
  Users,
} from "lucide-react";
import { listAttempts } from "@/api/attempts";
import { assignSupporter } from "@/api/children";
import { getOrg, listSupporters } from "@/api/org";
import { listGoals, listPlans } from "@/api/plans";
import { getProgress, STATUS_META } from "@/api/progress";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { AttemptScore } from "@/components/AttemptScore";
import { ChildAvatar, LevelDots } from "@/components/brand";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ConsultationCard, ComingSoonTiles } from "@/components/dashboard/DashboardExtras";
import { ProgressChart } from "@/features/progress/ProgressChart";
import { StatusBadge } from "@/components/StatusBadge";
import { ALL_CHILDREN, useActiveChild } from "@/lib/active-child";
import { fmtDate } from "@/lib/format";
import type { Child, ProgressReport, StaffMember, StatusKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectActiveChildOverride } from "@/store/active-child-slice";

const NEEDS_ATTENTION: StatusKey[] = ["needs_check_in", "holding_steady"];

interface Row {
  child: Child;
  report: ProgressReport | undefined;
  supporter: StaffMember | undefined;
  planTitle: string;
  level: "Rookie" | "Starter" | "Pro" | undefined;
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
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
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
        const plan = plans.data?.find((item) => item.id === child.currentPlanId);
        return {
          child,
          report: reports[index]?.data,
          supporter: supporters.data?.find((member) => member.id === child.supporterId),
          planTitle: plan?.title ?? "No Play Plan yet",
          level: plan?.level,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children, plans.data, supporters.data, reports.map((r) => r.dataUpdatedAt).join(",")],
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
    return (
      <>
        <PageHeader
          eyebrow={org.data ? org.data.name : "Your school"}
          title={selected.child.name}
          description="Progress, Play Plan and who supports this child."
          actions={actions}
        />
        <ChildDetail
          row={selected}
          supporters={(supporters.data ?? []).filter((member) => member.role === "supporter")}
          onBack={() => setActiveChildId(ALL_CHILDREN)}
        />
        <ComingSoonTiles />
        <ConsultationCard />
      </>
    );
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

function SupportMeter({ score }: { score: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
          Support score
        </span>
        <span className="text-sm font-bold text-navy">
          {score === null ? "—" : score}
          {score !== null && <span className="text-xs font-semibold text-navy/45"> /100</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue to-coral"
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function ModeratorChip({ supporter }: { supporter: StaffMember | undefined }) {
  return supporter ? (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-navy/5 py-1 pr-3 pl-1 text-xs font-bold text-navy">
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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
              Sessions
            </p>
            <p className="mt-0.5 text-xl leading-none font-bold">{report?.totalSessions ?? 0}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] whitespace-nowrap text-navy/45 uppercase">
              Last check-in
            </p>
            <p className="mt-0.5 text-sm font-semibold text-navy/75">
              {report?.lastCheckIn ? fmtDate(report.lastCheckIn) : "None yet"}
            </p>
          </div>
          <ModeratorChip supporter={supporter} />
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 text-xs font-bold text-white transition hover:bg-navy/90"
          >
            View <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

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
            <ProgressChart points={report.points} plans={chartPlans} />
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

function ChildDetail({
  row,
  supporters,
  onBack,
}: {
  row: Row;
  supporters: StaffMember[];
  onBack: () => void;
}) {
  const { child, report, planTitle, level } = row;
  const { setActiveChildId } = useActiveChild();
  const queryClient = useQueryClient();
  const attempts = useQuery({
    queryKey: ["attempts", child.id],
    queryFn: () => listAttempts(child.id),
  });
  const assign = useMutation({
    mutationFn: (supporterId: string) => assignSupporter(child.id, supporterId || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children"] }),
  });
  const recent = [...(attempts.data ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const goals = useQuery({ queryKey: ["goals"], queryFn: () => listGoals() });
  // The graph follows one Play Plan (a goal) through its levels, like the Progress page.
  const chartPlans = (goals.data ?? []).map((goal) => ({ id: goal.id, title: goal.name }));

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-navy/15 px-3.5 text-xs font-bold text-navy/80 hover:border-navy/35"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All children
      </button>

      <section className="relative overflow-hidden rounded-[var(--radius-xl,1.75rem)] bg-navy p-6 text-cream sm:p-7">
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-blue/30 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <ChildAvatar name={child.name} token={child.colorToken ?? "blue"} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{child.name}</h2>
                <StatusBadge status={report?.status ?? "no_data"} size="sm" />
              </div>
              <p className="mt-1 text-sm text-cream/70">
                Age {child.age} · {planTitle}
              </p>
              {level && (
                <div className="mt-2 text-cream">
                  <LevelDots level={level} />
                </div>
              )}
              <p className="mt-3 flex items-center gap-2 text-xs text-cream/65">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                {report?.lastCheckIn
                  ? `Last check-in ${fmtDate(report.lastCheckIn)}`
                  : "No check-ins yet"}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-cream/10 p-4">
            <p className="text-[11px] font-bold tracking-[0.12em] text-cream/60 uppercase">
              Support score
            </p>
            <p className="mt-1 text-4xl font-bold text-amber">
              {report?.supportScore ?? "—"}
              {report?.supportScore != null && (
                <span className="text-base font-semibold text-cream/60"> /100</span>
              )}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream/15">
              <div
                className="h-full rounded-full bg-amber"
                style={{ width: `${report?.supportScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key numbers">
        <Stat icon={Activity} tone="blue" label="Sessions" value={report?.totalSessions ?? 0} />
        <Stat
          icon={CalendarCheck}
          tone="coral"
          label="Activities completed"
          value={report?.activitiesCompleted ?? 0}
        />
        <Stat
          icon={ArrowUpRight}
          tone="navy"
          label="Average completion"
          value={report && report.totalSessions ? `${report.averageCompletion} / 5` : "—"}
        />
        <Stat
          icon={Smile}
          tone="amber"
          label="Average mood"
          value={report && report.totalSessions ? `${report.averageMood} / 5` : "—"}
        />
      </section>

      <section className="ph-card p-5" aria-label="Progress graph">
        <p className="eyebrow text-blue">Progress</p>
        <h2 className="mt-1 text-lg font-bold">Support and mood over time</h2>
        <div className="mt-4">
          <ProgressChart points={report?.points ?? []} plans={chartPlans} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="ph-card p-5">
          <p className="eyebrow text-blue">Next step</p>
          <div className="mt-3 rounded-2xl border-l-4 border-coral bg-cream p-4">
            <p className="text-sm leading-relaxed text-navy/85">
              {report?.narrative ?? "Progress will appear after the first check-in."}
            </p>
          </div>

          <p className="eyebrow mt-5 text-blue">Assigned moderator</p>
          <div className="mt-3">
            <Select
              aria-label={`Moderator for ${child.name}`}
              value={child.supporterId ?? ""}
              onChange={(value) => assign.mutate(value)}
              options={[
                { value: "", label: "Not assigned" },
                ...supporters.map((member) => ({ value: member.id, label: member.name })),
              ]}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/progress"
              onClick={() => setActiveChildId(child.id)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy/90"
            >
              Full progress <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/plans"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-5 text-sm font-bold hover:border-navy/40"
            >
              Play Plans
            </Link>
          </div>
        </section>

        <section className="ph-card p-5">
          <p className="eyebrow text-blue">Recent check-ins</p>
          {attempts.isLoading ? (
            <div className="mt-3">
              <CardSkeleton lines={3} />
            </div>
          ) : recent.length === 0 ? (
            <p className="mt-3 text-sm text-navy/60">No check-ins have been logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-navy/[0.035] p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{attempt.activity}</span>
                    <span className="block text-[11px] text-navy/50">{fmtDate(attempt.date)}</span>
                  </span>
                  <AttemptScore completion={attempt.completion} mood={attempt.mood} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
