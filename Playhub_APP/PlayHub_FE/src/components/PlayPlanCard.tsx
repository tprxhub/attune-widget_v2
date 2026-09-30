import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
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

export function PlayPlanCard({ plan, goal }: { plan: PlayPlan; goal: Goal }) {
  return (
    <Link
      to="/plans/$planId"
      params={{ planId: plan.id }}
      className="group relative block h-full border-2 border-navy/8 bg-white p-3 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-300 ph-r-3xl hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)]"
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
            Ages {plan.age ?? "3+"}
          </span>
        </span>
        <span className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-navy text-sm font-extrabold text-white shadow-[0_6px_0_0_#000] transition-all ph-r-md group-active:translate-y-[2px] group-active:shadow-[0_4px_0_0_#000]">
          Start Play Dose
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
