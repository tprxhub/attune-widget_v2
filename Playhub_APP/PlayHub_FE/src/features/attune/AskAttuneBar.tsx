import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Lock } from "lucide-react";
import { AttuneAvatar } from "./AttuneAvatar";
import {
  attuneModeLabel,
  getAttuneResetDelay,
  getAttuneStatus,
  type AttuneMode,
} from "@/api/attune";
import { useCapabilities } from "@/auth/session";
import { cn } from "@/lib/utils";

/**
 * The way into Attune from the dashboard: a question box and a few one-tap questions, each opening
 * Ask Attune with the question already on its way. Hidden while Attune is switched off.
 */
export function AskAttuneBar({ childName, className }: { childName?: string; className?: string }) {
  // Optional on the dashboard: if Attune can't be reached the bar just stays hidden, rather than
  // the page showing a "couldn't load" error.
  const status = useDashboardAttuneStatus();
  if (!status.data?.enabled) return null;
  if (status.data.freePlan) return <AttuneUpgradeCard className={className} />;
  const child = childName ?? "my member";
  // The three moments Attune is built for (Product Reasoning Blueprint): each opens Attune in that mode.
  const quick: { mode: AttuneMode; q?: string }[] = [
    { mode: "idea", q: `Give me one play idea for ${child} today from the Play Plan.` },
    { mode: "regulation" },
    { mode: "progress", q: `What does ${child}’s recent progress mean?` },
  ];
  return (
    <section
      aria-label="Ask Attune"
      className={cn("ph-card relative overflow-hidden bg-navy p-5 text-cream sm:p-6", className)}
    >
      <span
        aria-hidden
        className="ph-pill pointer-events-none absolute -top-16 -right-10 h-48 w-48 bg-amber/20 blur-3xl"
      />
      <div className="relative flex items-center gap-3">
        <AttuneAvatar className="h-12 w-12 ring-2 ring-amber/60" />
        <h2 className="min-w-0 text-lg font-bold">Ask Attune™</h2>
      </div>
      <Link
        to="/attune"
        className="ph-r-2xl relative mt-4 flex min-h-12 items-center gap-3 bg-card py-2 pr-2 pl-4 text-sm text-navy/50 transition hover:shadow-[var(--shadow-lift)]"
      >
        <span className="min-w-0 flex-1 truncate">Ask anything about {child}’s play…</span>
        <span className="ph-pill grid h-9 w-9 shrink-0 place-items-center bg-coral text-white">
          <ArrowUp className="h-4 w-4" aria-hidden />
        </span>
      </Link>
      <div className="relative mt-3 flex flex-wrap gap-2">
        {quick.map((item) => (
          <Link
            key={item.mode}
            to="/attune"
            search={item.q ? { mode: item.mode, q: item.q } : { mode: item.mode }}
            className="ph-pill inline-flex min-h-9 items-center border border-cream/20 px-3.5 text-xs font-bold text-cream transition hover:bg-cream/10"
          >
            {attuneModeLabel(item.mode, status.data)}
          </Link>
        ))}
      </div>
    </section>
  );
}

function useDashboardAttuneStatus() {
  return useQuery({
    queryKey: ["attune", "status", "dashboard"],
    queryFn: () => getAttuneStatus().catch(() => null),
    staleTime: 60_000,
    refetchInterval: () => getAttuneResetDelay(),
  });
}

function AttuneUpgradeCard({ className }: { className: string | undefined }) {
  const { canManageSubscription } = useCapabilities();
  return (
    <section
      aria-label="Attune locked"
      className={cn(
        "ph-card flex flex-wrap items-center gap-4 bg-navy p-5 text-cream sm:p-6",
        className,
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber text-navy">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold">Attune is part of a paid plan</h2>
        <p className="text-sm text-cream/70">Upgrade to ask up to 30 questions per day.</p>
      </div>
      {canManageSubscription && (
        <Link
          to="/subscription"
          search={{ checkout: undefined }}
          className="ph-pill inline-flex min-h-10 items-center bg-coral px-4 text-sm font-bold text-white"
        >
          View plans
        </Link>
      )}
    </section>
  );
}
