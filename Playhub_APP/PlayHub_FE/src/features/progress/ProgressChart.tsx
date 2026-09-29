import { useMemo, useState } from "react";
import { AlertTriangle, Minus, Sparkles } from "lucide-react";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Level, ProgressPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = {
  navy: "#002A64",
  coral: "#DF3B2D",
  amber: "#FFB455",
  blue: "#1B61A6",
};

const LEVEL_COLOR: Record<Level, string> = {
  Rookie: COLORS.amber,
  Starter: COLORS.blue,
  Pro: COLORS.coral,
};

const LEVEL_SOFT: Record<Level, string> = {
  Rookie: "rgba(255, 180, 85, .24)",
  Starter: "rgba(27, 97, 166, .13)",
  Pro: "rgba(223, 59, 45, .12)",
};

const LEVEL_RANK: Record<Level, number> = { Rookie: 0, Starter: 1, Pro: 2 };
const NEXT_LEVEL: Partial<Record<Level, Level>> = { Rookie: "Starter", Starter: "Pro" };

// Plot geometry. The finished/level strip under the chart is padded with the same numbers so
// every column sits directly under its point.
const MARGIN = { top: 18, right: 16, bottom: 2, left: 4 };
const SUPPORT_AXIS_W = 48;
const MOOD_AXIS_W = 72;
const GRID_STROKE = "rgba(0,42,100,.10)";
const SUPPORT_GRID = [0, 33, 67, 100];
const MOOD_GRID = [1, 2, 3, 4, 5];
const MOOD_AXIS_LABEL: Record<number, string> = { 5: "Very happy", 3: "Okay", 1: "Very upset" };
const ALL_PLANS = "__all__";
const ZERO_WIDTH = "\u200b";

type ChartView = "support" | "mood" | "both";
type ChartStatus = "progressing" | "holding" | "check-in" | "settling";

type ChartDatum = ProgressPoint & {
  /** Week within this point's own Play Plan. `weekNumber` restarts at 1 with every new level. */
  week: number;
  /** Position of the point within its own Play Plan's series. */
  seriesIndex: number;
  /** Unique category key for the x-axis. */
  label: string;
  dateLabel: string;
  planTitle: string;
  /** Run of consecutive weeks of one plan at one level. Each run is drawn as its own line. */
  seg: number;
} & { [key: `s${number}`]: number | null | undefined };

type PlanOption = { id: string; title: string; level: Level; lastDate: string; weeks: number };

const STATUS_META: Record<
  ChartStatus,
  { label: string; message: string; className: string; icon: typeof Sparkles }
> = {
  progressing: {
    label: "Progressing",
    message: "Needing less support, or moving up a level.",
    className: "bg-blue/12 text-blue",
    icon: Sparkles,
  },
  holding: {
    label: "Holding steady",
    message: "About the same for a few weeks. Keep going.",
    className: "bg-amber/25 text-navy",
    icon: Minus,
  },
  "check-in": {
    label: "Needs a check-in",
    message: "Needing more support each week.",
    className: "bg-coral/12 text-coral",
    icon: AlertTriangle,
  },
  settling: {
    label: "Settling in",
    message: "New level. Give it a week or two.",
    className: "bg-navy/8 text-navy",
    icon: Sparkles,
  },
};

function moodLabel(value: number | null) {
  if (value === null) return "Not logged";
  if (value >= 4.5) return "Very happy";
  if (value >= 3.5) return "Happy";
  if (value >= 2.5) return "Okay";
  if (value >= 1.5) return "Unhappy";
  return "Very upset";
}

function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(value);
}

function chartStatus(points: ProgressPoint[]): ChartStatus {
  if (points.slice(-3).some((point) => point.passed)) return "progressing";
  const currentLevel = points.at(-1)?.level;
  const sameLevel: number[] = [];

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (!point || point.level !== currentLevel) break;
    if (point.support !== null) sameLevel.unshift(point.support);
  }

  if (sameLevel.length < 2) return "settling";
  const previous = sameLevel.slice(-3, -1);
  const previousAverage = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const change = sameLevel.at(-1)! - previousAverage;
  if (change <= -7) return "progressing";
  if (change >= 7) return "check-in";
  return "holding";
}

/** Consecutive weeks of one plan at one level, so the level band is drawn as one span per run. */
function levelRuns(points: Array<{ planId: string; level: Level; planTitle: string }>) {
  const runs: Array<{
    planId: string;
    level: Level;
    planTitle: string;
    start: number;
    length: number;
  }> = [];
  points.forEach((point, index) => {
    const last = runs.at(-1);
    if (last && last.planId === point.planId && last.level === point.level) last.length += 1;
    else
      runs.push({
        planId: point.planId,
        level: point.level,
        planTitle: point.planTitle,
        start: index,
        length: 1,
      });
  });
  return runs;
}

/**
 * Levels, passes and Support Scores only mean something inside one Play Plan, so by default the
 * graph shows one plan at a time (the most recently active one first). "All plans" lays every
 * plan's weeks out in date order, with the lines broken wherever the plan or level changes.
 */
function planOptionsFrom(points: ProgressPoint[], titles: Map<string, string>): PlanOption[] {
  const byPlan = new Map<string, PlanOption>();
  for (const point of points) {
    const known = byPlan.get(point.planId);
    if (!known) {
      byPlan.set(point.planId, {
        id: point.planId,
        title: titles.get(point.planId) ?? "",
        level: point.level,
        lastDate: point.date,
        weeks: 1,
      });
      continue;
    }
    known.weeks += 1;
    if (point.date >= known.lastDate) {
      known.lastDate = point.date;
      known.level = point.level;
    }
  }
  return [...byPlan.values()]
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.weeks - a.weeks)
    .map((option, index) => ({ ...option, title: option.title || `Play Plan ${index + 1}` }));
}

/** Plain-language note for `points[index]`, read from the whole series so the first visible
 * week still knows what came before it. */
function pointNote(points: ProgressPoint[], index: number) {
  const point = points[index];
  if (!point) return "";
  const previous = points[index - 1];
  const next = points[index + 1];
  const earlierAtLevel: ProgressPoint[] = [];
  for (let i = index - 1; i >= 0 && points[i]?.level === point.level; i -= 1) {
    earlierAtLevel.unshift(points[i]!);
  }
  const lastAtLevel = earlierAtLevel.at(-1);

  if (point.passed) {
    const up = NEXT_LEVEL[point.level];
    return `Passed ${point.level}.${up ? ` Moves up to ${up}.` : ""}`;
  }
  if (point.consultSuggested) {
    return `Second miss at ${point.level}: Hub suggests a Play Consult.`;
  }
  if (next && LEVEL_RANK[next.level] < LEVEL_RANK[point.level]) {
    return `Extra help needed: moves down to ${next.level}.`;
  }
  if (point.realLifeTryPassed) return "Try passed, kit not yet: redo with fast track.";
  if (previous && previous.level !== point.level) {
    return LEVEL_RANK[point.level] > LEVEL_RANK[previous.level]
      ? "New level with harder activities, so support rises. Expected."
      : "Easier level, so support drops.";
  }
  if (earlierAtLevel.some((week) => week.passed)) return "Stay and master.";
  if (point.support === null) return "Keep logging sessions to complete this weekly point.";
  if (point.finishedCount >= 5) {
    return "All five sessions finished. The Real-Life Try is the next step.";
  }
  if (!lastAtLevel || lastAtLevel.support === null) {
    return point.support <= 33
      ? "On track — completing activities with less support."
      : `Needs practice. ${point.finishedCount} of 5 finished.`;
  }

  // A clear move in support wins. Otherwise the week right after a consult says so, and a week
  // that is slipping (support up a little while mood drops) is not called "flat".
  const change = point.support - lastAtLevel.support;
  const moodDipping =
    point.mood !== null && lastAtLevel.mood !== null && point.mood < lastAtLevel.mood;
  if (change <= -7) return "Closer to the target.";
  if (change >= 7 || (change > 0 && moodDipping)) {
    return moodDipping ? "Needing more help, and mood is dipping." : "Needing more help.";
  }
  if (lastAtLevel.consultSuggested) {
    return "After the consult: same level, with changes to the plan.";
  }
  if (point.support <= 33) return "On track — completing activities with less support.";
  return "Still flat. Plateaus often come before a jump.";
}

function ChartTooltip({
  active,
  payload,
  allPlans = false,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
  allPlans?: boolean;
}) {
  const point = payload?.find((entry) => entry.payload)?.payload;
  if (!active || !point) return null;

  return (
    <div className="min-w-44 rounded-lg border border-navy/8 bg-card p-3 shadow-(--shadow-lift)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="max-w-48 text-xs font-bold text-navy">
            {allPlans ? point.planTitle : `Week ${point.week}`}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-navy/45">
            {allPlans ? `Week ${point.week} · ` : ""}
            {point.dateLabel}
          </p>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold"
          style={{ background: LEVEL_SOFT[point.level], color: LEVEL_COLOR[point.level] }}
        >
          {point.level}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between gap-5">
          <dt className="text-navy/55">Support score</dt>
          <dd className="font-bold text-navy">
            {point.support === null ? "Not ready" : `${point.support}%`}
          </dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-navy/55">Mood</dt>
          <dd className="font-bold text-navy">{moodLabel(point.mood)}</dd>
        </div>
        <div className="flex justify-between gap-5">
          <dt className="text-navy/55">Finished</dt>
          <dd className="font-bold text-navy">{point.finishedCount}/5</dd>
        </div>
      </dl>
    </div>
  );
}

// Each run is its own <Line>, and recharts still calls `dot` for the weeks where that run has
// no value (cy is null). Skip those, otherwise a clipped dot is drawn on the top edge of the plot.
function SupportDot({
  cx,
  cy,
  value,
  payload,
}: {
  cx?: number | null;
  cy?: number | null;
  value?: number | null;
  payload?: ChartDatum;
}) {
  if (cx == null || cy == null || value == null || !payload || payload.support === null) {
    return <g />;
  }
  const color = LEVEL_COLOR[payload.level];
  return (
    <g>
      {payload.passed && (
        <circle cx={cx} cy={cy} r={10} fill="white" stroke={color} strokeWidth={2} />
      )}
      {payload.consultSuggested && !payload.passed && (
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="white"
          stroke={COLORS.coral}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      )}
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
    </g>
  );
}

// `scale="band"` puts each point in the middle of its week's column, which is what lines the
// points up with the finished/level strip below. recharts leaves the tick labels on the column's
// left edge though, so shift them to the middle.
function WeekTick({
  x,
  y,
  width,
  count,
  payload,
}: {
  x?: number;
  y?: number;
  width?: number;
  count: number;
  payload?: { value?: string };
}) {
  if (x == null || y == null) return <g />;
  const band = width && count ? width / count : 0;
  return (
    <text
      x={x + band / 2}
      y={y + 8}
      dy="0.71em"
      textAnchor="middle"
      fill="rgba(0,42,100,.58)"
      fontSize={11}
      fontWeight={600}
    >
      {(payload?.value ?? "").replaceAll(ZERO_WIDTH, "")}
    </text>
  );
}

// Mood is drawn with square markers so it never reads as a support dot.
function MoodMarker({
  cx,
  cy,
  value,
  size = 8,
}: {
  cx?: number | null;
  cy?: number | null;
  value?: number | null;
  size?: number;
}) {
  if (cx == null || cy == null || value == null) return <g />;
  return (
    <rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      rx={1.5}
      fill={COLORS.navy}
      stroke="white"
      strokeWidth={1.5}
    />
  );
}

function LegendItem({
  color,
  label,
  shape = "dot",
  dashed = false,
}: {
  color: string;
  label: string;
  shape?: "dot" | "band" | "line" | "ring" | "square";
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className={cn(
          "inline-block shrink-0",
          shape === "dot" && "h-2.5 w-2.5 rounded-full",
          shape === "square" && "h-2 w-2 rounded-xs",
          shape === "band" && "h-2.5 w-3.5 rounded-sm",
          shape === "line" && "h-0 w-4 border-t-2",
          shape === "ring" && "h-3 w-3 rounded-full border-2 bg-transparent",
          dashed && "border-dashed",
        )}
        style={
          shape === "line" || shape === "ring" ? { borderColor: color } : { backgroundColor: color }
        }
      />
      {label}
    </span>
  );
}

export function ProgressChart({
  points,
  plans,
  compact = false,
}: {
  points: ProgressPoint[];
  /** Titles for the plan switcher. Plans without a title are numbered. */
  plans?: ReadonlyArray<{ id: string; title: string }> | undefined;
  compact?: boolean;
}) {
  const [view, setView] = useState<ChartView>("support");
  const [range, setRange] = useState<4 | 8>(8);
  const [chosenPlan, setChosenPlan] = useState<string | null>(null);

  const titles = useMemo(
    () => new Map((plans ?? []).map((plan) => [plan.id, plan.title])),
    [plans],
  );
  const planOptions = useMemo(() => planOptionsFrom(points, titles), [points, titles]);
  const allPlans = chosenPlan === ALL_PLANS && planOptions.length > 1;
  const activePlan = planOptions.find((option) => option.id === chosenPlan) ?? planOptions[0];
  const planTitles = useMemo(
    () => new Map(planOptions.map((option) => [option.id, option.title])),
    [planOptions],
  );
  const seriesByPlan = useMemo(() => {
    const series = new Map<string, ProgressPoint[]>();
    for (const point of points) {
      const list = series.get(point.planId);
      if (list) list.push(point);
      else series.set(point.planId, [point]);
    }
    return series;
  }, [points]);
  const shownPoints = useMemo(
    () => (allPlans ? points : points.filter((point) => point.planId === activePlan?.id)),
    [allPlans, points, activePlan?.id],
  );
  const visiblePoints = useMemo(() => shownPoints.slice(-range), [shownPoints, range]);
  const firstVisible = shownPoints.length - visiblePoints.length;
  const data = useMemo<ChartDatum[]>(() => {
    // A run is a stretch of consecutive weeks of one plan at one level.
    const segs: number[] = [];
    let seg = -1;
    visiblePoints.forEach((point, index) => {
      const before = visiblePoints[index - 1];
      if (!before || before.planId !== point.planId || before.level !== point.level) seg += 1;
      segs.push(seg);
    });
    return visiblePoints.map((point, index) => {
      const own = segs[index] ?? 0;
      const nextSeg = segs[index + 1];
      const seriesIndex = Math.max(0, seriesByPlan.get(point.planId)?.indexOf(point) ?? 0);
      const week = seriesIndex + 1;
      const datum = {
        ...point,
        week,
        seriesIndex,
        seg: own,
        // Across plans the axis shows dates, which can repeat, so pad them with invisible
        // characters to stay unique. recharts sizes the ticks from this key, so it has to be as
        // wide as what is drawn or overlapping labels are not thinned out.
        label: allPlans
          ? `${formatDate(point.date)}${ZERO_WIDTH.repeat(firstVisible + index + 1)}`
          : `Wk ${week}`,
        dateLabel: formatDate(point.date),
        planTitle: planTitles.get(point.planId) ?? "Play Plan",
        [`s${own}`]: point.support,
      } as ChartDatum;
      // Every week is joined to the next. The line into a new level starts on this point and is
      // drawn in the new level's colour, so it reads as the first stretch of that level.
      if (nextSeg !== undefined && nextSeg !== own) datum[`s${nextSeg}`] = point.support;
      return datum;
    });
  }, [visiblePoints, seriesByPlan, planTitles, allPlans, firstVisible]);
  const runs = useMemo(() => {
    const seen: Array<{ seg: number; level: Level }> = [];
    for (const datum of data) {
      if (!seen.some((run) => run.seg === datum.seg)) {
        seen.push({ seg: datum.seg, level: datum.level });
      }
    }
    return seen;
  }, [data]);

  if (!points.length || !activePlan) {
    return (
      <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-navy/20 bg-navy/[0.02] px-6 text-center">
        <div>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-blue/10 text-blue">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold text-navy">Your weekly graph starts here</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-navy/55">
            Complete daily check-ins to build the first weekly Support Score and mood point.
          </p>
        </div>
      </div>
    );
  }

  const latest = visiblePoints.at(-1)!;
  // The status is about one plan's journey, so across plans it describes the latest one.
  const statusPoints = allPlans
    ? visiblePoints.filter((point) => point.planId === latest.planId)
    : visiblePoints;
  const status = STATUS_META[chartStatus(statusPoints)];
  const StatusIcon = status.icon;
  const scopeTitle = allPlans ? "All plans" : activePlan.title;
  const showSupport = view !== "mood";
  const showMood = view !== "support";
  const plotLeft = MARGIN.left + (showSupport ? SUPPORT_AXIS_W : MOOD_AXIS_W);
  const plotRight = MARGIN.right + (showSupport && showMood ? MOOD_AXIS_W : 0);

  return (
    <div>
      {!compact && planOptions.length > 1 && (
        <div
          className="mb-3 flex items-center gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Play Plan"
        >
          {[{ id: ALL_PLANS, title: "All plans", level: null }, ...planOptions].map((option) => {
            const selected = allPlans ? option.id === ALL_PLANS : option.id === activePlan.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setChosenPlan(option.id)}
                aria-pressed={selected}
                title={option.title}
                className={cn(
                  "inline-flex max-w-56 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
                  selected
                    ? "border-navy bg-navy text-cream"
                    : "border-navy/12 bg-card text-navy/65 hover:border-navy/30 hover:text-navy",
                )}
              >
                {option.level && (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: LEVEL_COLOR[option.level] }}
                  />
                )}
                <span className="truncate">{option.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {!compact && (
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                status.className,
              )}
            >
              <StatusIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", status.className)}>
                  {status.label}
                </span>
                <p className="text-sm font-semibold text-navy">{status.message}</p>
              </div>
              <p className="mt-1.5 text-xs text-navy/55">
                This week: Support Score{" "}
                {latest.support === null ? "not ready" : `${latest.support}%`} ·{" "}
                {latest.mood === null
                  ? "mood not logged"
                  : `mood mostly ${moodLabel(latest.mood).toLowerCase()}`}{" "}
                · {latest.level}
                {allPlans && ` · ${planTitles.get(latest.planId) ?? ""}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <div className="inline-flex rounded-lg bg-navy/6 p-1" aria-label="Chart measure">
              {(["support", "mood", "both"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={cn(
                    "min-h-8 rounded-md px-3 text-xs font-bold capitalize transition",
                    view === option
                      ? "bg-card text-blue shadow-sm"
                      : "text-navy/55 hover:text-navy",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg bg-navy/6 p-1" aria-label="Chart time range">
              {([4, 8] as const).map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => setRange(weeks)}
                  aria-pressed={range === weeks}
                  className={cn(
                    "min-h-8 rounded-md px-3 text-xs font-bold transition",
                    range === weeks
                      ? "bg-card text-blue shadow-sm"
                      : "text-navy/55 hover:text-navy",
                  )}
                >
                  {weeks === 4 ? "1 month" : "2 months"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-navy/8 bg-white/55">
        <div className="flex items-center justify-between border-b border-navy/8 px-4 py-2 text-[10px] font-bold tracking-wide text-navy/45 uppercase">
          <span>{showSupport ? "Support score · lower is better" : "Mood"}</span>
          {showMood && showSupport && <span>Mood · higher is better</span>}
        </div>
        <div
          role="img"
          aria-label={`Weekly progress chart for ${scopeTitle} showing ${view}. ${status.label}.`}
          style={{ height: compact ? 180 : 286 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={MARGIN}>
              {/* Gridlines follow whichever axis is the primary one, so mood-only view is gridded
                  at 1–5 rather than at the (hidden) support ticks. */}
              {showSupport
                ? SUPPORT_GRID.map((value) => (
                    <ReferenceLine
                      key={`support-${value}`}
                      yAxisId="support"
                      y={value}
                      stroke={GRID_STROKE}
                    />
                  ))
                : MOOD_GRID.map((value) => (
                    <ReferenceLine
                      key={`mood-${value}`}
                      yAxisId="mood"
                      y={value}
                      stroke={GRID_STROKE}
                    />
                  ))}
              {showSupport && (
                <ReferenceArea
                  yAxisId="support"
                  y1={0}
                  y2={33}
                  fill={COLORS.blue}
                  fillOpacity={0.08}
                />
              )}
              <XAxis
                dataKey="label"
                scale="band"
                tickLine={false}
                axisLine={false}
                tick={<WeekTick count={data.length} />}
              />
              <YAxis
                yAxisId="support"
                domain={[0, 100]}
                reversed
                ticks={SUPPORT_GRID}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                axisLine={false}
                width={SUPPORT_AXIS_W}
                hide={!showSupport}
                tick={{ fill: "rgba(0,42,100,.58)", fontSize: 10, fontWeight: 600 }}
              />
              <YAxis
                yAxisId="mood"
                orientation={showSupport ? "right" : "left"}
                domain={[1, 5]}
                ticks={[1, 3, 5]}
                tickFormatter={(value: number) => MOOD_AXIS_LABEL[value] ?? String(value)}
                tickLine={false}
                axisLine={false}
                width={MOOD_AXIS_W}
                hide={!showMood}
                tick={{ fill: "rgba(0,42,100,.58)", fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip
                content={<ChartTooltip allPlans={allPlans} />}
                cursor={{ stroke: COLORS.navy, strokeOpacity: 0.12 }}
              />
              {/* Mood first so the support line and dots always draw on top of it. It is dashed
                  only when it shares the plot with support. */}
              {showMood && (
                <Line
                  yAxisId="mood"
                  type="linear"
                  dataKey="mood"
                  stroke={COLORS.navy}
                  strokeOpacity={0.72}
                  strokeWidth={2}
                  strokeDasharray={showSupport ? "6 5" : "0"}
                  connectNulls
                  isAnimationActive={false}
                  dot={<MoodMarker />}
                  activeDot={<MoodMarker size={12} />}
                />
              )}
              {showSupport &&
                runs.map(({ seg, level }) => (
                  <Line
                    key={seg}
                    yAxisId="support"
                    type="linear"
                    dataKey={`s${seg}`}
                    stroke={LEVEL_COLOR[level]}
                    strokeWidth={3}
                    strokeLinecap="round"
                    connectNulls
                    isAnimationActive={false}
                    dot={<SupportDot />}
                    activeDot={{ r: 7, strokeWidth: 3, fill: "white" }}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {!compact && (
          <div
            className="border-t border-navy/8 bg-navy/[0.018] py-2"
            style={{ paddingLeft: plotLeft, paddingRight: plotRight }}
            aria-label="Finished sessions and level by week"
          >
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
            >
              {data.map((point) => (
                <p
                  key={`${point.date}-${point.label}-finished`}
                  className="min-w-0 truncate text-center text-[10px] font-bold text-navy"
                >
                  {point.finishedCount}/5
                </p>
              ))}
            </div>
            {/* Level band: one continuous colour per level, named once where the level starts. */}
            <div
              className="mt-1 grid overflow-hidden rounded-md"
              style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
            >
              {levelRuns(data).map((run, index) => (
                <div
                  key={`${run.planId}-${run.level}-${run.start}`}
                  title={`${run.planTitle} · ${run.level}`}
                  className={cn(
                    "min-w-0 truncate px-1.5 py-1 text-[9px] font-semibold text-navy/60",
                    allPlans && index > 0 && "border-l-2 border-white",
                  )}
                  style={{ background: LEVEL_SOFT[run.level], gridColumn: `span ${run.length}` }}
                >
                  {allPlans ? `${run.level} · ${run.planTitle}` : run.level}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] font-bold tracking-wide text-navy/40 uppercase">
              Finished sessions · level
            </p>
          </div>
        )}
      </div>

      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-navy/58">
            <LegendItem color={LEVEL_COLOR.Rookie} label="Rookie" />
            <LegendItem color={LEVEL_COLOR.Starter} label="Starter" />
            <LegendItem color={LEVEL_COLOR.Pro} label="Pro" />
            {showSupport && (
              <>
                <LegendItem
                  color="rgba(27, 97, 166, .18)"
                  label="Ready to pass · 33% or less"
                  shape="band"
                />
                <LegendItem color={COLORS.blue} label="Level passed" shape="ring" />
                <LegendItem
                  color={COLORS.coral}
                  label="Play Consult suggested"
                  shape="ring"
                  dashed
                />
              </>
            )}
            {showMood && <LegendItem color={COLORS.navy} label="Mood" shape="square" />}
          </div>

          <div className="mt-4 rounded-xl bg-navy/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-navy">Weekly notes</p>
              <p className="truncate text-[10px] font-semibold text-navy/45">
                {scopeTitle} · latest {data.length} weeks
              </p>
            </div>
            <ol className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
              {data.map((point) => (
                <li
                  key={`${point.date}-${point.label}-note`}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2 text-xs"
                >
                  <span
                    className="mt-0.5 grid h-5 w-5 place-items-center rounded-md text-[9px] font-bold text-white"
                    style={{ backgroundColor: LEVEL_COLOR[point.level] }}
                  >
                    {point.week}
                  </span>
                  <span className="leading-relaxed text-navy/65">
                    <span className="font-bold text-navy">{point.dateLabel}</span> ·{" "}
                    {allPlans && <span className="font-semibold">{point.planTitle} · </span>}
                    {pointNote(seriesByPlan.get(point.planId) ?? [], point.seriesIndex)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
