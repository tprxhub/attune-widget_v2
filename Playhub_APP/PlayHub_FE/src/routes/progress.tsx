import { sessionDayStreak } from "@/features/progress/sessionStreak";
import { SessionEditStamp } from "@/components/SessionEditStamp";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Flame,
  MessageSquareHeart,
  Sparkles,
  Stethoscope,
  Trophy,
} from "lucide-react";
import { listAttempts } from "@/api/attempts";
import { listGoals, listPlans } from "@/api/plans";
import { currentPlanDoses, getProgress, progressNextSteps } from "@/api/progress";
import { dosesPassed } from "@/features/progress/insights";
import type { Attempt, ProgressReport } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { AttemptScore } from "@/components/AttemptScore";
import { ParentWinNote } from "@/components/ParentWinNote";
import { ChartSkeleton, CardSkeleton } from "@/components/Skeletons";
import { StatusBadge, StatusIcon } from "@/components/StatusBadge";
import { FloatingPanel } from "@/components/FloatingPanel";
import { LEVEL_TOKEN, TOKEN_BG, TOKEN_SOFT } from "@/components/brand";
import { ProgressChart } from "@/features/progress/LazyProgressChart";
import { SupportMoodRings } from "@/features/progress/SupportMoodRings";
import { useActiveChild } from "@/lib/active-child";
import { CONSULT_BOOKING_URL } from "@/lib/contact";
import { cn } from "@/lib/utils";
import { printReport } from "@/lib/print-report";
import { playPlanName } from "@/lib/planNames";
import { ProgressIcon } from "@/components/ProgressIcon";
import attuneIcon from "@/assets/Icon_of_Service/Attune_icon.png";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Play Hub" },
      {
        name: "description",
        content:
          "Weekly Support Score and Mood trends across every Session, with a plain-language read of what's happening.",
      },
      { property: "og:title", content: "Progress — Play Hub" },
      {
        property: "og:description",
        content: "Weekly Support Score and Mood trends across every logged Session.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Protected>
      <ProgressPage />
    </Protected>
  ),
});

/* ---------- derived, presentation-only insights ---------- */

/* ---------- small pieces ---------- */

/** A compact figure for the dark summary panel: icon badge, number, label. */
function MiniStat({
  icon: Icon,
  value,
  label,
  sub,
}: {
  icon: typeof Flame;
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber text-navy">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-2xl leading-none font-bold">{value}</p>
          <p className="text-sm font-bold text-cream/85">{label}</p>
        </div>
        {sub && <p className="truncate text-[11px] text-cream/55">{sub}</p>}
      </div>
    </div>
  );
}

type PlanFilterOption = {
  id: string;
  title: string;
  level: "Rookie" | "Starter" | "Pro";
};

function PlanFilterDropdown({
  plans,
  value,
  onChange,
}: {
  plans: PlanFilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = [{ id: "all", title: "All Play Plans", level: null }, ...plans] as const;
  const selected = plans.find((plan) => plan.id === value);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openAndFocus = () => {
    setOpen(true);
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveFocus = (direction: 1 | -1) => {
    const current = optionRefs.current.findIndex((option) => option === document.activeElement);
    const next =
      current < 0 ? selectedIndex : (current + direction + options.length) % options.length;
    optionRefs.current[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative min-w-0 sm:col-span-2 lg:col-span-1">
      <span
        id="progress-plan-filter-label"
        className="mb-1.5 block text-[11px] font-bold tracking-wide text-navy/55 uppercase"
      >
        Play Plan
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby="progress-plan-filter-label progress-plan-filter-value"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAndFocus();
          }
        }}
        className={cn(
          "group flex h-[3.25rem] w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left outline-none transition",
          open
            ? "border-blue ring-2 ring-blue/15"
            : "border-navy/15 hover:border-blue/45 hover:bg-white focus-visible:border-blue focus-visible:ring-2 focus-visible:ring-blue/20",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-extrabold tracking-wide",
            selected ? TOKEN_SOFT[LEVEL_TOKEN[selected.level]] : "bg-navy/8 text-navy/65",
          )}
          aria-hidden
        >
          {selected ? selected.level.slice(0, 1) : "ALL"}
        </span>
        <span className="min-w-0 flex-1">
          <span
            id="progress-plan-filter-value"
            className="block truncate text-sm font-bold text-navy"
          >
            {selected?.title ?? "All Play Plans"}
          </span>
          <span className="block truncate text-[11px] text-navy/50">
            {selected ? `${selected.level} level` : `${plans.length} tracked Play Plans`}
          </span>
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/5 transition group-hover:bg-blue/10">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-navy/55 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <FloatingPanel
          anchorRef={triggerRef}
          panelRef={panelRef}
          className="w-[min(23rem,calc(100vw-3rem))] rounded-2xl border border-navy/10 bg-card shadow-[var(--shadow-lift)]"
        >
          <div className="border-b border-navy/8 bg-navy/[0.025] px-4 py-3">
            <p className="text-xs font-bold text-navy">Filter by Play Plan</p>
            <p className="mt-0.5 text-[11px] text-navy/50">
              Only plans with logged Sessions are shown.
            </p>
          </div>
          <div
            role="listbox"
            aria-labelledby="progress-plan-filter-label"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveFocus(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveFocus(-1);
              } else if (event.key === "Home") {
                event.preventDefault();
                optionRefs.current[0]?.focus();
              } else if (event.key === "End") {
                event.preventDefault();
                optionRefs.current[options.length - 1]?.focus();
              }
            }}
            className="max-h-72 space-y-1 overflow-y-auto p-2"
          >
            {options.map((option, index) => {
              const active = option.id === value;
              return (
                <button
                  key={option.id}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(option.id)}
                  className={cn(
                    "grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition",
                    active
                      ? "bg-blue/10"
                      : "hover:bg-navy/4 focus-visible:bg-navy/4 focus-visible:ring-2 focus-visible:ring-blue/20",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl text-[10px] font-extrabold tracking-wide",
                      option.level ? TOKEN_SOFT[LEVEL_TOKEN[option.level]] : "bg-navy text-cream",
                    )}
                    aria-hidden
                  >
                    {option.level ? option.level.slice(0, 1) : "ALL"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-navy">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-navy/50">
                      {option.level
                        ? `${option.level} level`
                        : `Compare all ${plans.length} tracked plans`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full",
                      active ? "bg-blue text-white" : "bg-navy/5 text-transparent",
                    )}
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

export function ProgressPage() {
  const { isFreeGated, canManageSubscription, canLeaveConsultNotes } = useCapabilities();
  const { session } = useSession();
  const { activeChild, isLoading } = useActiveChild();
  const childId = activeChild?.id;
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const report = useQuery({
    queryKey: ["progress", childId],
    queryFn: () => getProgress(childId!),
    enabled: !!childId,
  });
  const attempts = useQuery({
    queryKey: ["attempts", childId],
    queryFn: () => listAttempts(childId!),
    enabled: !!childId,
  });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const goals = useQuery({ queryKey: ["goals"], queryFn: () => listGoals() });
  // The graph follows one Play Plan through its dose levels.
  const chartPlans = useMemo(
    () =>
      (goals.data ?? []).map((goal) => ({
        id: goal.id,
        title: playPlanName(goal),
      })),
    [goals.data],
  );
  const allRows = useMemo(() => attempts.data ?? [], [attempts.data]);
  const usedPlans = useMemo(
    () =>
      (plans.data ?? []).filter((plan) => allRows.some((attempt) => attempt.planId === plan.id)),
    [plans.data, allRows],
  );
  const rows = useMemo(
    () =>
      allRows.filter(
        (attempt) =>
          (planFilter === "all" || attempt.planId === planFilter) &&
          (!fromDate || attempt.date >= fromDate) &&
          (!toDate || attempt.date <= toDate),
      ),
    [allRows, planFilter, fromDate, toDate],
  );
  const hasActiveFilters = planFilter !== "all" || Boolean(fromDate) || Boolean(toDate);

  if (isLoading) {
    return (
      <>
        <PageHeader eyebrow="Tracking" title="Progress" />
        <ChartSkeleton />
      </>
    );
  }

  if (!activeChild) {
    const canEnrol = session.role === "educator";
    return (
      <>
        <PageHeader eyebrow="Tracking" title="Progress" />
        <div className="ph-card p-8 text-center">
          <p className="text-lg font-bold">No members to show yet</p>
          <p className="mt-2 text-sm text-navy/70">
            {canEnrol
              ? "Progress appears here once a member is enrolled and their first Session is logged."
              : "Add a member and log a first Session to see progress here."}
          </p>
          <Link
            to={canEnrol ? "/org" : "/plans"}
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
          >
            {canEnrol ? "Go to Members" : "Browse Play Plans"}
          </Link>
        </div>
      </>
    );
  }

  const data = report.data;
  const consultNotes = allRows
    .filter((a) => a.consultNotes)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  // A plain tally for the plan the child is on now; never an average across doses.
  const dosesTally = data ? dosesPassed(currentPlanDoses(data)) : { passed: 0, total: 0 };
  const nextSteps = data ? progressNextSteps(data) : [];
  const summaryPlan = chartPlans.find((plan) => plan.id === data?.currentPlanId);
  const summarySession = [...allRows]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .find((row) => row.goalId === data?.currentPlanId);
  const needsConsult = data?.status === "holding_steady" || data?.status === "needs_check_in";
  // Subscribed family parents can book a 1:1 Play Consultation at any time.
  const showConsult = !isFreeGated && (needsConsult || canManageSubscription);
  // Cards in the guidance row, so the grid never leaves an empty column.

  const progressInsights = data ? (
    <section
      aria-labelledby="next-steps-heading"
      className="relative isolate h-full overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-navy via-navy to-blue p-5 text-cream shadow-[0_18px_40px_-24px_rgba(3,33,72,0.85)] sm:p-6"
    >
      <span
        className="pointer-events-none absolute -top-16 -right-12 -z-10 h-40 w-40 rounded-full border-[28px] border-white/[0.06]"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-20 -left-16 -z-10 h-44 w-44 rounded-full bg-amber/10 blur-2xl"
        aria-hidden
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber text-navy shadow-[0_10px_24px_-12px_rgba(255,183,77,0.9)]">
            <ProgressIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow text-amber">Your next steps</p>
            <h2 id="next-steps-heading" className="mt-0.5 text-xl font-bold text-white">
              Progress insights
            </h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-cream/75 uppercase backdrop-blur-sm">
          {nextSteps.length} {nextSteps.length === 1 ? "action" : "actions"}
        </span>
      </div>

      <div className="mt-5 rounded-xl bg-white p-4 text-navy">
        <h3 className="text-lg font-bold">What am I seeing?</h3>
        <p className="mt-2 text-sm leading-relaxed text-navy/75">{data.narrative}</p>
      </div>
      <div className="mt-4 rounded-xl bg-white p-4 text-navy">
        <h3 className="text-lg font-bold">What does it mean?</h3>
        <div className="mt-2 space-y-3">
          {nextSteps.map((step) => (
            <p key={step.title} className="text-sm leading-relaxed text-navy/75">
              {step.body}
            </p>
          ))}
        </div>
      </div>
      <Link
        to="/attune"
        search={{
          mode: "progress",
          q: `What does ${activeChild.name}’s progress chart mean, and what might come next?`,
        }}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-coral px-4 text-sm font-bold text-white hover:bg-coral/90"
      >
        <img
          src={attuneIcon}
          alt=""
          aria-hidden
          className="h-6 w-6 scale-125 object-contain mix-blend-screen brightness-150 grayscale invert"
        />
        Ask Attune
      </Link>
    </section>
  ) : null;

  return (
    <div ref={reportRef}>
      <PageHeader
        eyebrow="Tracking"
        title="Progress"
        actions={
          data ? (
            <div className="flex flex-wrap items-center gap-2" data-report-exclude>
              <StatusBadge status={data.status} />
              <Link
                to="/attune"
                search={{
                  mode: "progress",
                  q: `What does ${activeChild.name}’s progress chart mean, and what might come next?`,
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue/30 px-4 text-sm font-bold text-blue transition hover:bg-blue/10"
              >
                <Sparkles className="h-4 w-4" aria-hidden /> What does this mean?
              </Link>
              {!isFreeGated && (
                <button
                  type="button"
                  disabled={exporting}
                  onClick={async () => {
                    if (!reportRef.current) return;
                    setExportError("");
                    setExporting(true);
                    try {
                      await printReport(
                        reportRef.current,
                        `Play Hub Progress — ${activeChild.name}`,
                      );
                    } catch (error) {
                      setExportError(
                        error instanceof Error ? error.message : "Could not export this report.",
                      );
                    } finally {
                      setExporting(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-xs font-bold text-cream transition hover:bg-navy/90"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {exporting ? "Preparing report…" : "Export report (PDF)"}
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {exportError && (
        <p role="alert" className="mt-3 text-sm text-coral" data-report-exclude>
          {exportError}
        </p>
      )}
      {report.isLoading || !data ? (
        <div className="mt-5">
          <ChartSkeleton />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Play Hub Summary hero */}
          <section
            className="ph-card overflow-hidden bg-navy p-5 text-cream sm:p-6"
            data-report-summary
          >
            {/* The summary and two compact figures on the left; the shareable celebration on the right. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="flex min-w-0 flex-col">
                <p className="eyebrow text-cream/60">Play Hub Summary</p>
                <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  <span className="rounded-xl bg-white">
                    <StatusIcon status={data.status} size="lg" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-bold sm:text-3xl">
                      {activeChild.name}
                    </h2>

                    <span className="mt-3 inline-flex rounded-xl bg-cream">
                      <StatusBadge status={data.status} size="sm" />
                    </span>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                  <p className="text-xs font-bold tracking-wide text-cream/60 uppercase">
                    Current Play Plan
                  </p>
                  <p className="mt-2 break-words text-xl font-bold">
                    {summaryPlan?.title ?? "No active Play Plan"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber">
                    {currentPlanDoses(data).at(-1)?.level ?? summarySession?.level ?? data.headline}
                  </p>
                  <span
                    className={cn(
                      "mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold",
                      data.status === "needs_check_in"
                        ? "text-coral"
                        : data.status === "holding_steady"
                          ? "text-amber"
                          : "text-cream",
                    )}
                  >
                    <Trophy className="h-3.5 w-3.5" aria-hidden />
                    {dosesTally.total
                      ? `${dosesTally.passed} of ${dosesTally.total} doses passed in this plan`
                      : "First Play Dose in progress"}
                  </span>
                </div>
                <div className="mt-5 grid gap-3">
                  <MiniStat
                    icon={ActivityIcon}
                    value={String(data.totalSessions)}
                    label="Sessions"
                  />
                  <MiniStat
                    icon={Flame}
                    value={String(sessionDayStreak(allRows))}
                    label="Day streak"
                  />
                </div>
                <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cream/60 lg:mt-auto lg:pt-4">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  Last check-in: {data.lastCheckIn ? fmtDate(data.lastCheckIn) : "no Sessions yet"}
                </p>
              </div>
              <SupportMoodRings
                childName={activeChild.name}
                supportScore={data.supportScore}
                rows={allRows}
              />
            </div>
          </section>

          <section className="ph-card p-5" data-report-chart>
            <h2 className="text-lg font-bold">Play Progress</h2>
            <div className="mt-4">
              <ProgressChart
                points={data.points}
                plans={chartPlans}
                currentPlanId={data.currentPlanId}
                sidebar={progressInsights}
                locked={isFreeGated}
              />
            </div>
          </section>

          {/* Guidance under the charts: insights, support, and session history. */}
          <div className="space-y-4" aria-label="Progress guidance">
            {showConsult && (
              <section className="ph-card border-2 border-coral/30 p-5">
                <Stethoscope className="h-6 w-6 text-coral" aria-hidden />
                <h2 className="mt-2 text-lg font-bold">Book a 1:1 Play Consultation</h2>
                <p className="mt-2 text-sm text-navy/70">
                  {needsConsult
                    ? `${data.status === "needs_check_in" ? "The Real-Life Try hasn’t been passed for two doses in a row." : "Support has stayed about the same through this dose."} A paid one-to-one session with a member psychologist can rework the Play Plan around what's actually getting in the way.`
                    : "A paid one-to-one session with a member psychologist, whenever you want a second opinion on the Play Plan — available to you as a subscribed Admin."}
                </p>
                <a
                  href={CONSULT_BOOKING_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white sm:w-auto"
                >
                  <MessageSquareHeart className="h-4 w-4" aria-hidden /> Book a Play Consultation
                </a>
              </section>
            )}
            {isFreeGated && canManageSubscription && (
              <section className="ph-card flex h-full flex-col items-center justify-center border-2 border-coral/25 p-5 text-center">
                <p className="text-sm font-bold">
                  The full Progress chart is part of a subscription
                </p>
                <Link
                  to="/subscription"
                  search={{ checkout: undefined }}
                  className="mt-3 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
                >
                  Upgrade to unlock
                </Link>
              </section>
            )}
            <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
              <section
                className={cn(
                  "ph-card min-w-0 overflow-hidden",
                  !canLeaveConsultNotes && "md:col-span-2",
                )}
                data-report-exclude
              >
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-expanded={historyOpen}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-navy/8 px-5 py-4 text-left transition hover:bg-navy/[0.02]"
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">Session history</h2>
                    <p className="text-xs text-navy/60">
                      {hasActiveFilters
                        ? "Showing filtered check-ins"
                        : "Your check-ins, newest first."}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-navy/6 px-3 py-1 text-[11px] font-bold text-navy/65">
                    {rows.length} Session{rows.length === 1 ? "" : "s"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-navy/55 transition-transform duration-200",
                      historyOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {historyOpen && (
                  <div className="grid gap-3 border-b border-navy/8 bg-navy/[0.025] px-5 py-3 sm:grid-cols-2 sm:items-end ">
                    <div className="flex items-end gap-3 sm:col-span-2">
                      <div className="min-w-0 flex-1">
                        <PlanFilterDropdown
                          plans={usedPlans}
                          value={planFilter}
                          onChange={setPlanFilter}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPlanFilter("all");
                          setFromDate("");
                          setToDate("");
                        }}
                        disabled={!hasActiveFilters}
                        className="h-[3.25rem] shrink-0 rounded-xl border border-blue/15 bg-blue/5 px-3 text-xs font-bold whitespace-nowrap text-blue transition hover:bg-blue/10 disabled:cursor-not-allowed disabled:text-navy/35"
                      >
                        Clear filters
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <span className="text-xs font-bold text-navy/60">Dates</span>
                      {[7, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          className="rounded-full border border-navy/15 bg-card px-3 py-1.5 text-xs font-bold text-blue hover:bg-blue/10"
                          onClick={() => {
                            const end = new Date();
                            const start = new Date(end);
                            start.setDate(start.getDate() - days + 1);
                            const localDate = (date: Date) =>
                              `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                            setFromDate(localDate(start));
                            setToDate(localDate(end));
                          }}
                        >
                          Last {days} days
                        </button>
                      ))}
                    </div>
                    <details className="sm:col-span-2">
                      <summary className="cursor-pointer text-xs font-bold text-blue">
                        {fromDate || toDate
                          ? `${fromDate ? fmtDate(fromDate) : "Any date"} – ${toDate ? fmtDate(toDate) : "Today"}`
                          : "Choose date range"}
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                            From date
                          </span>
                          <input
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(event) => setFromDate(event.target.value)}
                            className="h-[3.25rem] w-full rounded-xl border border-navy/15 bg-card px-3 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                            To date
                          </span>
                          <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(event) => setToDate(event.target.value)}
                            className="h-[3.25rem] w-full rounded-xl border border-navy/15 bg-card px-3 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                )}
                {historyOpen &&
                  (attempts.isLoading ? (
                    <div className="p-5">
                      <CardSkeleton lines={4} />
                    </div>
                  ) : rows.length === 0 ? (
                    <p className="p-5 text-sm text-navy/65">
                      {hasActiveFilters
                        ? "No sessions match these filters. Try another date or plan."
                        : "No sessions logged yet."}
                    </p>
                  ) : (
                    <ul className="max-h-[24rem] divide-y divide-navy/8 overflow-y-auto">
                      {[...rows]
                        .sort(
                          (a, b) =>
                            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
                        )
                        .map((a) => (
                          <li
                            key={a.id}
                            className="px-5 py-3.5 transition-colors hover:bg-navy/[0.02]"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                              <div className="min-w-0 flex-1 basis-40">
                                <p className="truncate text-sm font-bold">{a.activity}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-navy/55">
                                  <span>{fmtDate(a.date)}</span>
                                  <span className="text-navy/25">•</span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 font-bold",
                                      TOKEN_SOFT[LEVEL_TOKEN[a.level]],
                                    )}
                                  >
                                    {a.level}
                                  </span>
                                </div>
                                <SessionEditStamp session={a} />
                              </div>
                              <AttemptScore
                                completion={a.completion}
                                mood={a.mood}
                                completionStatus={a.completionStatus}
                                helpLevel={a.helpLevel}
                              />
                            </div>
                            <ParentWinNote text={a.bigWin} className="mt-2.5" />
                          </li>
                        ))}
                    </ul>
                  ))}
              </section>
              {canLeaveConsultNotes && (
                <details className="group/notes ph-card self-start p-5" data-report-details>
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-lg font-bold">
                    Play Consult Notes{" "}
                    <span className="text-xs text-navy/60">
                      {consultNotes.length} {consultNotes.length === 1 ? "note" : "notes"}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-navy/55 transition-transform group-open/notes:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  {consultNotes.length ? (
                    <ul className="mt-4 space-y-3">
                      {consultNotes.map((a) => (
                        <li key={a.id} className="rounded-xl bg-navy/4 p-3 text-sm">
                          <p className="whitespace-pre-wrap text-navy/80">{a.consultNotes}</p>
                          <p className="mt-2 text-xs text-navy/55">
                            {fmtDate(a.date)} · {a.loggedBy}
                          </p>
                          <SessionEditStamp session={a} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-navy/60">No Play Consult notes yet.</p>
                  )}
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
