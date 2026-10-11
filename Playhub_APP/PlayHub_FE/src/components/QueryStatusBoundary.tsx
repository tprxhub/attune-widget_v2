import { useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

/** Keep failed queries mounted so Retry can recover the same screen and selections. */
export function QueryStatusBoundary({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const failedQueries = () =>
    cache
      .getAll()
      .filter((query) => query.getObserversCount() > 0 && query.state.status === "error");
  useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () =>
      failedQueries()
        .map((query) => `${query.queryHash}:${query.state.errorUpdatedAt}`)
        .join("|"),
    () => "",
  );
  const failed = failedQueries();
  const unavailable = failed.some((query) => query.state.data === undefined);
  return (
    <>
      {failed.length > 0 && (
        <section role="alert" className="ph-card mb-5 border border-coral/20 p-5">
          <h2 className="text-lg font-bold">
            {unavailable ? "We couldn't load this page" : "Some information couldn't be refreshed"}
          </h2>
          <p className="mt-2 text-sm text-navy/70">
            {unavailable
              ? "Please try again to load the latest information."
              : "The information below is from your last successful load. Try again to update it."}
          </p>
          <button
            type="button"
            onClick={() => {
              void Promise.all(
                failed.map((query) =>
                  client.refetchQueries({ queryKey: query.queryKey, exact: true }),
                ),
              );
            }}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </section>
      )}
      <div hidden={unavailable}>{children}</div>
    </>
  );
}
