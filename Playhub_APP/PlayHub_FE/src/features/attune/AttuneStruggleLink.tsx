import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake } from "lucide-react";
import { ATTUNE_MODES, getAttuneStatus } from "@/api/attune";
import { cn } from "@/lib/utils";

/**
 * "My child is struggling", offered right after a Session is logged. Hidden when Attune is off or
 * locked for this account, so it never leads to a dead end.
 */
export function AttuneStruggleLink({
  activityId,
  activityName,
  className,
}: {
  activityId?: string | undefined;
  activityName?: string | undefined;
  className?: string;
}) {
  const status = useQuery({
    queryKey: ["attune", "status", "dashboard"],
    queryFn: () => getAttuneStatus().catch(() => null),
    staleTime: 60_000,
  });
  if (!status.data?.enabled || status.data.freePlan) return null;
  return (
    <Link
      to="/attune"
      search={
        activityId
          ? { mode: "regulation", activity: activityId, about: activityName ?? "" }
          : { mode: "regulation" }
      }
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-bold text-coral underline-offset-2 hover:underline",
        className,
      )}
    >
      <HeartHandshake className="h-4 w-4" aria-hidden />
      Was it a hard one? {ATTUNE_MODES.regulation.label}
    </Link>
  );
}
