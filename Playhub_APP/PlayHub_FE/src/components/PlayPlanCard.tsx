import { Link } from "@tanstack/react-router";
import { ArrowRight, Gift, Lock } from "lucide-react";
import type { FreeAccess } from "@/features/plans/useFreePlan";
import type { Goal, PlayPlan } from "@/lib/types";
import { LevelDots, TOKEN_BG, TOKEN_SOFT } from "@/components/brand";
import { GoalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import thumbGrip from "@/assets/Thumbnails/Thumb1.jpeg";
import thumbReading from "@/assets/Thumbnails/Thumb2.jpeg";
import thumbScissors from "@/assets/Thumbnails/Thum3.jpeg";
import thumbWriting from "@/assets/Thumbnails/Thumb4.jpeg";

const GRADIENT: Record<string, string> = {
  coral: "from-coral to-navy",
  blue: "from-blue to-navy",
  amber: "from-amber to-navy",
  navy: "from-navy to-navy",
};

/** One visual per Play Plan, shared by its Rookie, Starter and Pro versions. */
const PLAN_THUMBNAILS: Record<string, string> = {
  pinch: thumbGrip,
  bilateral: thumbGrip,
  visual: thumbReading,
  tool: thumbScissors,
  prewrite: thumbWriting,
  scanning: thumbReading,
  letters: thumbWriting,
};

/** "Ages 4-6" from the API already carries the word; older content has just "4-6". */
const agesLabel = (age: string | undefined) =>
  !age ? "Ages 3+" : /^ages?\b/i.test(age.trim()) ? age.trim() : `Ages ${age}`;

export function PlayPlanCard({
  plan,
  goal,
  access = "open",
  onChoose,
}: {
  plan: PlayPlan;
  goal: Goal;
  /** Free tier: "choose" offers this plan as the free one, "subscribe" shows it locked. */
  access?: FreeAccess;
  onChoose?: () => void;
}) {
  const locked = plan.publicationStatus === "locked" || goal.publicationStatus === "locked";
  const freeLocked = !locked && access !== "open";
  return (
    <Link
      to="/plans/$planId"
      params={{ planId: plan.id }}
      aria-disabled={locked || undefined}
      tabIndex={locked ? -1 : undefined}
      onClick={(event) => {
        if (locked) event.preventDefault();
        else if (access === "choose" && onChoose) {
          event.preventDefault();
          onChoose();
        }
      }}
      onKeyDown={(event) => {
        if (locked && (event.key === "Enter" || event.key === " ")) event.preventDefault();
      }}
      className={cn(
        "group relative block h-full border-2 border-navy/8 bg-white p-3 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 ph-r-3xl",
        locked
          ? "cursor-not-allowed border-dashed border-navy/25 grayscale opacity-60"
          : freeLocked
            ? "border-dashed border-navy/20 hover:-translate-y-1"
            : "hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)]",
      )}
    >
      <span
        className={cn(
          "relative flex h-44 flex-col justify-between overflow-hidden bg-gradient-to-br p-6 ph-r-2xl",
          GRADIENT[goal.color],
        )}
      >
        <img
          src={plan.thumbnailUrl ?? PLAN_THUMBNAILS[goal.id] ?? thumbGrip}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="pointer-events-none absolute inset-0 bg-navy/35" aria-hidden />
        <span
          className="pointer-events-none absolute -right-8 -bottom-8 block h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -top-10 -right-10 block h-24 w-24 rounded-full bg-white/20 blur-xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 block opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:14px_14px]"
          aria-hidden
        />

        <span className="relative flex items-start justify-between">
          <span className="inline-flex min-w-0 max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[10px] font-extrabold tracking-widest whitespace-nowrap text-white uppercase backdrop-blur-md">
            <span className={cn("h-1.5 w-1.5 rounded-full", TOKEN_BG[goal.color])} aria-hidden />
            <span className="truncate">{goal.short}</span>
          </span>
          <span className="shrink-0 rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[10px] font-extrabold tracking-widest whitespace-nowrap text-white uppercase backdrop-blur-md">
            {plan.level}
          </span>
        </span>

        {locked && (
          <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full bg-amber px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-navy uppercase shadow-sm">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Coming soon
          </span>
        )}
        {access === "subscribe" && !locked && (
          <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-navy uppercase shadow-sm">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Subscribers
          </span>
        )}

        <span className="relative grid h-9 w-9 place-items-center self-end bg-white shadow-lg ph-r-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <GoalIcon goalId={goal.id} className="h-5 w-5 text-navy" />
        </span>
      </span>

      <span className="block px-4 pt-6 pb-4">
        <h3 className="text-xl leading-tight font-extrabold text-navy">{plan.title}</h3>
        <span className="mt-2 block">
          <LevelDots level={plan.level} />
        </span>
        <p className="mt-3 line-clamp-2 min-h-[2.6em] text-xs leading-relaxed text-navy/60">
          {plan.summary}
        </p>
        <span className="mt-4 flex flex-wrap gap-2">
          <span className={cn("rounded-lg px-3 py-1 text-xs font-bold", TOKEN_SOFT[goal.color])}>
            {plan.entries.length} checkpoints
          </span>
          <span className={cn("rounded-lg px-3 py-1 text-xs font-bold", TOKEN_SOFT[goal.color])}>
            {agesLabel(plan.age)}
          </span>
        </span>
        <span
          className={cn(
            "mt-5 flex h-12 w-full items-center justify-center gap-2 text-sm font-extrabold transition-all ph-r-md",
            locked || access === "subscribe"
              ? "border border-dashed border-navy/35 bg-navy/[0.04] text-navy/65"
              : access === "choose"
                ? "bg-amber text-navy shadow-[0_6px_0_0_#b07a1c] group-active:translate-y-[2px]"
                : "bg-navy text-white shadow-[0_6px_0_0_#000] group-active:translate-y-[2px] group-active:shadow-[0_4px_0_0_#000]",
          )}
        >
          {locked ? (
            <>
              <Lock className="h-4 w-4" aria-hidden /> Available soon
            </>
          ) : access === "subscribe" ? (
            <>
              <Lock className="h-4 w-4" aria-hidden /> Subscribe to unlock
            </>
          ) : access === "choose" ? (
            <>
              <Gift className="h-4 w-4" aria-hidden /> Open this one free
            </>
          ) : (
            <>
              Start Play Dose <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </span>
      </span>
    </Link>
  );
}
