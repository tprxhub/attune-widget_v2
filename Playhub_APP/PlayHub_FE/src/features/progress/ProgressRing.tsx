import { useEffect, useState } from "react";
import { TRACK } from "./supportMood";

export function Ring({
  radius,
  stroke,
  value,
  color,
  track = TRACK,
  opacity = 1,
  animate = false,
  progress,
}: {
  radius: number;
  stroke: number;
  value: number;
  color: string;
  track?: string;
  opacity?: number;
  animate?: boolean;
  /** Shared animation progress keeps a marker and its ring in sync. */
  progress?: number;
}) {
  const [animationStarted, setAnimationStarted] = useState(false);
  useEffect(() => {
    if (!animate) return;
    const frame = window.requestAnimationFrame(() => setAnimationStarted(true));
    return () => window.cancelAnimationFrame(frame);
  }, [animate]);

  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, value));
  const filled =
    progress === undefined
      ? animate && !animationStarted
        ? 0
        : target
      : target * Math.max(0, Math.min(1, progress));
  return (
    <>
      <circle cx="80" cy="80" r={radius} fill="none" stroke={track} strokeWidth={stroke} />
      {(filled > 0 || animate) && (
        <circle
          opacity={opacity}
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap={filled > 0 ? "round" : "butt"}
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform="rotate(-90 80 80)"
          className={
            progress !== undefined
              ? ""
              : animate
                ? "transition-[stroke-dasharray] duration-[1800ms] ease-out motion-reduce:transition-none"
                : "transition-[stroke-dasharray] duration-700 ease-out"
          }
        />
      )}
    </>
  );
}
