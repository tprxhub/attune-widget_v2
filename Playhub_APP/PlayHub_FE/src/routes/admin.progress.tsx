import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronDown,
  Download,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  listPlatformProgress,
  progressCsv,
  type AdminProgressGroup,
  type AdminProgressRow,
} from "@/api/admin-progress";
import { planById } from "@/api/domain";
import { STATUS_META } from "@/api/progress";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { ChildAvatar, TOKEN_SOFT } from "@/components/brand";
import { CardSkeleton } from "@/components/Skeletons";
import { fmtDate } from "@/lib/format";
import { useOrgScope } from "@/lib/org-scope";
import type { StatusKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/progress")({
  head: () => ({
    meta: [
      { title: "Progress across the platform — Play Hub admin" },
      {
        name: "description",
        content:
          "Super Admin view of progress and Mood trends for every child, by organisation or individual family, with CSV export.",
      },
      { property: "og:title", content: "Progress across the platform — Play Hub admin" },
      {
        property: "og:description",
        content: "Progress and Mood trends for every child, by organisation or family.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]} permission="progress">
      <AdminProgress />
    </Protected>
  ),
});

/* ---------- small helpers ---------- */

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function daysSince(date: string) {
  const then = new Date(`${date}T00:00:00`).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - then) / 86_400_000));
}

function lastSeen(date: string | null) {
  if (!date) return { text: "Never", late: true };
  const days = daysSince(date);
  return {
    text: days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`,
    late: days >= 3,
  };
}

/** Why a child is in the "needs attention" list; empty when nothing is wrong. */
function attentionReasons({ report }: AdminProgressRow) {
  const reasons: string[] = [];
  if (report.status === "needs_check_in") reasons.push("Play Consult suggested");
  if (report.moveDownOffered) reasons.push("Level below suggested");
  if (report.reminderDue) reasons.push("No session for 3+ days");
  return reasons;
}

function groupStats(rows: AdminProgressRow[]) {
  return {
    sessions: rows.reduce((sum, { report }) => sum + report.totalSessions, 0),
  };
}

function StatusPill({ row }: { row: AdminProgressRow }) {
  const { report } = row;
  const meta = STATUS_META[report.status];
  const latest = report.points.filter((point) => point.planId === report.currentPlanId).at(-1);
  const labels: Record<StatusKey, string> = {
    progressing: "Needs less help",
    holding_steady: "Support unchanged",
    settling_in: "Adjusting to a new level",
    first_dose: "First dose completed",
    needs_check_in: "Consult recommended",
    no_data: report.totalSessions ? "Practising" : "Not started yet",
  };
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        TOKEN_SOFT[meta.token],
      )}
    >
      {labels[report.status]}
      {latest && report.status === "no_data" && ` · ${latest.kitSessionsLogged}/5 days`}
    </span>
  );
}

/* ---------- the page ---------- */

function AdminProgress() {
  const groups = useQuery({ queryKey: ["admin-progress"], queryFn: listPlatformProgress });
  const { scopeId: scope } = useOrgScope();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "followup" | "active" | "notstarted">("all");
  const [openChild, setOpenChild] = useState<string | null>(null);

  const all = useMemo(() => groups.data ?? [], [groups.data]);

  // Everything the account scope and the search allow, before the status filter.
  const scoped = useMemo(() => {
    const term = query.trim().toLowerCase();
    const subscriberId = scope.startsWith("subscriber:")
      ? scope.slice("subscriber:".length)
      : undefined;
    return all
      .filter((g) =>
        scope === "all"
          ? true
          : scope === "b2b"
            ? Boolean(g.org)
            : scope === "individual"
              ? !g.org
              : subscriberId
                ? !g.org
                : g.org?.id === scope,
      )
      .map((g) => ({
        ...g,
        rows: g.rows.filter(
          (row) =>
            (!subscriberId || row.child.id === subscriberId) &&
            (!term || row.child.name.toLowerCase().includes(term)),
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [all, scope, query]);

  const visible = useMemo(
    () =>
      status === "all"
        ? scoped
        : scoped
            .map((g) => ({
              ...g,
              rows: g.rows.filter((row) =>
                status === "followup"
                  ? attentionReasons(row).length > 0
                  : status === "notstarted"
                    ? row.report.totalSessions === 0
                    : Boolean(row.report.lastCheckIn && daysSince(row.report.lastCheckIn) < 14),
              ),
            }))
            .filter((g) => g.rows.length > 0),
    [scoped, status],
  );

  const rows = useMemo(() => scoped.flatMap((g) => g.rows), [scoped]);
  const attention = useMemo(
    () =>
      rows
        .map((row) => ({ row, reasons: attentionReasons(row) }))
        .filter((item) => item.reasons.length > 0),
    [rows],
  );
  const totals = useMemo(() => groupStats(rows), [rows]);

  if (groups.isLoading) {
    return (
      <>
        <PageHeader eyebrow="Super Admin" title="Progress" />
        <div className="mt-5 space-y-4">
          {[0, 1].map((i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Progress"
        description="See who is practising and who needs a follow-up. Select a child for details."
        actions={
          <button
            type="button"
            onClick={() =>
              download(
                `play-hub-progress-${scope === "all" ? "platform" : slug(scope)}.csv`,
                progressCsv(visible),
              )
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-cream transition-transform active:scale-95"
          >
            <Download className="h-4 w-4" aria-hidden /> Download CSV
          </button>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Tile
          icon={Users}
          label="Children"
          value={String(rows.length)}
          sub={`${scoped.length} ${scoped.length === 1 ? "account" : "accounts"}`}
        />
        <Tile icon={Activity} label="Sessions" value={String(totals.sessions)} sub="all time" />
        <Tile
          icon={AlertTriangle}
          label="Need attention"
          value={String(attention.length)}
          sub="Missed check-ins or extra support suggested"
          tone={attention.length ? "coral" : "blue"}
        />
      </div>

      <section className="ph-card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            <FilterChip
              label="All"
              count={rows.length}
              active={status === "all"}
              onClick={() => setStatus("all")}
            />
            {(
              [
                ["followup", "Needs follow-up", attention.length],
                [
                  "active",
                  "Active in 14 days",
                  rows.filter(
                    (row) => row.report.lastCheckIn && daysSince(row.report.lastCheckIn) < 14,
                  ).length,
                ],
                [
                  "notstarted",
                  "Not started",
                  rows.filter((row) => row.report.totalSessions === 0).length,
                ],
              ] as const
            ).map(([key, label, count]) => (
              <FilterChip
                key={key}
                label={label}
                count={count}
                active={status === key}
                onClick={() => setStatus(status === key ? "all" : key)}
              />
            ))}
          </div>
          <label className="relative flex min-w-0 items-center md:w-64">
            <Search
              className="pointer-events-none absolute left-3 h-4 w-4 text-navy/40"
              aria-hidden
            />
            <span className="sr-only">Search children by name</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a child"
              className="min-h-11 w-full rounded-full border-2 border-navy/12 bg-card pr-4 pl-9 text-sm font-semibold outline-none focus:border-blue"
            />
          </label>
        </div>
        {(status !== "all" || query) && (
          <button
            type="button"
            onClick={() => {
              setStatus("all");
              setQuery("");
            }}
            className="mt-3 text-xs font-bold text-blue hover:underline"
          >
            Clear filters
          </button>
        )}
      </section>

      <div className="mt-5 space-y-5">
        {visible.map((group) => (
          <GroupCard
            key={group.org?.id ?? "individual"}
            group={group}
            openChild={openChild}
            onToggle={(id) => setOpenChild((cur) => (cur === id ? null : id))}
          />
        ))}
        {visible.length === 0 && (
          <div className="ph-card grid place-items-center gap-3 p-10 text-center text-sm text-navy/60">
            <p>No children match.</p>
            {(status !== "all" || query) && (
              <button
                type="button"
                onClick={() => {
                  setStatus("all");
                  setQuery("");
                }}
                className="font-bold text-blue hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "navy",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone?: "navy" | "blue" | "coral";
}) {
  return (
    <div className="ph-card flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
      <span
        className={cn(
          "hidden h-11 w-11 shrink-0 place-items-center rounded-xl sm:grid",
          tone === "coral" ? "bg-coral/12 text-coral" : "bg-navy/6 text-navy",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">{label}</p>
        <p
          className={cn(
            "text-2xl leading-tight font-bold",
            tone === "coral" ? "text-coral" : "text-navy",
          )}
        >
          {value}
        </p>
        <p className="text-[11px] font-semibold text-navy/45">{sub}</p>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string | undefined;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition",
        active
          ? "border-navy bg-navy text-cream"
          : "border-navy/12 bg-card text-navy/70 hover:border-navy/30 hover:text-navy",
      )}
    >
      {dot && <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-cream/70" : "text-navy/45")}>{count}</span>
    </button>
  );
}

/** Column layout of the table on wide screens; narrow screens stack each row instead. */
const COLUMNS =
  "lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_7rem_5rem] lg:items-center lg:gap-4";

function GroupCard({
  group,
  openChild,
  onToggle,
}: {
  group: AdminProgressGroup;
  openChild: string | null;
  onToggle: (id: string) => void;
}) {
  const stats = groupStats(group.rows);
  const Icon = group.org ? Building2 : Users;
  return (
    <section className="ph-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-cream">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{group.label}</h2>
            <p className="text-xs text-navy/55">
              {group.org ? group.org.kind : "Families"} · {group.rows.length}{" "}
              {group.rows.length === 1 ? "child" : "children"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <dl className="hidden text-right sm:flex">
            <div>
              <dt className="text-[10px] font-bold tracking-wide text-navy/45 uppercase">
                Sessions
              </dt>
              <dd className="text-sm font-bold">{stats.sessions}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() =>
              download(`play-hub-progress-${slug(group.label)}.csv`, progressCsv([group]))
            }
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-2 border-navy/12 px-4 text-xs font-bold transition-colors hover:border-navy/35"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export
          </button>
        </div>
      </header>

      <div
        aria-hidden
        className={cn(
          "hidden border-y border-navy/8 bg-navy/2.5 px-5 py-2 text-[10px] font-bold tracking-wide text-navy/45 uppercase",
          COLUMNS,
        )}
      >
        <span>Child</span>
        <span>Current plan</span>
        <span>Progress / follow-up</span>
        <span>Last check-in</span>
        <span />
      </div>

      <ul className="divide-y divide-navy/8 border-t border-navy/8 lg:border-t-0">
        {group.rows.map((row) => (
          <ChildRow
            key={row.child.id}
            row={row}
            open={openChild === row.child.id}
            onToggle={() => onToggle(row.child.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function ChildRow({
  row,
  open,
  onToggle,
}: {
  row: AdminProgressRow;
  open: boolean;
  onToggle: () => void;
}) {
  const { child, report, planTitle } = row;
  const seen = lastSeen(report.lastCheckIn);
  const reasons = attentionReasons(row);

  return (
    <li id={`child-${child.id}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 text-left transition-colors hover:bg-navy/3",
          COLUMNS,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
          <ChildAvatar name={child.name} token={child.colorToken} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-navy">{child.name}</span>
            <span className="block text-xs text-navy/50">
              {child.age} yrs · {report.totalSessions} sessions
            </span>
          </span>
        </span>

        <span className="hidden min-w-0 truncate text-sm text-navy/75 lg:block">{planTitle}</span>

        <span className="min-w-0 space-y-1">
          <StatusPill row={row} />
          {reasons.length > 0 && (
            <span className="block text-xs text-coral">
              {reasons
                .map((reason) =>
                  reason === "Level below suggested"
                    ? "Try an easier level"
                    : reason === "No session for 3+ days"
                      ? "Check-in overdue"
                      : reason,
                )
                .join(" · ")}
            </span>
          )}
        </span>

        <span
          className={cn(
            "hidden text-xs font-semibold lg:block",
            seen.late ? "text-coral" : "text-navy/60",
          )}
        >
          {seen.text}
        </span>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue">
          {open ? "Close" : "Details"}
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>

        <span className="basis-full text-xs text-navy/55 lg:hidden">
          {planTitle} · {report.totalSessions} sessions · {seen.text.toLowerCase()}
        </span>
      </button>

      {open && <ChildDetail row={row} />}
    </li>
  );
}

function ChildDetail({ row }: { row: AdminProgressRow }) {
  const { child, report } = row;
  const latest = report.points.filter((point) => point.planId === report.currentPlanId).at(-1);
  const dose = latest ? planById(latest.doseId) : undefined;
  const notes: ReactNode[] = [];
  if (report.fastTrackOffered) notes.push("Ready to try the Real-Life skill early");
  for (const reason of attentionReasons(row)) notes.push(reason);

  const facts: Array<[string, string]> = [
    ["Daily check-ins", String(report.checkInCount)],
    ["Activities done", String(report.activitiesCompleted)],
    ["On this plan since", fmtDate(child.planStartedAt)],
  ];

  return (
    <div className="border-t border-navy/8 bg-navy/3 p-4">
      <div className="space-y-4 rounded-2xl bg-card p-4 sm:p-5">
        <div>
          <p className="eyebrow text-blue">Latest Play Dose</p>
          <p className="mt-1 text-sm font-semibold text-navy">
            {latest
              ? `${dose?.title ?? "Play Dose"} · ${latest.level}`
              : "No Play Dose sessions logged yet."}
          </p>
          {latest && (
            <p className="mt-2 text-sm text-navy/65">
              {latest.kitSessionsLogged} of 5 practice days logged · Real-Life Try{" "}
              {latest.days.some((day) => day.isTry) ? "logged" : "not yet logged"}.{" "}
              {latest.complete ? report.narrative : "Continue this dose to see its result."}
            </p>
          )}
        </div>
        {notes.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {notes.map((note, index) => (
              <li
                key={index}
                className="rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold text-navy/75"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
        <dl className="divide-y divide-navy/8 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-navy/55">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
