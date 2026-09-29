import logoUrl from "@/assets/PlayHub_Logo .svg";
import { cn } from "@/lib/utils";
import { LEVELS, type Level } from "@/lib/types";

export const TOKEN_BG: Record<string, string> = {
  coral: "bg-coral",
  blue: "bg-blue",
  amber: "bg-amber",
  navy: "bg-navy",
};
export const TOKEN_TEXT: Record<string, string> = {
  coral: "text-coral",
  blue: "text-blue",
  amber: "text-amber",
  navy: "text-navy",
};
export const TOKEN_SOFT: Record<string, string> = {
  coral: "bg-coral/12 text-coral",
  blue: "bg-blue/12 text-blue",
  amber: "bg-amber/25 text-navy",
  navy: "bg-navy/10 text-navy",
};

export const LEVEL_TOKEN: Record<Level, "amber" | "blue" | "coral"> = {
  Rookie: "amber",
  Starter: "blue",
  Pro: "coral",
};

export function Logo({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "large";
}) {
  return (
    <span
      className={cn("inline-flex items-center", size === "large" ? "gap-3" : "gap-2.5", className)}
    >
      <img
        src={logoUrl}
        alt="Play Hub"
        className={cn("w-auto shrink-0 -translate-y-1", size === "large" ? "h-20" : "h-14")}
      />
      <span className="hidden min-w-0 flex-col gap-0.5 leading-none sm:flex">
        <span
          className={cn(
            "font-semibold tracking-[0.14em] uppercase opacity-60",
            size === "large" ? "text-[13px]" : "text-[12px]",
          )}
        >
          The Toy
        </span>
        <span
          className={cn(
            "font-semibold tracking-[0.14em] uppercase opacity-60",
            size === "large" ? "text-[13px]" : "text-[12px]",
          )}
        >
          Pharmacy
        </span>
      </span>
    </span>
  );
}

export function LevelDots({ level, showLabel = true }: { level: Level; showLabel?: boolean }) {
  const idx = LEVELS.indexOf(level);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i <= idx ? TOKEN_BG[LEVEL_TOKEN[level]] : "bg-navy/20",
            )}
          />
        ))}
      </span>
      {showLabel && <span className="text-xs font-bold tracking-wide">{level}</span>}
    </span>
  );
}

export function ChildAvatar({
  name,
  token = "blue",
  size = 36,
  shape = "circle",
  className,
}: {
  name: string;
  token?: "coral" | "blue" | "amber";
  size?: number;
  shape?: "circle" | "rounded" | "square";
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const shapeClass =
    shape === "circle" ? "rounded-full" : shape === "rounded" ? "rounded-[35%]" : "rounded-lg";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center font-bold text-white",
        shapeClass,
        TOKEN_BG[token],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export const COMPLETION_LABELS = [
  "Didn't manage it",
  "Needed a lot of help",
  "Got there with support",
  "Nearly independent",
  "Nailed it!",
];

export const LEVEL_GUIDANCE =
  "Start at Starter — move down to Rookie if it's difficult, or up to Pro if it feels easy.";
