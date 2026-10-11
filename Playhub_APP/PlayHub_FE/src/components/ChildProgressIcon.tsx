import { useQuery } from "@tanstack/react-query";
import { getProgress } from "@/api/progress";
import { StatusIcon } from "@/components/StatusBadge";

/** Uses the same cached progress report as the child's dashboard and status badge. */
export function ChildProgressIcon({ childId, size = 36 }: { childId: string; size?: number }) {
  const { data } = useQuery({
    queryKey: ["progress", childId],
    queryFn: () => getProgress(childId),
  });
  return <StatusIcon status={data?.status ?? "no_data"} pixelSize={size} />;
}
