import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span className={cn("ph-skeleton block", className)}>
      <span className="ph-skeleton-shine" />
    </span>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ph-card p-5">
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ph-card flex items-center gap-4 p-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="ph-card p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-5 h-56 w-full rounded-2xl" />
    </div>
  );
}
