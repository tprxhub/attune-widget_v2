import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, Sparkles } from "lucide-react";
import { ATTUNE_MODES, getAttuneStatus } from "@/api/attune";
import { cn } from "@/lib/utils";

/**
 * The two moments Attune helps with around a Play Dose or Activity: "Get an idea" and "My child is
 * struggling". Hidden when Attune is off or locked for this account.
 */
export function AttuneMomentsCard({
  activityId,
  activityName,
  description = "Your 24/7 Play Partner: an idea for today, or help when it gets hard.",
  className,
}: {
  activityId?: string | undefined;
  activityName?: string | undefined;
  description?: string;
  className?: string;
}) {
  const status = useQuery({
    queryKey: ["attune", "status", "dashboard"],
    queryFn: () => getAttuneStatus().catch(() => null),
    staleTime: 60_000,
  });
  if (!status.data?.enabled || status.data.freePlan) return null;
  const about = activityId ? { activity: activityId, about: activityName ?? "" } : {};
  return (
    <section className={cn("ph-card p-5", className)} aria-label="Ask Attune">
      <div className="rounded-2xl border border-blue/25 bg-blue/5 p-4">
        <p className="text-sm font-bold text-blue">Ask Attune™</p>
        <p className="text-xs text-navy/65">{description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/attune"
            search={{ mode: "idea", ...about }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue/40 px-4 text-sm font-bold text-blue transition hover:bg-blue/10"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> {ATTUNE_MODES.idea.label}
          </Link>
          <Link
            to="/attune"
            search={{ mode: "regulation", ...about }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-coral/40 px-4 text-sm font-bold text-coral transition hover:bg-coral/10"
          >
            <HeartHandshake className="h-4 w-4" aria-hidden /> {ATTUNE_MODES.regulation.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
