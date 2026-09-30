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
  Target,
} from "lucide-react";
import { listAttempts } from "@/api/attempts";
import { listGoals, listPlans } from "@/api/plans";
import { getProgress, progressNextSteps } from "@/api/progress";
import type { Attempt, ProgressReport } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { HeroStat } from "@/components/HeroStat";
import { PageHeader } from "@/components/AppShell";
import { AttemptScore } from "@/components/AttemptScore";
import { ChartSkeleton, CardSkeleton } from "@/components/Skeletons";
import { LockedOverlay } from "@/components/LockedOverlay";
import { StatusBadge } from "@/components/StatusBadge";
import { FloatingPanel } from "@/components/FloatingPanel";
import { MoodIcon, moodMeta } from "@/components/icons";
import { LEVEL_TOKEN, TOKEN_BG, TOKEN_SOFT } from "@/components/brand";
import { ProgressChart } from "@/features/progress/ProgressChart";
import { useActiveChild } from "@/lib/active-child";
import { cn } from "@/lib/utils";
import { childProgressCsv, downloadCsv, slug } from "@/lib/csv";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Play Hub" },
      {
        name: "description",
        content:
          "Weekly Support Score and Mood trends across every Attempt, with a plain-language read of what's happening.",
      },
      { property: "og:title", content: "Progress — Play Hub" },
      {
        property: "og:description",
        content: "Weekly Support Score and Mood trends across every logged Attempt.",
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

function weekKey(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function useInsights(rows: Attempt[]) {
  return useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const best = sorted.reduce<Attempt | null>(
      (acc, a) => (!acc || a.completion >= acc.completion ? a : acc),
      null,
    );

    // Current streak of consecutive weeks with at least one Attempt.
    const weeks = Array.from(new Set(sorted.map((a) => weekKey(a.date)))).sort();
    let streak = 0;
    const currentWeek = new Date(
      `${weekKey(new Date().toISOString().slice(0, 10))}T00:00:00`,
    ).getTime();
    const latestWeek = weeks.length ? new Date(`${weeks[weeks.length - 1]}T00:00:00`).getTime() : 0;
    if (weeks.length && currentWeek - latestWeek <= 7 * 86400000) {
      streak = 1;
      for (let i = weeks.length - 1; i > 0; i--) {
        const cur = new Date(`${weeks[i]}T00:00:00`).getTime();
        const prev = new Date(`${weeks[i - 1]}T00:00:00`).getTime();
        if (cur - prev === 7 * 86400000) streak += 1;
        else break;
      }
    }

    const last4 = sorted.slice(-4);
    const prev4 = sorted.slice(-8, -4);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const shift = prev4.length
      ? Number(
          (avg(last4.map((a) => a.completion)) - avg(prev4.map((a) => a.completion))).toFixed(1),
        )
      : null;

    const moodCounts = [1, 2, 3, 4, 5].map((v) => ({
      value: v,
      count: sorted.filter((a) => a.mood === v).length,
    }));
    const topMood = moodCounts.reduce((a, b) => (b.count > a.count ? b : a), moodCounts[0]!);

    return {
      best,
      streak,
      shift,
      moodCounts,
      topMood,
    };
  }, [rows]);
}

/* ---------- small pieces ---------- */

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
    <div ref={rootRef} className="relative min-w-0 sm:col-span-3">
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
          "group flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left outline-none transition",
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
              Only plans with logged Attempts are shown.
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

function ProgressPage() {
  const { isFreeGated, canManageSubscription, canLeaveConsultNotes } = useCapabilities();
  const { session } = useSession();
  const { activeChild, isLoading } = useActiveChild();
  const childId = activeChild?.id;
  const [historyOpen, setHistoryOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [openNextStep, setOpenNextStep] = useState<number | null>(0);
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
  // The graph follows one Play Plan (a goal, e.g. "Pinch & Grip") through its levels.
  const chartPlans = useMemo(
    () => (goals.data ?? []).map((goal) => ({ id: goal.id, title: goal.name })),
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
  const filteredPoints = useMemo(
    () =>
      (report.data?.points ?? []).filter(
        (point) =>
          // The dropdown lists Play Doses (one level of a plan), so match on the dose id.
          (planFilter === "all" || point.doseId === planFilter) &&
          (!fromDate || point.date >= fromDate) &&
          (!toDate || point.date <= toDate),
      ),
    [report.data?.points, planFilter, fromDate, toDate],
  );
  const insights = useInsights(rows);
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
    const canEnrol = session.role === "educator" || session.role === "supporter";
    return (
      <>
        <PageHeader eyebrow="Tracking" title="Progress" />
        <div className="ph-card p-8 text-center">
          <p className="text-lg font-bold">No children to show yet</p>
          <p className="mt-2 text-sm text-navy/70">
            {canEnrol
              ? "Progress appears here once a child is enrolled and their first Attempt is logged."
              : "Add a child and log a first Attempt to see progress here."}
          </p>
          <Link
            to={canEnrol ? "/org" : "/plans"}
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
          >
            {canEnrol ? "Go to Children" : "Browse Play Plans"}
          </Link>
        </div>
      </>
    );
  }

  const data = report.data;
  const nextSteps = data ? progressNextSteps(data) : [];
  const needsConsult = data?.status === "holding_steady" || data?.status === "needs_check_in";
  // Subscribed family parents can book a 1:1 Play Consultation at any time.
  const showConsult = !isFreeGated && (needsConsult || canManageSubscription);

  return (
    <>
      <PageHeader
        eyebrow="Tracking"
        title="Progress"
        description={`Weekly Support Score and Mood progress for ${activeChild.name}. Lower support means greater independence.`}
        actions={
          data ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={data.status} />
              {!isFreeGated && (
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `play-hub-progress-${slug(activeChild.name)}.csv`,
                      childProgressCsv(activeChild, data, rows),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-xs font-bold text-cream transition hover:bg-navy/90"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Export progress
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {report.isLoading || !data ? (
        <div className="mt-5">
          <ChartSkeleton />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Play Hub Summary hero */}
          <section className="ph-card overflow-hidden bg-navy p-5 text-cream sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-cream/60">Play Hub Summary</p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{data.headline}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/80">
                  {data.narrative}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold",
                  data.status === "needs_check_in"
                    ? "text-coral"
                    : data.status === "holding_steady"
                      ? "text-amber"
                      : "text-cream",
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {insights.shift === null
                  ? "More history needed for comparison"
                  : insights.shift > 0
                    ? `+${insights.shift} vs previous 4`
                    : insights.shift < 0
                      ? `${insights.shift} vs previous 4`
                      : "Level with previous 4"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <HeroStat
                icon={ActivityIcon}
                label="Sessions"
                value={String(data.totalSessions)}
                sub={`${data.activitiesCompleted} Activities Completed`}
              />
              <HeroStat
                icon={Target}
                label="Support Score"
                value={data.supportScore === null ? "—" : `${data.supportScore}%`}
                sub="Average help across kit sessions · lower is better"
              />
              <HeroStat
                icon={Flame}
                label="Weekly streak"
                value={data.totalSessions ? `${insights.streak}w` : "—"}
                sub="Weeks in a row with an Attempt"
                className="col-span-2 sm:col-span-1"
              />
            </div>

            <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cream/60">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Last check-in: {data.lastCheckIn ? fmtDate(data.lastCheckIn) : "no Attempts yet"}
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="min-w-0">
              <section className="ph-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">Weekly Support Score &amp; Mood</h2>
                    <p className="mt-0.5 text-xs text-navy/55">
                      {hasActiveFilters ? "Showing filtered check-ins" : "All Play Plans and dates"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-navy/55">
                    {filteredPoints.length} week{filteredPoints.length === 1 ? "" : "s"} available
                  </span>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl border border-navy/10 bg-navy/[0.025] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <PlanFilterDropdown
                    plans={usedPlans}
                    value={planFilter}
                    onChange={setPlanFilter}
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                      From date
                    </span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-navy/15 bg-card px-3 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
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
                      className="min-h-11 w-full rounded-xl border border-navy/15 bg-card px-3 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanFilter("all");
                      setFromDate("");
                      setToDate("");
                    }}
                    disabled={!hasActiveFilters}
                    className="min-h-11 rounded-xl px-3 text-xs font-bold text-blue transition hover:bg-blue/10 disabled:cursor-not-allowed disabled:text-navy/35"
                  >
                    Clear filters
                  </button>
                </div>
                <div className="mt-4">
                  <LockedOverlay locked={isFreeGated}>
                    <ProgressChart points={filteredPoints} plans={chartPlans} />
                  </LockedOverlay>
                </div>
              </section>

              <section className="ph-card mt-4 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-expanded={historyOpen}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-navy/8 px-5 py-4 text-left transition hover:bg-navy/[0.02]"
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">Attempt history</h2>
                    <p className="text-xs text-navy/60">
                      Newest first — every check-in stays saved.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-navy/6 px-3 py-1 text-[11px] font-bold text-navy/65">
                    {rows.length} Attempt{rows.length === 1 ? "" : "s"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-navy/55 transition-transform duration-200",
                      historyOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {historyOpen &&
                  (attempts.isLoading ? (
                    <div className="p-5">
                      <CardSkeleton lines={4} />
                    </div>
                  ) : rows.length === 0 ? (
                    <p className="p-5 text-sm text-navy/65">No attempts logged yet.</p>
                  ) : (
                    <ul className="max-h-[30rem] divide-y divide-navy/8 overflow-y-auto">
                      {[...rows]
                        .sort(
                          (a, b) =>
                            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
                        )
                        .map((a) => (
                          <li
                            key={a.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-navy/[0.02]"
                          >
                            <div className="min-w-0">
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
                            </div>
                            <AttemptScore
                              completion={a.completion}
                              mood={a.mood}
                              completionStatus={a.completionStatus}
                              helpLevel={a.helpLevel}
                            />
                          </li>
                        ))}
                    </ul>
                  ))}
              </section>
            </div>

            <aside className="space-y-4" aria-label="Progress guidance">
              <section className="ph-card p-5">
                <p className="eyebrow text-blue">What this means</p>
                <h2 className="mt-1 text-lg font-bold">Next steps</h2>
                <ol className="mt-3 space-y-2">
                  {nextSteps.map((step, index) => {
                    const expanded = openNextStep === index;
                    return (
                      <li key={step.title} className="rounded-2xl bg-navy/4">
                        <button
                          type="button"
                          onClick={() => setOpenNextStep(expanded ? null : index)}
                          aria-expanded={expanded}
                          className="grid w-full grid-cols-[1.7rem_minmax(0,1fr)_auto] items-center gap-2.5 p-3 text-left"
                        >
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-blue/12 text-xs font-bold text-blue">
                            {index + 1}
                          </span>
                          <span className="min-w-0 text-sm font-bold text-navy">{step.title}</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-navy/55 transition-transform",
                              expanded && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </button>
                        {expanded && (
                          <p className="px-3 pb-3 pl-[3.8rem] text-sm leading-relaxed text-navy/70">
                            {step.body}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="ph-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">How it felt</h2>
                    <p className="mt-1 text-xs text-navy/60">Mood across every logged Attempt.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber/20 px-2.5 py-1 text-[11px] font-bold text-navy">
                    {rows.length} logged
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  {insights.moodCounts.map((m) => {
                    const pct = rows.length ? Math.round((m.count / rows.length) * 100) : 0;
                    return (
                      <li
                        key={m.value}
                        className="grid grid-cols-[1.25rem_minmax(0,1fr)_4.75rem] items-center gap-2.5"
                      >
                        <MoodIcon value={m.value} className="h-5 w-5 text-navy/70" />
                        <span className="h-2 overflow-hidden rounded-full bg-navy/8">
                          <span
                            className="block h-full rounded-full bg-amber transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="text-right text-[11px] font-bold text-navy/60">
                          {moodMeta(m.value).label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {showConsult && (
                <section className="ph-card border-2 border-coral/30 p-5">
                  <Stethoscope className="h-6 w-6 text-coral" aria-hidden />
                  <h2 className="mt-2 text-lg font-bold">Book a 1:1 Play Consultation</h2>
                  <p className="mt-2 text-sm text-navy/70">
                    {needsConsult
                      ? `Support has ${data.status === "needs_check_in" ? "increased" : "held steady"}. A paid one-to-one session with a child psychologist can rework the Play Plan around what's actually getting in the way.`
                      : "A paid one-to-one session with a child psychologist, whenever you want a second opinion on the Play Plan — available to you as a subscribed Admin."}
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white sm:w-auto"
                  >
                    <MessageSquareHeart className="h-4 w-4" aria-hidden /> Book a Play Consultation
                  </button>
                </section>
              )}

              {canLeaveConsultNotes && (
                <section className="ph-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setNotesOpen((v) => !v)}
                    aria-expanded={notesOpen}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 text-left transition hover:bg-navy/[0.02]"
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">Play Consult Notes</h2>
                      <p className="text-xs text-navy/60">
                        Clinical notes from organisation Admins.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-navy/6 px-3 py-1 text-[11px] font-bold text-navy/65">
                      {rows.filter((a) => a.consultNotes).length} Note
                      {rows.filter((a) => a.consultNotes).length === 1 ? "" : "s"}
                    </span>
                    <span className="sr-only">
                      {notesOpen ? "Collapse" : "Expand"} Play Consult Notes
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-navy/55 transition-transform duration-200",
                        notesOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>

                  {notesOpen && (
                    <ul className="space-y-2 px-5 pb-5">
                      {rows
                        .filter((a) => a.consultNotes)
                        .sort(
                          (a, b) =>
                            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
                        )
                        .slice(0, 4)
                        .map((a) => (
                          <li key={a.id} className="rounded-2xl bg-navy/4 p-3 text-sm">
                            <p className="text-navy/80">{a.consultNotes}</p>
                            <p className="mt-1 text-[11px] text-navy/50">
                              {fmtDate(a.date)} · {a.loggedBy}
                            </p>
                          </li>
                        ))}
                      {rows.every((a) => !a.consultNotes) && (
                        <li className="text-sm text-navy/65">
                          No Play Consult Notes recorded yet.
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              )}

              {isFreeGated && canManageSubscription && (
                <section className="ph-card border-2 border-coral/25 p-5 text-center">
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
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
