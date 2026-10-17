import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { moodMeta } from "@/components/icons";
import { FloatingPanel } from "@/components/FloatingPanel";
import { Ring } from "./ProgressRing";
import { HeartMarker, SmileMarker } from "./RingIcons";
import {
  averageMood,
  independence,
  lightShade,
  moodColor,
  TRACK,
  type MoodDay,
} from "./supportMood";

type RingKind = "support" | "mood";

export function InteractiveProgressRings({
  supportScore,
  moods,
  logo,
}: {
  supportScore: number | null;
  moods: MoodDay[];
  logo: string;
}) {
  const [ringProgress, setRingProgress] = useState(0);
  const [shown, setShown] = useState<RingKind | null>(null);
  const [pinned, setPinned] = useState<RingKind | null>(null);
  const graph = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const detailsId = useId();
  const average = averageMood(moods);
  const score = supportScore === null ? null : Math.round(100 - supportScore);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setRingProgress(1);
      return;
    }

    const duration = 1800;
    let frame = 0;
    let startedAt: number | undefined;
    const animate = (now: number) => {
      startedAt ??= now;
      const linear = Math.min(1, (now - startedAt) / duration);
      setRingProgress(1 - (1 - linear) ** 3);
      if (linear < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const clear = () => {
    setShown(null);
    setPinned(null);
  };
  const toggle = (kind: RingKind) => {
    const next = pinned === kind ? null : kind;
    setPinned(next);
    setShown(next);
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        !graph.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      ) {
        setShown(null);
        setPinned(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const description =
    shown === "support"
      ? score === null
        ? "Log a finished Session to see how independently your child is playing."
        : `${score}% independence = 100% minus ${supportScore}% support needed. A higher independence score means less help. The latest Play Dose’s finished Sessions are averaged; unfinished Sessions are excluded.`
      : average === null
        ? "Log a Session’s mood to see how play has been feeling."
        : `Average mood: ${average.toFixed(1)} out of 5 across the most recent ${moods.length} day${moods.length === 1 ? "" : "s"} with a recorded mood. Each day uses its latest Session. 1 means Really struggled and 5 means Loved it.`;
  return (
    <div ref={graph} className="relative mx-auto mt-4 aspect-square w-full max-w-[360px]">
      <svg
        viewBox="0 0 160 160"
        className="h-full w-full"
        role="group"
        aria-label="Independence and mood rings"
      >
        <RingTarget
          label={`Independence Score: ${score === null ? "Not recorded" : `${score}%`}`}
          open={shown === "support"}
          detailsId={detailsId}
          onInspect={() => setShown("support")}
          onLeave={() => setShown(pinned)}
          onToggle={() => toggle("support")}
          onClose={clear}
        >
          <Ring
            radius={70}
            stroke={12}
            value={independence(supportScore)}
            color="#2459A0"
            track={lightShade("#2459A0")}
            progress={ringProgress}
          />
          <RingMarker radius={70} value={independence(supportScore) * ringProgress}>
            <HeartMarker />
          </RingMarker>
        </RingTarget>
        <RingTarget
          label={`Mood: ${average === null ? "Not recorded" : moodMeta(Math.round(average)).label}`}
          open={shown === "mood"}
          detailsId={detailsId}
          onInspect={() => setShown("mood")}
          onLeave={() => setShown(pinned)}
          onToggle={() => toggle("mood")}
          onClose={clear}
        >
          <Ring
            radius={58}
            stroke={12}
            value={average === null ? 0 : average / 5}
            color={average === null ? TRACK : moodColor(Math.round(average))}
            track={lightShade(average === null ? "#A89A8C" : moodColor(Math.round(average)))}
            progress={ringProgress}
          />
          <RingMarker radius={58} value={(average === null ? 0 : average / 5) * ringProgress}>
            <SmileMarker />
          </RingMarker>
        </RingTarget>
      </svg>
      <div className="pointer-events-none absolute inset-[25%] flex flex-col items-center justify-center text-center">
        <p className="text-sm font-bold sm:text-base">Let’s</p>
        <div className="relative my-1 h-9 w-16 shrink-0 overflow-hidden sm:h-10 sm:w-[4.5rem]">
          <img
            src={logo}
            alt="Play Hub"
            className="absolute top-0 left-0 h-16 w-16 max-w-none -translate-y-[19%] object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
          />
        </div>
        <p className="text-sm font-bold sm:text-base">again soon!</p>
      </div>
      {shown && (
        <FloatingPanel
          anchorRef={graph}
          panelRef={panel}
          className="w-72 rounded-xl bg-navy px-4 py-3 text-sm text-cream shadow-xl"
        >
          <div
            id={detailsId}
            role={pinned ? "dialog" : "tooltip"}
            aria-label={shown === "support" ? "Independence details" : "Mood details"}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">
                {shown === "support"
                  ? `Independence: ${score === null ? "Not recorded" : `${score}%`}`
                  : `Mood: ${average === null ? "Not recorded" : moodMeta(Math.round(average)).label}`}
              </p>
              {pinned && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Close chart details"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-1 leading-relaxed text-cream/85">{description}</p>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

function RingTarget({
  label,
  open,
  detailsId,
  onInspect,
  onLeave,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  detailsId: string;
  onInspect: () => void;
  onLeave: () => void;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={open}
      aria-describedby={open ? detailsId : undefined}
      onMouseEnter={onInspect}
      onMouseLeave={onLeave}
      onFocus={onInspect}
      onBlur={onClose}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      className="cursor-pointer transition-opacity hover:opacity-85 focus-visible:opacity-75 focus-visible:outline-none"
    >
      {children}
    </g>
  );
}

/** Keep the marker upright at the advancing end of the clockwise ring. */
export function RingMarker({
  radius,
  value,
  children,
}: {
  radius: number;
  value: number;
  children: ReactNode;
}) {
  const angle = Math.max(0, Math.min(1, value)) * 2 * Math.PI - Math.PI / 2;
  const x = 80 + radius * Math.cos(angle);
  const y = 80 + radius * Math.sin(angle);
  return <g transform={`translate(${x} ${y})`}>{children}</g>;
}
