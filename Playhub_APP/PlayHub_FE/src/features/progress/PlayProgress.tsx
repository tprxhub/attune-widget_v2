import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { HelpLevel, Level, ProgressPoint } from "@/lib/types";
import { Select, type SelectOption } from "@/components/Select";
import { cn } from "@/lib/utils";
import {
  dosesPassed,
  doseVerdict,
  insightFor,
  lastCompleteIndex,
  practiceDays,
  tryDay,
} from "./insights";
import { fmtDate, fmtDateRange, fmtShortDate } from "@/lib/format";

/*
 * Play Progress, as the "Logic Spec for Dev" and the play-progress.html reference describe it:
 *
 *  Chart 1 "Within a Play Dose": every day of one dose (Day 1-5, then the Real-Life Try), each its
 *  own point, no averaging. Header badge = that dose's Support Score.
 *  Chart 2 "Within a Play Plan": one point per dose, in order, each that dose's own Support Score.
 *  Header badge = a plain "Doses passed" tally.
 *
 * Up always means better: 0% (independent) is at the top, 100% (hands-on) at the bottom. Mood is
 * its own dashed line on the same axis and is never mixed into the Support Score.
 */

const LEVEL_COLOR: Record<Level, string> = {
  Rookie: "#8B93A0",
  Starter: "#1B61A6",
  Pro: "#1B7A5A",
};
const MOOD_COLOR = "#7B4FA6";
const SUCCESS = "#1B7A5A";
const GRID = "#E4DFD3";
const TEXT_2 = "#5B6472";
const TEXT_3 = "#8B93A0";
const MOOD_LABEL = ["", "very upset", "frustrated", "okay", "happy", "delighted"];
const HELP_LABEL: Record<HelpLevel, string> = {
  independent: "On their own",
  one_reminder: "One reminder",
  few_reminders: "A few reminders",
  hands_on: "Hands-on help",
};

const startOf = (dose: ProgressPoint) => dose.days[0]?.date ?? dose.date;
const endOf = (dose: ProgressPoint) => dose.days.at(-1)?.date ?? dose.date;

const AXIS_LEFT = 54;
const AXIS_RIGHT = 30;
const moodPercent = (mood: number) => (5 - mood) * 25;

/** Measures the card so the chart fills it, and scrolls sideways only when it can't fit. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

/** Shows a small label above whichever point is hovered or focused. */
function useTooltip() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const bind = (text: string) => ({
    onMouseEnter: (event: React.MouseEvent<SVGGElement>) => show(event.currentTarget, text),
    onFocus: (event: React.FocusEvent<SVGGElement>) => show(event.currentTarget, text),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  const show = (target: SVGGElement, text: string) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    if (!wrap) return;
    setTip({ x: box.left + box.width / 2 - wrap.left, y: box.top - wrap.top, text });
  };
  const node = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-navy px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      {tip.text}
    </div>
  ) : null;
  return { wrapRef, bind, node };
}

function Axes({ width, y }: { width: number; y: (v: number) => number }) {
  const right = width - AXIS_RIGHT;
  return (
    <g aria-hidden>
      <rect
        x={AXIS_LEFT - 6}
        y={y(0)}
        width={right - AXIS_LEFT + 12}
        height={y(33) - y(0)}
        fill={SUCCESS}
        fillOpacity={0.1}
      />
      {[0, 33, 67, 100].map((value) => (
        <g key={value}>
          <line
            x1={AXIS_LEFT - 6}
            x2={right + 6}
            y1={y(value)}
            y2={y(value)}
            stroke={GRID}
            strokeWidth={0.8}
          />
          <text x={AXIS_LEFT - 12} y={y(value) + 3} textAnchor="end" fontSize={10.5} fill={TEXT_3}>
            {value}%
          </text>
        </g>
      ))}
    </g>
  );
}

function MoodLine({
  marks,
  y,
}: {
  marks: Array<{ x: number; mood: number | null }>;
  y: (v: number) => number;
}) {
  const pts = marks
    .filter((m) => m.mood !== null)
    .map((m) => ({ x: m.x, y: y(moodPercent(m.mood!)) }));
  if (!pts.length) return null;
  return (
    <g aria-hidden>
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={MOOD_COLOR}
          strokeWidth={1.6}
          strokeDasharray="4 3"
          opacity={0.85}
        />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.2} fill={MOOD_COLOR} opacity={0.9} />
      ))}
    </g>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-2xl border border-[#E4DFD3] bg-card px-3.5 pt-4 pb-3 sm:px-4"
    >
      {children}
    </section>
  );
}

function CardHead({
  title,
  timeframe,
  control,
  stat,
}: {
  title: string;
  timeframe: string;
  control: ReactNode;
  stat: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <h3 className="flex flex-wrap items-baseline gap-x-1 text-[15px] font-bold text-navy">
          {title}
          <span className="ml-1 text-xs font-normal whitespace-nowrap text-[#8B93A0]">
            {timeframe}
          </span>
        </h3>
        {control}
      </div>
      {stat}
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string | null; title: string }) {
  return (
    <div className="min-w-14 cursor-help text-right leading-tight" title={title}>
      <div className="text-[10px] tracking-wide text-[#8B93A0] uppercase">{label}</div>
      <div className={cn("text-xl font-bold", value === null ? "text-[#8B93A0]" : "text-navy")}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function MoodToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mt-1 mb-2.5 flex w-fit cursor-pointer items-center gap-1.5 text-xs text-[#5B6472] select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="cursor-pointer accent-[#7B4FA6]"
      />
      Show mood line
    </label>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
      style={{ background: color }}
    />
  );
}

function MoodSwatch() {
  return (
    <span>
      <span
        className="mr-1 inline-block w-3.5 border-t-2 border-dashed align-middle"
        style={{ borderColor: MOOD_COLOR }}
      />
      Mood
    </span>
  );
}

function InsightBox({
  context,
  dose,
  doses,
  index,
  emptyTitle,
  emptyText,
  minimal = false,
}: {
  context: string;
  dose: ProgressPoint | undefined;
  doses: ProgressPoint[];
  index: number;
  emptyTitle: string;
  emptyText: string;
  minimal?: boolean;
}) {
  const insight = dose ? insightFor(doses, index) : null;
  return (
    <div
      className={cn(
        "mt-3.5 rounded-[14px] px-4 pt-4 pb-3.5 text-navy",
        minimal ? "border-2 border-dashed border-navy/40 bg-transparent" : "bg-cream",
      )}
    >
      {!minimal && (
        <p className="mb-2 text-[11.5px] font-semibold tracking-[0.03em] text-[#5B6472] uppercase">
          {context}
        </p>
      )}
      {insight ? (
        <>
          {!minimal && (
            <h4 className="mb-2 text-sm font-bold tracking-[0.02em]">{insight.title}</h4>
          )}
          <p className="mb-1.5 text-sm leading-relaxed">
            <b>What am I seeing?</b> {insight.seeing}
          </p>
          <p className="text-sm leading-relaxed font-semibold">
            <b>What’s next?</b> {insight.next}
          </p>
        </>
      ) : (
        <>
          <h4 className="mb-2 text-sm font-bold tracking-[0.02em]">{emptyTitle}</h4>
          <p className="text-[13px] text-[#5B6472] italic">{emptyText}</p>
        </>
      )}
    </div>
  );
}

const VERDICT_LABEL = { passed: "Passed", redo: "Redo", "in-progress": "In progress" } as const;

/** "Dose 2 · Starter" with "18 Sept – 23 Sept · Passed" underneath. */
function doseOption(dose: ProgressPoint, index: number): SelectOption {
  return {
    value: String(index),
    label: `Dose ${index + 1} · ${dose.level}`,
    description: `${fmtDateRange(startOf(dose), endOf(dose))} · ${VERDICT_LABEL[doseVerdict(dose)]}`,
  };
}

/* ---------- Chart 1: Within a Play Dose ---------- */

function DoseCard({
  doses,
  planName,
  index,
  onIndex,
  minimalInsight = false,
}: {
  doses: ProgressPoint[];
  planName: string;
  index: number;
  onIndex: (index: number) => void;
  minimalInsight?: boolean;
}) {
  const [showMood, setShowMood] = useState(true);
  const [measure, available] = useWidth();
  const { wrapRef, bind, node: tooltip } = useTooltip();
  const dose = doses[index]!;
  const color = LEVEL_COLOR[dose.level];
  const complete = dose.complete;
  const slots = [...practiceDays(dose), tryDay(dose)];

  const height = 218;
  const top = 34;
  const bottom = 180;
  const y = (v: number) => top + (v / 100) * (bottom - top);
  const width = Math.max(available, 520);
  // Leave room on the right so the Try label and its date are never clipped.
  const step = (width - AXIS_LEFT - AXIS_RIGHT - 45) / (slots.length - 1);
  const marks = slots.map((slot, i) => ({
    slot,
    x: AXIS_LEFT + 15 + i * step,
    score: slot?.finished ? slot.score : null,
    mood: slot?.finished ? slot.mood : null,
  }));
  const finished = marks.filter((m) => m.score !== null);
  return (
    <Card label="Within a Play Dose">
      <CardHead
        title="Within a Play Dose"
        timeframe="progress across a week"
        control={
          <>
            <span className="text-[11px] font-semibold text-[#5B6472]">{planName}</span>
            <Select
              id="progress-dose-select"
              aria-label="Play Dose"
              value={String(index)}
              onChange={(value) => onIndex(Number(value))}
              options={doses.map(doseOption)}
              className="w-full min-w-56 sm:w-72"
            />
          </>
        }
        stat={
          <Stat
            label="Support Score"
            value={dose.support === null ? null : `${Math.round(dose.support)}%`}
            title={
              complete
                ? "Flat average of every logged day in this dose."
                : "Flat average of the days logged so far — this dose is still in progress."
            }
          />
        }
      />
      <p className="mt-0.5 mb-2.5 text-[12.5px] text-[#5B6472]">
        Every finished day in one dose, plotted on its own — no averaging.
      </p>
      <MoodToggle checked={showMood} onChange={setShowMood} />
      <div ref={measure} className="w-full">
        <div ref={wrapRef} className="relative">
          <div className="overflow-x-auto overflow-y-hidden rounded-lg">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              role="img"
              aria-label={`Support Score for each day of the ${dose.level} Play Dose`}
              className="block"
            >
              <Axes width={width} y={y} />
              {finished.length > 1 && (
                <polyline
                  points={finished.map((m) => `${m.x},${y(m.score!)}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
              )}
              {marks.map(({ slot, x, score }, i) => {
                const isTry = i === 5;
                return (
                  <g key={i}>
                    <text x={x} y={bottom + 20} textAnchor="middle" fontSize={10.5} fill={TEXT_2}>
                      {isTry ? "Try" : `Day ${i + 1}`}
                    </text>
                    {slot && (
                      <text
                        x={x}
                        y={bottom + 33}
                        textAnchor="middle"
                        fontSize={10.5}
                        fill={TEXT_2}
                        opacity={0.7}
                      >
                        {fmtShortDate(slot.date)}
                      </text>
                    )}
                    {score === null || !slot ? (
                      // Not logged yet, or logged but not finished in 15 minutes: no score either way.
                      <g
                        tabIndex={slot ? 0 : -1}
                        className="outline-none"
                        {...(slot
                          ? bind(
                              `${fmtShortDate(slot.date)} · not finished in 15 minutes · no score`,
                            )
                          : {})}
                      >
                        <circle cx={x} cy={y(50)} r={9} fill="transparent" />
                        <circle
                          cx={x}
                          cy={y(50)}
                          r={3}
                          fill="none"
                          stroke={TEXT_3}
                          strokeDasharray="2 2"
                        />
                      </g>
                    ) : (
                      <g
                        tabIndex={0}
                        className="cursor-pointer outline-none"
                        aria-label={`${isTry ? "Real-Life Try" : `Day ${i + 1}`}: ${score}% support`}
                        {...bind(
                          `${fmtShortDate(slot.date)}${isTry ? " · Real-Life Try" : ""} · ${slot.helpLevel ? HELP_LABEL[slot.helpLevel] : ""} (${score}%)${isTry ? (slot.tryPassed ? " · passed" : " · not passed") : ""}${slot.mood ? ` · ${MOOD_LABEL[slot.mood]}` : ""}`,
                        )}
                      >
                        {isTry ? (
                          <>
                            <rect
                              x={x - 6.9}
                              y={y(score) - 6.9}
                              width={13.8}
                              height={13.8}
                              fill={color}
                              transform={`rotate(45 ${x} ${y(score)})`}
                            />
                            {slot.tryPassed && (
                              <circle
                                cx={x}
                                cy={y(score)}
                                r={11.4}
                                fill="none"
                                stroke={color}
                                strokeWidth={1.4}
                              />
                            )}
                          </>
                        ) : (
                          <circle cx={x} cy={y(score)} r={6} fill={color} />
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
              {showMood && <MoodLine marks={marks} y={y} />}
            </svg>
          </div>
          {tooltip}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[#5B6472]">
        <span>
          <Swatch color={color} />
          Dose day
        </span>
        <span>Diamond = Real-Life Try</span>
        <span>Ringed = passed</span>
        <span>Dotted = not logged yet</span>
        {showMood && <MoodSwatch />}
      </div>
      <InsightBox
        context={`This dose · ${dose.level} · ${fmtDateRange(startOf(dose), endOf(dose))}`}
        dose={dose}
        doses={doses}
        index={index}
        emptyTitle="Dose in progress"
        emptyText="The Real-Life Try hasn’t happened yet, so there’s no verdict for this dose yet."
        minimal={minimalInsight}
      />
    </Card>
  );
}

/* ---------- Chart 2: Within a Play Plan ---------- */

function PlanCard({
  doses,
  planName,
  planOptions,
  planId,
  onPlan,
  selectedIndex,
  onOpenDose,
  minimalInsight = false,
}: {
  doses: ProgressPoint[];
  planName: string;
  planOptions: SelectOption[];
  planId: string;
  onPlan: (id: string) => void;
  selectedIndex: number;
  onOpenDose: (index: number) => void;
  minimalInsight?: boolean;
}) {
  const [showMood, setShowMood] = useState(true);
  const [measure, available] = useWidth();
  const { wrapRef, bind, node: tooltip } = useTooltip();
  const tally = dosesPassed(doses);
  const last = lastCompleteIndex(doses);

  const height = 240;
  const top = 34;
  const bottom = 190;
  const y = (v: number) => top + (v / 100) * (bottom - top);
  const minWidth = AXIS_LEFT + 40 + Math.max(doses.length - 1, 1) * 96;
  const width = Math.max(available, minWidth, 520);
  const step =
    doses.length > 1
      ? Math.min(140, (width - AXIS_LEFT - AXIS_RIGHT - 40) / (doses.length - 1))
      : 0;
  const marks = doses.map((dose, i) => ({
    dose,
    i,
    x: AXIS_LEFT + 20 + i * step,
    score: dose.support,
    mood: dose.mood,
  }));
  const line = marks.filter((m) => m.score !== null);

  return (
    <Card label="Within a Play Plan">
      <CardHead
        title="Within a Play Plan"
        timeframe="progress across a few weeks"
        control={
          <>
            <Select
              id="progress-plan-select"
              aria-label="Play Plan"
              value={planId}
              onChange={onPlan}
              options={planOptions}
              className="w-full min-w-56 sm:w-80"
            />
          </>
        }
        stat={
          <Stat
            label="Doses passed"
            value={tally.total ? `${tally.passed}/${tally.total}` : null}
            title="How many completed doses passed their Real-Life Try, out of how many were tried."
          />
        }
      />
      <p className="mt-0.5 mb-2.5 text-[12.5px] text-[#5B6472]">
        Each dose’s own Support Score, in the order it happened — Rookie, Starter, Pro, and any
        redo.
      </p>
      <MoodToggle checked={showMood} onChange={setShowMood} />
      <div ref={measure} className="w-full">
        <div ref={wrapRef} className="relative">
          <div className="overflow-x-auto overflow-y-hidden rounded-lg">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              role="img"
              aria-label="Support Score for each Play Dose in this Play Plan"
              className="block"
            >
              <Axes width={width} y={y} />
              {line.length > 1 && (
                <polyline
                  points={line.map((m) => `${m.x},${y(m.score!)}`).join(" ")}
                  fill="none"
                  stroke={TEXT_2}
                  strokeWidth={1.8}
                />
              )}
              {marks.map(({ dose, i, x, score }) => {
                const verdict = doseVerdict(dose);
                const color = LEVEL_COLOR[dose.level];
                const isSelected = selectedIndex === i;
                return (
                  <g key={i}>
                    <text x={x} y={14} textAnchor="middle" fontSize={10.5} fill={TEXT_2}>
                      {verdict === "in-progress" ? "in progress" : verdict}
                    </text>
                    <text
                      x={x}
                      y={bottom + 22}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={TEXT_2}
                    >
                      {dose.level}
                    </text>
                    <text
                      x={x}
                      y={bottom + 36}
                      textAnchor="middle"
                      fontSize={10.5}
                      fill={TEXT_2}
                      opacity={0.7}
                    >
                      {fmtShortDate(startOf(dose))}
                    </text>
                    {score === null ? (
                      <circle
                        cx={x}
                        cy={y(50)}
                        r={3}
                        fill="none"
                        stroke={TEXT_3}
                        strokeDasharray="2 2"
                      />
                    ) : (
                      <>
                        <g
                          role="button"
                          tabIndex={0}
                          aria-label={`Open the ${dose.level} dose from ${fmtDate(startOf(dose))}`}
                          className="cursor-pointer outline-none"
                          opacity={verdict === "in-progress" ? 0.55 : 1}
                          onClick={() => onOpenDose(i)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onOpenDose(i);
                            }
                          }}
                          {...bind(
                            `${fmtDate(startOf(dose))} · ${Math.round(score)}% support · ${verdict === "in-progress" ? "in progress, so far" : verdict === "passed" ? "passed" : "not passed"}${dose.mood ? ` · ${MOOD_LABEL[Math.round(dose.mood)]}` : ""}`,
                          )}
                        >
                          <circle
                            cx={x}
                            cy={y(score)}
                            r={verdict === "in-progress" ? 5 : 6}
                            fill={color}
                          />
                        </g>
                        {verdict === "passed" && (
                          <circle
                            cx={x}
                            cy={y(score)}
                            r={10}
                            fill="none"
                            stroke={color}
                            strokeWidth={1.4}
                          />
                        )}
                        {isSelected && (
                          <circle
                            cx={x}
                            cy={y(score)}
                            r={14}
                            fill="none"
                            stroke={TEXT_2}
                            strokeWidth={1}
                            strokeDasharray="2 2"
                          />
                        )}
                      </>
                    )}
                  </g>
                );
              })}
              {showMood && <MoodLine marks={marks} y={y} />}
            </svg>
          </div>
          {tooltip}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-[#5B6472]">
        {(["Rookie", "Starter", "Pro"] as const).map((level) => (
          <span key={level}>
            <Swatch color={LEVEL_COLOR[level]} />
            {level}
          </span>
        ))}
        <span>Ringed = passed</span>
        {showMood && <MoodSwatch />}
        <span>Click a dose to open it in “Within a Play Dose”</span>
      </div>
      <InsightBox
        context={
          last >= 0
            ? `Most recent completed dose in this plan · ${doses[last]!.level} · ${planName} · ${fmtDateRange(startOf(doses[last]!), endOf(doses[last]!))}`
            : "Most recent completed dose in this plan"
        }
        dose={last >= 0 ? doses[last] : undefined}
        doses={doses}
        index={last}
        emptyTitle="No completed doses yet"
        emptyText="Nothing to show an insight for in this plan yet."
        minimal={minimalInsight}
      />
    </Card>
  );
}

/**
 * Both Play Progress views for one child. Each dropdown defaults to the latest (the dose and plan
 * of the most recent session); clicking a dose in the plan chart opens it in the dose chart.
 */
export function PlayProgress({
  points,
  plans,
  currentPlanId,
  compact = false,
  landingPreview = false,
}: {
  points: ProgressPoint[];
  plans?: ReadonlyArray<{ id: string; title: string }> | undefined;
  /** The plan of the child's latest session, so both charts open on what the hero describes. */
  currentPlanId?: string | null | undefined;
  compact?: boolean;
  /** Uses a lighter, dashed insight treatment on the public homepage sample. */
  landingPreview?: boolean;
}) {
  const titles = useMemo(
    () => new Map((plans ?? []).map((plan) => [plan.id, plan.title])),
    [plans],
  );
  const byPlan = useMemo(() => {
    const map = new Map<string, ProgressPoint[]>();
    for (const point of points) map.set(point.planId, [...(map.get(point.planId) ?? []), point]);
    return map;
  }, [points]);
  // Plans in the order they were started, with the plan the child is on now last.
  const planIds = useMemo(() => {
    const ids = [...new Set(points.map((point) => point.planId))];
    if (currentPlanId && ids.includes(currentPlanId)) {
      return [...ids.filter((id) => id !== currentPlanId), currentPlanId];
    }
    return ids;
  }, [points, currentPlanId]);
  const [chosenPlan, setChosenPlan] = useState<string | null>(null);
  const [chosenDose, setChosenDose] = useState<number | null>(null);
  const doseCardRef = useRef<HTMLDivElement>(null);

  if (!points.length) {
    return (
      <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-navy/20 bg-navy/[0.02] px-6 text-center">
        <div>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-blue/10 text-blue">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold text-navy">Your progress graph starts here</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-navy/55">
            Log Day 1 of a Play Dose to see its first point. Five practice days and the Real-Life
            Try complete a dose.
          </p>
        </div>
      </div>
    );
  }

  const planTitle = (id: string) => titles.get(id) ?? "Play Plan";
  const currentPlan = planIds.at(-1)!;
  // One plan drives both charts; the dose chart opens on that plan's latest dose.
  const planId = chosenPlan && byPlan.has(chosenPlan) ? chosenPlan : currentPlan;
  const doses = byPlan.get(planId)!;
  const doseIndex =
    chosenDose !== null && chosenDose < doses.length ? chosenDose : doses.length - 1;
  const planOptions: SelectOption[] = [...planIds].reverse().map((id) => {
    const tally = dosesPassed(byPlan.get(id)!);
    const count = byPlan.get(id)!.length;
    return {
      value: id,
      label: planTitle(id),
      description: `${id === currentPlan ? "Current plan · " : ""}${count} dose${count === 1 ? "" : "s"} · ${tally.passed} passed`,
    };
  });
  const completePlans = planIds.filter((id) =>
    byPlan.get(id)!.some((d) => d.level === "Pro" && d.passed),
  ).length;
  const currentDone = byPlan.get(currentPlan)!.some((d) => d.level === "Pro" && d.passed);

  return (
    <div className="space-y-3.5">
      <div className={cn("flex flex-wrap items-center gap-2.5", compact && "text-[0.95em]")}>
        <span className="inline-flex items-center rounded-full bg-[#1B7A5A]/15 px-3 py-1 text-[12.5px] font-semibold text-[#1B7A5A]">
          {completePlans} plan{completePlans === 1 ? "" : "s"} complete
        </span>
        {!currentDone && (
          <span className="inline-flex items-center rounded-full bg-blue/12 px-3 py-1 text-[12.5px] font-semibold text-blue">
            Now: {planTitle(currentPlan)}
          </span>
        )}
        <span className="text-xs text-[#5B6472]">
          Support Score over time. The line goes up as the child needs less help.
        </span>
      </div>
      {/* Plan first, then the dose it opens; side by side on wide screens. */}
      <div className="grid items-start gap-3.5 xl:grid-cols-2">
        <PlanCard
          doses={doses}
          planName={planTitle(planId)}
          planOptions={planOptions}
          planId={planId}
          onPlan={(id) => {
            setChosenPlan(id);
            setChosenDose(null);
          }}
          selectedIndex={doseIndex}
          onOpenDose={(index) => {
            setChosenDose(index);
            doseCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
          minimalInsight={landingPreview}
        />
        <div ref={doseCardRef} className="min-w-0 scroll-mt-24">
          <DoseCard
            doses={doses}
            planName={planTitle(planId)}
            index={doseIndex}
            onIndex={setChosenDose}
            minimalInsight={landingPreview}
          />
        </div>
      </div>
    </div>
  );
}
