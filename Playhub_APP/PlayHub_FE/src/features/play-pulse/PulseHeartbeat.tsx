import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The tilted Play Pulse heart from the design file, drawn in its own 282 × 269 box. */
const HEART =
  "M570 2954 c-89 -20 -215 -84 -283 -144 -141 -126 -230 -350 -212 -530 3 -30 77 -481 164 -1003 144 -863 160 -949 181 -972 15 -16 35 -25 53 -25 29 0 1767 288 1907 316 217 44 408 211 484 423 107 300 -51 658 -356 805 -199 96 -395 100 -718 15 -63 -17 -147 -33 -186 -36 -104 -8 -105 -6 -138 208 -61 396 -105 526 -237 702 -88 117 -222 206 -364 242 -72 18 -208 18 -295 -1z";
const HEART_BOX = { width: 282.494775, height: 268.843605 };
const HEART_TRANSFORM = "translate(-7.270576,296.843605) scale(0.1,-0.1)";
/** A wavy liquid surface wide enough to drift sideways across the heart without a gap. */
const wave = (amplitude: number, offset = 0) =>
  `M-280 ${offset} q17.5 ${-amplitude} 35 0 t35 0${" t35 0".repeat(22)}V320H-280Z`;
/** One heartbeat blip on a flat line, ending where the heart sits. */
const LINE_HEIGHT = 58;
/**
 * The heartbeat line drawn at the real pixel width, so it always runs edge to edge up to the
 * heart instead of being letterboxed. The blip keeps the same shape at every width.
 */
function linePath(width: number) {
  const mid = LINE_HEIGHT / 2;
  const blipAt = Math.max(0, Math.round(width * 0.35));
  const end = Math.max(blipAt + 41, width);
  return `M2 ${mid}H${blipAt}l9-26 10 48 11-38 11 16H${end - 2}`;
}
/** How long the pulse takes to travel down the line; the heart beats when it arrives. */
const TRAVEL_MS = 750;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Counts smoothly from the previous value to `target`. */
function useCountUp(target: number, reduced: boolean) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced) return void setValue(target);
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(begin + (target - begin) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  return value;
}

/**
 * Play Pulse progress: a heartbeat line that grows towards a heart, and a heart that fills with a
 * gentle liquid wave. Each step sends a pulse down the line; when it reaches the heart, the heart
 * beats ("lub-dub") and ripples. It beats a little faster as the check fills up, celebrates at
 * 100%, and can be tapped for an extra beat. Motion stops for people who ask for less of it.
 */
export function PulseHeartbeat({ step, total }: { step: number; total: number }) {
  const id = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const lineBox = useRef<SVGSVGElement>(null);
  const [lineWidth, setLineWidth] = useState(560);
  useEffect(() => {
    const element = lineBox.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setLineWidth(Math.max(120, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const LINE = linePath(lineWidth);
  const progress = Math.max(0, Math.min(1, step / total));
  const percent = Math.round(progress * 100);
  const shown = useCountUp(percent, reduced);
  const complete = progress >= 1;

  // A beat is a short-lived class on the heart; bumping the key restarts the CSS animation.
  const [beat, setBeat] = useState(0);
  const [travelling, setTravelling] = useState(0);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduced) return;
    setTravelling((n) => n + 1);
    const timer = window.setTimeout(() => setBeat((n) => n + 1), TRAVEL_MS);
    return () => window.clearTimeout(timer);
  }, [step, reduced]);

  // Resting heart rate: about 1.6s per beat when empty, quickening to 0.9s when full.
  const restingBeat = `${(1.6 - 0.7 * progress).toFixed(2)}s`;
  // The liquid surface rises from the bottom of the heart to just above its top.
  const liquidTop = HEART_BOX.height * (1 - progress) - (progress >= 1 ? 16 : 0);

  return (
    <div className="sticky top-[77px] z-20 -mx-2 bg-cream/90 px-2 py-3 backdrop-blur-md sm:top-[81px]">
      <div
        className="relative h-[58px]"
        role="progressbar"
        aria-label={`Play Pulse progress: ${step} of ${total}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <svg
          ref={lineBox}
          viewBox={`0 0 ${lineWidth} ${LINE_HEIGHT}`}
          className="absolute inset-y-0 left-0 h-full w-[calc(100%-60px)] overflow-visible"
          aria-hidden
        >
          {/* The whole track, faint. */}
          <path
            d={LINE}
            fill="none"
            stroke="rgba(223,59,45,.14)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* What has been done so far; grows from where it was instead of redrawing. */}
          <path
            d={LINE}
            pathLength="1"
            fill="none"
            stroke="#df3b2d"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            strokeDashoffset={1 - progress}
            style={{
              transition: reduced ? undefined : "stroke-dashoffset 700ms cubic-bezier(.22,1,.36,1)",
            }}
          />
          {/* A bright pulse running down the line to the heart after each step. */}
          {!reduced && travelling > 0 && (
            <path
              key={travelling}
              d={LINE}
              pathLength="1"
              fill="none"
              stroke="#ff6f5e"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ph-pulse-travel"
              style={{ animationDuration: `${TRAVEL_MS}ms` }}
            />
          )}
          {/* A soft resting glow that drifts along the finished part. */}
          {!reduced && progress > 0 && (
            <path
              d={LINE}
              pathLength="1"
              fill="none"
              stroke="#fff"
              strokeOpacity=".55"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`0.06 ${1 + progress}`}
              className="ph-pulse-shimmer"
              style={{ ["--ph-pulse-end" as string]: `${-progress}` }}
            />
          )}
        </svg>

        <button
          type="button"
          onClick={() => setBeat((n) => n + 1)}
          aria-label={`Your Play Pulse is ${percent}% complete`}
          className="absolute top-1/2 right-0 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          {/* Ripple rings sent out by each beat. */}
          {!reduced && beat > 0 && (
            <span
              key={`ring-${beat}`}
              className="ph-heart-ring absolute inset-1 rounded-full border-2 border-coral/50"
              aria-hidden
            />
          )}
          {complete && !reduced && (
            <span
              className="ph-heart-glow absolute inset-0 rounded-full bg-coral/25 blur-md"
              aria-hidden
            />
          )}

          <span
            className={cn("relative block h-12 w-[50px]", !reduced && "ph-heart-rest")}
            style={{ animationDuration: restingBeat }}
            aria-hidden
          >
            <svg
              key={`beat-${beat}`}
              viewBox={`0 0 ${HEART_BOX.width} ${HEART_BOX.height}`}
              className={cn(
                "h-12 w-[50px] overflow-visible drop-shadow-[0_0_5px_rgba(228,35,28,0.45)]",
                !reduced && beat > 0 && "ph-heart-beat",
              )}
            >
              <defs>
                <clipPath id={`${id}-heart`}>
                  <path transform={HEART_TRANSFORM} d={HEART} />
                </clipPath>
              </defs>
              <path transform={HEART_TRANSFORM} d={HEART} fill="rgba(223,59,45,.15)" />
              <g clipPath={`url(#${id}-heart)`}>
                <g
                  style={{
                    transform: `translateY(${liquidTop}px)`,
                    transition: reduced ? undefined : "transform 900ms cubic-bezier(.22,1,.36,1)",
                  }}
                >
                  {/* Two wave layers drifting at different speeds give the liquid some depth. */}
                  <path
                    className={cn(!reduced && "ph-heart-wave-slow")}
                    d={wave(16)}
                    fill="#f07a6c"
                    style={{ ["--ph-wave" as string]: "140px" }}
                  />
                  <path
                    className={cn(!reduced && "ph-heart-wave")}
                    d={wave(-12, 8)}
                    fill="#E4231C"
                    style={{ ["--ph-wave" as string]: "140px" }}
                  />
                </g>
              </g>
            </svg>
          </span>
          <span
            className={cn(
              "absolute text-[10px] font-extrabold tabular-nums",
              progress > 0.4
                ? "text-white [text-shadow:0_1px_2px_rgba(140,28,18,.55)]"
                : "text-coral",
            )}
            aria-hidden
          >
            {shown}
          </span>
        </button>
      </div>
    </div>
  );
}
