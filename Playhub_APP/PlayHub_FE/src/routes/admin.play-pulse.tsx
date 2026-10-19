import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FilterX,
  HeartPulse,
  Loader2,
  Search,
} from "lucide-react";
import {
  exportPlayPulseResults,
  listPlayPulseResults,
  type PulseFilters,
  type PulseResultRow,
  type PulseSource,
} from "@/api/playPulse";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { AGE_BANDS, DOMAINS, PLAY_PULSE_GOALS } from "@/features/play-pulse/data";
import { TIER_COPY, type DomainTier, type ScoreTier } from "@/features/play-pulse/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/play-pulse")({
  head: () => ({ meta: [{ title: "Play Pulse leads — Play Hub" }] }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <PlayPulseLeadsPage />
    </Protected>
  ),
});

const PAGE_SIZES = [10, 50, 100] as const;

const SOURCE_LABEL: Record<PulseSource, string> = {
  guest: "Guest",
  super_admin: "Super Admin",
  ttp_employee: "TTP Employee",
  admin: "Admin",
  moderator: "Moderator",
  member: "Member",
  deleted: "Deleted account",
};

const TIER_BADGE: Record<ScoreTier, string> = {
  ontrack: "bg-[#d6f0e1] text-[#146334]",
  practice: "bg-[#ffe0b0] text-[#9b6208]",
  help: "bg-[#fde7e4] text-[#a8291d]",
};

const DOMAIN_DOT: Record<DomainTier, string> = {
  ontrack: "bg-[#2f9a5a]",
  practice: "bg-[#e5a03a]",
  help: "bg-[#d2463a]",
  unknown: "bg-navy/15",
};

const AGE_LABEL = Object.fromEntries(AGE_BANDS.map((band) => [band.id, band.label]));

const control =
  "min-h-11 w-full rounded-xl border border-navy/15 bg-card px-3 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20";

function fmtWhen(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function PlayPulseLeadsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PulseFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  // Search as the person types, without a request for every key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        (current.q ?? "") === search.trim() ? current : { ...current, q: search.trim() },
      );
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const results = useQuery({
    queryKey: ["admin", "play-pulse", filters, page, pageSize],
    queryFn: () => listPlayPulseResults(filters, page, pageSize),
    placeholderData: keepPreviousData,
  });

  const setFilter = <K extends keyof PulseFilters>(key: K, value: PulseFilters[K] | "") => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const activeFilters = Object.values(filters).some(Boolean);
  const clearFilters = () => {
    setSearch("");
    setFilters({});
    setPage(1);
  };

  const data = results.data;
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Play Pulse leads"
        description="Everyone who finished a Play Pulse check: guests from the form, and signed-in people by account."
        actions={<ExportMenu filters={filters} filteredCount={data?.total} />}
      />

      <section className="ph-card p-4 sm:p-5" aria-label="Filters">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block min-w-0 flex-1 basis-72">
            <span className="sr-only">Search by name, email or phone</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-navy/45"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or phone"
              maxLength={120}
              className={cn(control, "pl-10")}
            />
          </label>
          <p className="text-sm font-semibold text-navy/60" aria-live="polite">
            {data
              ? `${data.total.toLocaleString()} ${data.total === 1 ? "result" : "results"}`
              : ""}
          </p>
          {(activeFilters || search) && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-blue hover:bg-blue/8"
            >
              <FilterX className="h-4 w-4" aria-hidden /> Clear filters
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FilterField label="Goal">
            <Select
              aria-label="Goal"
              value={filters.goalId ?? ""}
              onChange={(value) => setFilter("goalId", value)}
              options={[
                { value: "", label: "All goals" },
                ...PLAY_PULSE_GOALS.map((goal) => ({ value: goal.id, label: goal.name })),
              ]}
            />
          </FilterField>
          <FilterField label="Result">
            <Select
              aria-label="Result"
              value={filters.tier ?? ""}
              onChange={(value) => setFilter("tier", value as ScoreTier)}
              options={[
                { value: "", label: "All results" },
                ...(Object.keys(TIER_COPY) as ScoreTier[]).map((tier) => ({
                  value: tier,
                  label: TIER_COPY[tier].label,
                })),
              ]}
            />
          </FilterField>
          <FilterField label="Age">
            <Select
              aria-label="Age"
              value={filters.ageBand ?? ""}
              onChange={(value) => setFilter("ageBand", value as PulseFilters["ageBand"])}
              options={[
                { value: "", label: "All ages" },
                ...AGE_BANDS.map((band) => ({
                  value: band.id,
                  label: band.label,
                  description: band.range,
                })),
              ]}
            />
          </FilterField>
          <FilterField label="Taken by">
            <Select
              aria-label="Taken by"
              value={filters.source ?? ""}
              onChange={(value) => setFilter("source", value as PulseFilters["source"])}
              options={[
                { value: "", label: "Everyone" },
                { value: "guest", label: "Guests", description: "Filled in the form" },
                {
                  value: "account",
                  label: "Signed-in accounts",
                  description: "Shown with their role",
                },
              ]}
            />
          </FilterField>
          <FilterField label="From">
            <input
              type="date"
              aria-label="From"
              value={filters.dateFrom ?? ""}
              max={filters.dateTo || undefined}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
              className={control}
            />
          </FilterField>
          <FilterField label="To">
            <input
              type="date"
              aria-label="To"
              value={filters.dateTo ?? ""}
              min={filters.dateFrom || undefined}
              onChange={(event) => setFilter("dateTo", event.target.value)}
              className={control}
            />
          </FilterField>
        </div>
      </section>

      <section className="ph-card mt-4 overflow-hidden" aria-label="Play Pulse results">
        {results.isLoading ? (
          <div className="p-5">
            <CardSkeleton lines={6} />
          </div>
        ) : results.isError ? (
          <p role="alert" className="p-5 text-sm font-semibold text-coral">
            Couldn’t load Play Pulse results.{" "}
            <button type="button" onClick={() => results.refetch()} className="underline">
              Try again
            </button>
          </p>
        ) : !data?.items.length ? (
          <div className="grid place-items-center gap-2 p-10 text-center">
            <HeartPulse className="h-8 w-8 text-coral" aria-hidden />
            <p className="font-bold">
              {activeFilters ? "No results match these filters." : "No Play Pulse results yet."}
            </p>
            <p className="text-sm text-navy/60">
              {activeFilters
                ? "Try a different search or clear the filters."
                : "Finished checks appear here as soon as they’re taken."}
            </p>
          </div>
        ) : (
          <div
            // `relative` keeps the rows' screen-reader labels inside the scroller on narrow screens.
            className={cn(
              "relative overflow-x-auto",
              results.isFetching && "opacity-60 transition-opacity",
            )}
          >
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-navy/[0.04] text-[11px] font-bold tracking-wide text-navy/60 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Submitted
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Person
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Phone
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Child
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Goal
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Support Score
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Areas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/8">
                {data.items.map((row) => (
                  <ResultRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </section>
    </>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function ResultRow({ row }: { row: PulseResultRow }) {
  const when = fmtWhen(row.createdAt);
  return (
    <tr className="align-top transition-colors hover:bg-navy/[0.02]">
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="font-semibold">{when.day}</p>
        <p className="text-xs text-navy/55">{when.time}</p>
      </td>
      <td className="max-w-[240px] px-4 py-3">
        <p className="truncate font-bold">{row.name}</p>
        {row.email && (
          <a
            href={`mailto:${row.email}`}
            className="block truncate text-xs text-blue hover:underline"
          >
            {row.email}
          </a>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {row.phone ? (
          <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
            {row.phone}
          </a>
        ) : (
          <span className="text-navy/40">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
            row.source === "guest" ? "bg-amber/25 text-[#8a5a07]" : "bg-blue/10 text-blue",
          )}
        >
          {SOURCE_LABEL[row.source] ?? row.source}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold">{row.childName}</p>
        <p className="text-xs whitespace-nowrap text-navy/55">
          {AGE_LABEL[row.ageBand] ?? row.ageBand}
        </p>
      </td>
      <td className="max-w-[200px] px-4 py-3">
        <p className="font-semibold">{row.goalName}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-base font-bold">{row.supportScore}%</p>
        <span
          className={cn(
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase",
            TIER_BADGE[row.tier],
          )}
        >
          {TIER_COPY[row.tier].label}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold whitespace-nowrap">
          {row.areasOnTrack} of {row.areasAssessed} on track
        </p>
        <ul className="mt-1.5 flex gap-1.5" aria-label="Areas">
          {DOMAINS.map((domain) => {
            const tier = row.domainTiers[domain] ?? "unknown";
            const label = tier === "unknown" ? "Not yet assessed" : TIER_COPY[tier].label;
            return (
              <li key={domain} title={`${domain}: ${label}`}>
                <span className={cn("block h-2.5 w-2.5 rounded-full", DOMAIN_DOT[tier])} />
                <span className="sr-only">
                  {domain}: {label}
                </span>
              </li>
            );
          })}
        </ul>
      </td>
    </tr>
  );
}

function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: (typeof PAGE_SIZES)[number]) => void;
}) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  // First, last, and the pages around the current one; gaps become an ellipsis.
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const button =
    "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-navy/8 px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm text-navy/65">
        <span className="font-semibold">Rows per page</span>
        <div className="w-24">
          <Select
            id="pulse-page-size"
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(value) => onPageSize(Number(value) as (typeof PAGE_SIZES)[number])}
            options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
          />
        </div>
        <span className="ml-2">
          {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={cn(button, "hover:bg-navy/6")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        {numbers.map((n, index) => (
          <span key={n} className="flex items-center gap-1">
            {index > 0 && n - (numbers[index - 1] ?? n) > 1 && (
              <span className="px-1 text-navy/40" aria-hidden>
                …
              </span>
            )}
            <button
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? "page" : undefined}
              aria-label={`Page ${n}`}
              className={cn(button, n === page ? "bg-navy text-cream" : "hover:bg-navy/6")}
            >
              {n}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className={cn(button, "hover:bg-navy/6")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

function ExportMenu({
  filters,
  filteredCount,
}: {
  filters: PulseFilters;
  filteredCount: number | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"filtered" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const filtered = Object.values(filters).some(Boolean);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = async (scope: "filtered" | "all") => {
    setOpen(false);
    setBusy(scope);
    setError(null);
    try {
      await exportPlayPulseResults(scope, filters);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The export could not be prepared.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy !== null}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-cream transition hover:bg-navy/90 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {busy ? "Preparing CSV…" : "Export"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-navy/10 bg-card p-1.5 shadow-[var(--shadow-lift)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run("filtered")}
            className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-navy/5"
          >
            <span className="block text-sm font-bold">
              {filtered ? "Export filtered results" : "Export results"}
            </span>
            <span className="block text-xs text-navy/60">
              {filteredCount === undefined
                ? "Everything matching the current filters"
                : `${filteredCount.toLocaleString()} ${filteredCount === 1 ? "row" : "rows"}${filtered ? " matching the current filters" : ""}`}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run("all")}
            className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-navy/5"
          >
            <span className="block text-sm font-bold">Export everything</span>
            <span className="block text-xs text-navy/60">
              Every Play Pulse result, ignoring filters
            </span>
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="absolute right-0 mt-2 w-72 text-right text-xs font-semibold text-coral"
        >
          {error}
        </p>
      )}
    </div>
  );
}
