import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The tilted Play Pulse heart from the design file, drawn in its own 282 × 269 box. */
const HEART =
  "M570 2954 c-89 -20 -215 -84 -283 -144 -141 -126 -230 -350 -212 -530 3 -30 77 -481 164 -1003 144 -863 160 -949 181 -972 15 -16 35 -25 53 -25 29 0 1767 288 1907 316 217 44 408 211 484 423 107 300 -51 658 -356 805 -199 96 -395 100 -718 15 -63 -17 -147 -33 -186 -36 -104 -8 -105 -6 -138 208 -61 396 -105 526 -237 702 -88 117 -222 206 -364 242 -72 18 -208 18 -295 -1z";
const HEART_BOX = { width: 282.494775, height: 268.843605 };
const HEART_TRANSFORM = "translate(-7.270576,296.843605) scale(0.1,-0.1)";
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

/** One fill-and-empty animation whenever a new question screen appears. */
export function PulseHeartbeat({ screenKey }: { screenKey: string }) {
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

  return (
    <div className="sticky top-[77px] z-20 -mx-2 bg-cream/90 px-2 py-3 backdrop-blur-md sm:top-[81px]">
      <div className="relative h-[58px]" aria-hidden>
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
          <path
            key={screenKey}
            d={LINE}
            pathLength="1"
            fill="none"
            stroke="#df3b2d"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            strokeDashoffset={reduced ? 0 : -1}
            className={cn(!reduced && "ph-pulse-loop")}
          />
        </svg>

        <span className="absolute top-1/2 right-0 grid h-14 w-14 -translate-y-1/2 place-items-center">
          <svg
            viewBox={`0 0 ${HEART_BOX.width} ${HEART_BOX.height}`}
            className={cn(
              "h-12 w-[50px] overflow-visible drop-shadow-[0_0_5px_rgba(228,35,28,0.45)]",
              !reduced && "ph-heart-rest",
            )}
          >
            <path transform={HEART_TRANSFORM} d={HEART} fill="#E4231C" />
          </svg>
        </span>
      </div>
    </div>
  );
}
