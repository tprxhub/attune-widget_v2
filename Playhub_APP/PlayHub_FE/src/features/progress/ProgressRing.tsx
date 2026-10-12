import { TRACK } from "./supportMood";

export function Ring({
  radius,
  stroke,
  value,
  color,
  track = TRACK,
  opacity = 1,
}: {
  radius: number;
  stroke: number;
  value: number;
  color: string;
  track?: string;
  opacity?: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, value));
  return (
    <>
      <circle cx="80" cy="80" r={radius} fill="none" stroke={track} strokeWidth={stroke} />
      {filled > 0 && (
        <circle
          opacity={opacity}
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
