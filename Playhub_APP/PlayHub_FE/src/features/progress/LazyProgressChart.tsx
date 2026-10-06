import { lazy, Suspense, type ComponentProps } from "react";

const PlayProgressImpl = lazy(() =>
  import("./PlayProgress").then((m) => ({ default: m.PlayProgress })),
);

/** Same props as `PlayProgress`; loaded only when a chart is shown. */
export function ProgressChart(props: ComponentProps<typeof PlayProgressImpl>) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-navy/5" aria-hidden />}>
      <PlayProgressImpl {...props} />
    </Suspense>
  );
}
