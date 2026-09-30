import { lazy, Suspense, type ComponentProps } from "react";

// recharts is ~400 kB; keep it out of the route chunks until a chart is actually shown.
const ProgressChartImpl = lazy(() =>
  import("./ProgressChart").then((m) => ({ default: m.ProgressChart })),
);

export function ProgressChart(props: ComponentProps<typeof ProgressChartImpl>) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-navy/5" aria-hidden />}>
      <ProgressChartImpl {...props} />
    </Suspense>
  );
}
