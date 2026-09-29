import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { listGoals, listPlans } from "@/api/plans";
import { LEVEL_GUIDANCE } from "@/api/domain";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeletons";
import { LevelDots, TOKEN_BG, TOKEN_SOFT } from "@/components/brand";
import { GoalIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import thumbGrip from "@/assets/Thumbnails/Thumb1.jpeg";
import thumbReading from "@/assets/Thumbnails/Thumb2.jpeg";
import thumbScissors from "@/assets/Thumbnails/Thum3.jpeg";
import thumbWriting from "@/assets/Thumbnails/Thumb4.jpeg";

export const Route = createFileRoute("/plans/")({
  head: () => ({
    meta: [
      { title: "Play Plans — Play Hub" },
      {
        name: "description",
        content:
          "Pick a Plan, pick a level, press play. Every Play Plan is a week-long Play Dose for the Fine Motor Play Kit.",
      },
      { property: "og:title", content: "Play Plans — Play Hub" },
      {
        property: "og:description",
        content: "Pick a Plan, pick a level, press play — a week-long Play Dose for every skill.",
      },
    ],
  }),
  component: () => (
    <Protected>
      <PlansPage />
    </Protected>
  ),
});

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

function PlansPage() {
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });

  return (
    <>
      <PageHeader
        eyebrow="Play plans"
        title="Pick a Plan, pick a level, press play."
        description={`Every plan is a week-long Play Dose. ${LEVEL_GUIDANCE} All plans use the Fine Motor Play Kit.`}
      />

      {plans.isLoading || goals.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        (goals.data ?? []).map((goal) => {
          const goalPlans = (plans.data ?? []).filter((p) => p.goalId === goal.id);
          return (
            <section key={goal.id} className="mt-8 first:mt-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn("h-2.5 w-2.5 rounded-[3px]", TOKEN_BG[goal.color])}
                  aria-hidden
                />
                <h2 className="text-lg font-bold">{goal.name}</h2>
              </div>
              <p className="mt-0.5 text-sm text-navy/55">Best paired with the {goal.kit}</p>

              <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {goalPlans.map((plan) => (
                  <li key={plan.id}>
                    <Link
                      to="/plans/$planId"
                      params={{ planId: plan.id }}
                      className="group relative block h-full bg-white p-3 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.08)] border-2 border-navy/8 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] ph-r-3xl"
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
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <span
                          className="pointer-events-none absolute inset-0 bg-navy/35"
                          aria-hidden
                        />
                        <span
                          className="pointer-events-none absolute -bottom-8 -right-8 block h-32 w-32 rounded-full bg-white/10 blur-2xl"
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

                        <span className="relative flex justify-between items-start">
                          <span className="inline-flex min-w-0 max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white backdrop-blur-md whitespace-nowrap">
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", TOKEN_BG[goal.color])}
                              aria-hidden
                            />
                            <span className="truncate">{goal.short}</span>
                          </span>
                          <span className="shrink-0 rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white backdrop-blur-md whitespace-nowrap">
                            {plan.level}
                          </span>
                        </span>

                        <span className="relative grid h-9 w-9 place-items-center self-end bg-white shadow-lg ph-r-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                          <GoalIcon goalId={goal.id} className="h-5 w-5 text-navy" />
                        </span>
                      </span>

                      <span className="block px-4 pt-6 pb-4">
                        <h3 className="text-xl font-extrabold leading-tight text-navy">
                          {plan.title}
                        </h3>
                        <span className="mt-2 block">
                          <LevelDots level={plan.level} />
                        </span>
                        <p className="mt-3 line-clamp-2 min-h-[2.6em] text-xs leading-relaxed text-navy/60">
                          {plan.summary}
                        </p>
                        <span className="mt-4 flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-bold",
                              TOKEN_SOFT[goal.color],
                            )}
                          >
                            {plan.entries.length} checkpoints
                          </span>
                          <span
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-bold",
                              TOKEN_SOFT[goal.color],
                            )}
                          >
                            Ages {plan.age ?? "3+"}
                          </span>
                        </span>
                        <span className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-navy text-white ph-r-md text-sm font-extrabold shadow-[0_6px_0_0_#000] transition-all group-active:translate-y-[2px] group-active:shadow-[0_4px_0_0_#000]">
                          Start Play Dose
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
