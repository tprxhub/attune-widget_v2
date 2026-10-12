import { moodMeta } from "@/components/icons";
import { fmtShortDate } from "@/lib/format";
import type { Attempt } from "@/lib/types";
import { FaceShape } from "./SupportMoodRings";
import { moodRange, recentMoods } from "./supportMood";

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

export function MoodHistory({ rows }: { rows: Attempt[] }) {
  const moods = recentMoods(rows);
  return (
    <div className="mt-4 border border-navy/8 bg-white px-3 pt-2.5 pb-2 ph-r-md">
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
        <>
          <ol className="mt-2 grid grid-cols-7 gap-1" aria-label="No moods logged yet">
            {["M", "T", "W", "T", "F", "S", "S"].map((letter, index) => (
              <li key={index} className="flex flex-col items-center gap-1">
                <span className="ph-pill h-8 w-8 border-2 border-dashed border-navy/15" />
                <span className="text-[10px] font-semibold text-navy/35">{letter}</span>
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[11px] text-navy/55 italic">
            Moods appear here as Sessions are logged.
          </p>
        </>
      )}
    </div>
  );
}
