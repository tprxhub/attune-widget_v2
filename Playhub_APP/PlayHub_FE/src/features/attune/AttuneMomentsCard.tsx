import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAttuneStatus } from "@/api/attune";
import { cn } from "@/lib/utils";

const prompts = [
  { label: "We’re bored. Help.", mode: "idea" },
  { label: "What should we play right now?", mode: "idea" },
  { label: "They won’t engage today", mode: "regulation" },
  { label: "Help! We just had a meltdown", mode: "regulation" },
] as const;

/** Prompt Attune about a Play Dose or Activity when it is available for this account. */
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
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {prompts.map(({ label, mode }) => (
            <Link
              key={label}
              to="/attune"
              search={{ mode, q: label, ...about }}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-bold transition",
                mode === "idea"
                  ? "border-blue/40 text-blue hover:bg-blue/10"
                  : "border-coral/40 text-coral hover:bg-coral/10",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
