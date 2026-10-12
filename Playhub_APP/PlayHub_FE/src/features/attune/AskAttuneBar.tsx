import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { AttuneAvatar } from "./AttuneAvatar";
import { getAttuneStatus } from "@/api/attune";
import { cn } from "@/lib/utils";

/**
 * The way into Attune from the dashboard: a question box and a few one-tap questions, each opening
 * Ask Attune with the question already on its way. Hidden while Attune is switched off.
 */
export function AskAttuneBar({ childName, className }: { childName?: string; className?: string }) {
  // Optional on the dashboard: if Attune can't be reached the bar just stays hidden, rather than
  // the page showing a "couldn't load" error.
  const status = useQuery({
    queryKey: ["attune", "status", "dashboard"],
    queryFn: () => getAttuneStatus().catch(() => null),
    staleTime: 60_000,
  });
  if (!status.data?.enabled) return null;
  const child = childName ?? "my child";
  const quick = [
    { label: "Ideas for today", q: `Give me a quick play idea to do with ${child} today.` },
    {
      label: "A tricky Session",
      q: `Sessions with ${child} have been hard lately. What can I change?`,
    },
    { label: "How it's going", q: `Explain how ${child}'s recent Sessions are going.` },
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
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Ask Attune™</h2>
          <p className="text-sm text-cream/70">
            Your AI play coach knows {childName ? `${childName}’s` : "your child’s"} Play Plan and
            recent Sessions.
          </p>
        </div>
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
            key={item.label}
            to="/attune"
            search={{ q: item.q }}
            className="ph-pill inline-flex min-h-9 items-center border border-cream/20 px-3.5 text-xs font-bold text-cream transition hover:bg-cream/10"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
