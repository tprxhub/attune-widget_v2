import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { moodMeta } from "@/components/icons";
import { fmtShortDate } from "@/lib/format";
import type { Attempt } from "@/lib/types";
import { shareSupportMoodCard } from "./shareSupportMood";
import { averageMood, moodColor, moodRange, recentMoods, independence, TRACK } from "./supportMood";

const SUPPORT_COLOR = "#2459A0";

const FEATURE = "#11295B";

/**
 * A filled mood face (no badge behind it): the face is the mood colour, and the mouth goes from
 * a frown (1) through flat (3) to a big open smile (5).
 */
export function FaceShape({
  cx,
  cy,
  r,
  mood,
}: {
  cx: number;
  cy: number;
  r: number;
  mood: number;
}) {
  const eyeY = cy - r * 0.18;
  const eyeX = r * 0.32;
  const mouthY = cy + r * 0.3;
  const half = r * 0.38;
  const bend = (mood - 3) * r * 0.2; // negative = frown
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={moodColor(mood)} />
      {mood === 1 && (
        <path
          d={`M${cx - eyeX - r * 0.14} ${eyeY - r * 0.26}l${r * 0.24} ${r * 0.1}M${cx + eyeX + r * 0.14} ${eyeY - r * 0.26}l${-r * 0.24} ${r * 0.1}`}
          stroke={FEATURE}
          strokeWidth={r * 0.1}
          strokeLinecap="round"
        />
      )}
      <circle cx={cx - eyeX} cy={eyeY} r={r * 0.1} fill={FEATURE} />
      <circle cx={cx + eyeX} cy={eyeY} r={r * 0.1} fill={FEATURE} />
      {mood === 5 ? (
        <path
          d={`M${cx - half} ${mouthY - r * 0.06}Q${cx} ${mouthY + r * 0.5} ${cx + half} ${mouthY - r * 0.06}Z`}
          fill={FEATURE}
        />
      ) : (
        <path
          d={`M${cx - half} ${mouthY}Q${cx} ${mouthY + bend} ${cx + half} ${mouthY}`}
          fill="none"
          stroke={FEATURE}
          strokeWidth={r * 0.1}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function MoodFace({ mood, className }: { mood: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label={`Mood: ${moodMeta(mood).label}`}
    >
      <FaceShape cx={20} cy={20} r={20} mood={mood} />
    </svg>
  );
}

function Ring({
  radius,
  stroke,
  value,
  color,
}: {
  radius: number;
  stroke: number;
  value: number;
  color: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, value));
  return (
    <>
      <circle cx="80" cy="80" r={radius} fill="none" stroke={TRACK} strokeWidth={stroke} />
      {filled > 0 && (
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 80 80)"
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      )}
    </>
  );
}

/**
 * Support Score and Mood at a glance: the outer ring is the latest Play Dose's Support Score,
 * the inner ring and face are the child's recent mood, with a week of moods underneath.
 * "Share" turns it into an image the family can send to someone else.
 */
export function SupportMoodRings({
  childName,
  supportScore,
  rows,
}: {
  childName: string;
  supportScore: number | null;
  rows: Attempt[];
}) {
  const moods = recentMoods(rows);
  const average = averageMood(moods);
  const latest = moods.at(-1)?.mood ?? null;
  const [shared, setShared] = useState<"idle" | "busy" | "done">("idle");

  const share = async () => {
    setShared("busy");
    try {
      await shareSupportMoodCard({ childName, supportScore, moods });
      setShared("done");
      window.setTimeout(() => setShared("idle"), 2000);
    } catch {
      setShared("idle");
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl bg-cream p-4 text-navy sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-wide text-navy/55 uppercase">
            Support &amp; Mood
          </p>
          <p className="mt-0.5 text-sm font-bold">{childName}’s week at a glance</p>
        </div>
        <button
          type="button"
          onClick={share}
          disabled={shared === "busy"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-cream transition hover:bg-navy/90 disabled:opacity-60"
        >
          {shared === "done" ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Share2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {shared === "done" ? "Ready" : "Share"}
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-wrap items-center gap-x-6 gap-y-3">
        <div className="h-36 w-36 shrink-0 sm:h-40 sm:w-40">
          <svg
            viewBox="0 0 160 160"
            className="h-full w-full"
            role="img"
            aria-label={`Support Score ${supportScore ?? "not yet"}${supportScore === null ? "" : "%"}; recent mood ${
              average === null ? "not logged yet" : moodMeta(Math.round(average)).label
            }`}
          >
            <Ring
              radius={70}
              stroke={16}
              value={independence(supportScore)}
              color={SUPPORT_COLOR}
            />
            <Ring
              radius={52}
              stroke={16}
              value={average === null ? 0 : average / 5}
              color={average === null ? TRACK : moodColor(Math.round(average))}
            />
            {latest === null ? (
              <circle cx="80" cy="80" r="28" fill={TRACK} />
            ) : (
              <FaceShape cx={80} cy={80} r={28} mood={latest} />
            )}
          </svg>
        </div>

        <dl className="min-w-0 flex-1 space-y-4">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-bold text-navy/60">
              <span className="ph-pill h-2.5 w-2.5" style={{ background: SUPPORT_COLOR }} />
              Support Score
            </dt>
            <dd className="mt-1 text-2xl leading-none font-bold">
              {supportScore === null ? "—" : `${supportScore}%`}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-bold text-navy/60">
              <span
                className="ph-pill h-2.5 w-2.5"
                style={{ background: average === null ? TRACK : moodColor(Math.round(average)) }}
              />
              Mood
            </dt>
            <dd className="mt-1 text-2xl leading-none font-bold">
              {average === null ? "—" : moodMeta(Math.round(average)).label}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 border-t border-navy/10 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold">Mood history</p>
          <p className="text-[11px] text-navy/50">{moodRange(moods)}</p>
        </div>
        {moods.length ? (
          <ol className="mt-2 grid grid-cols-7 gap-1">
            {moods.map((m, index) => (
              <li key={`${m.date}-${index}`} className="flex flex-col items-center gap-1">
                <span title={`${fmtShortDate(m.date)}: ${moodMeta(m.mood).label}`}>
                  <MoodFace mood={m.mood} className="h-8 w-8" />
                </span>
                <span className="text-[10px] font-semibold text-navy/60">{m.weekday}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[11px] text-navy/55 italic">
            Moods appear here as Sessions are logged.
          </p>
        )}
      </div>
    </div>
  );
}
