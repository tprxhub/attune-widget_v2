import { useState } from "react";
import { Check, Loader2, PartyPopper, Share2 } from "lucide-react";
import { moodMeta } from "@/components/icons";
import { InteractiveProgressRings } from "./InteractiveProgressRings";
import { useApplicationLogo } from "@/api/branding";
import type { Attempt } from "@/lib/types";
import { shareSupportMoodCard } from "./shareSupportMood";
import { averageMood, celebrate, moodColor, recentMoods, independence, TRACK } from "./supportMood";

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

/** A few soft confetti pieces in the brand colours, behind the card's content. */
export function Confetti() {
  const pieces: [number, number, number, string, "dot" | "bar"][] = [
    [8, 10, 20, "#F2B544", "bar"],
    [22, 4, -30, "#DF3B2D", "dot"],
    [38, 14, 45, "#2459A0", "bar"],
    [55, 6, 0, "#6FA05A", "dot"],
    [70, 12, -15, "#F2B544", "dot"],
    [84, 5, 60, "#DF3B2D", "bar"],
    [93, 18, 10, "#2459A0", "dot"],
    [64, 30, 35, "#6FA05A", "bar"],
  ];
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 w-full opacity-70"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden
    >
      {pieces.map(([x, y, rotate, color, shape], index) =>
        shape === "dot" ? (
          <circle key={index} cx={x} cy={y} r="1.1" fill={color} />
        ) : (
          <rect
            key={index}
            x={x - 1.6}
            y={y - 0.5}
            width="3.2"
            height="1"
            rx="0.5"
            fill={color}
            transform={`rotate(${rotate} ${x} ${y})`}
          />
        ),
      )}
    </svg>
  );
}

export { Ring } from "./ProgressRing";

/** Shareable Support Score and Mood rings with the Play Hub message at their centre. */
export function SupportMoodRings({
  childName,
  supportScore,
  rows,
}: {
  childName: string;
  supportScore: number | null;
  rows: Attempt[];
}) {
  const logo = useApplicationLogo();
  const moods = recentMoods(rows);
  const average = averageMood(moods);
  const cheer = celebrate(childName, supportScore, moods);
  const latestWin = [...rows]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .find((row) => row.bigWin.trim())?.bigWin;
  const [shared, setShared] = useState<"idle" | "busy" | "done">("idle");
  const [shareError, setShareError] = useState(false);
  const share = async () => {
    setShared("busy");
    setShareError(false);
    try {
      await shareSupportMoodCard({
        childName,
        supportScore,
        moods,
        logoUrl: logo,
        winNote: latestWin,
      });
      setShared("done");
      window.setTimeout(() => setShared("idle"), 2000);
    } catch {
      setShared("idle");
      setShareError(true);
    }
  };
  return (
    <div className="ph-r-lg relative isolate flex min-w-0 flex-col overflow-hidden bg-white p-4 text-navy sm:p-6">
      <Confetti />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-amber px-3 py-1.5 text-[10px] font-extrabold tracking-[0.12em] uppercase">
          <PartyPopper className="h-3.5 w-3.5" aria-hidden /> Celebrate the win
        </p>
        <button
          type="button"
          onClick={share}
          aria-label={shared === "busy" ? "Preparing share image" : "Share progress"}
          title="Share progress"
          disabled={shared === "busy"}
          className="ph-pill inline-flex h-11 w-11 items-center justify-center bg-coral text-xs font-bold text-white shadow-sm transition hover:bg-coral/90 disabled:opacity-60"
        >
          {shared === "busy" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : shared === "done" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <InteractiveProgressRings supportScore={supportScore} moods={moods} logo={logo} />

      <ul
        aria-label="Chart legend"
        className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-navy/70"
      >
        <li className="flex items-center gap-2">
          <span
            className="ph-pill h-2.5 w-2.5 shrink-0"
            style={{ background: SUPPORT_COLOR }}
            aria-hidden
          />
          Independence Score:{" "}
          {supportScore === null ? "Not recorded" : `${Math.round(100 - supportScore)}%`}
        </li>
        <li className="flex items-center gap-2">
          <span
            className="ph-pill h-2.5 w-2.5 shrink-0"
            style={{ background: average === null ? TRACK : moodColor(Math.round(average)) }}
            aria-hidden
          />
          Mood: {average === null ? "Not recorded" : moodMeta(Math.round(average)).label}
        </li>
      </ul>
      <p className="mt-2 break-words rounded-xl bg-navy/5 px-4 py-3 text-center text-base font-semibold text-navy/75 sm:text-lg">
        {latestWin ? `“${latestWin}”` : cheer.message}
      </p>

      {shareError && (
        <p role="alert" className="mt-3 text-sm text-coral">
          The image could not be prepared. Please try sharing again.
        </p>
      )}
    </div>
  );
}
