import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { getAttuneSources, type AttuneSource } from "@/api/attune";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/attune-sources")({
  head: () => ({ meta: [{ title: "Attune source register — Play Hub" }] }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]}>
      <AttuneSourcesPage />
    </Protected>
  ),
});

const STATUS_STYLE: Record<AttuneSource["status"], string> = {
  loaded: "bg-blue/12 text-blue",
  cited: "bg-[#d6f0e1] text-[#146334]",
  background: "bg-navy/8 text-navy/70",
  proposed: "bg-amber/25 text-[#9b6208]",
};

function AttuneSourcesPage() {
  const register = useQuery({ queryKey: ["attune", "sources"], queryFn: getAttuneSources });
  return (
    <>
      <Link
        to="/admin"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Overview
      </Link>
      <PageHeader
        eyebrow="Attune™"
        title="Source register"
        description="Every resource that shapes Attune’s reasoning, with its status, evidence strength, limits and clinical review. Only sources cited in Attune’s instructions can appear in an answer’s references."
      />
      {register.isLoading ? (
        <ListSkeleton rows={5} />
      ) : register.isError || !register.data ? (
        <p className="ph-card p-6 text-sm text-navy/60">The source register couldn’t be loaded.</p>
      ) : (
        <>
          <p className="mb-3 text-xs font-bold tracking-[0.12em] text-navy/50 uppercase">
            Version {register.data.version} · {register.data.sources.length} sources
          </p>
          <ul className="grid gap-4 lg:grid-cols-2">
            {register.data.sources.map((source) => (
              <li key={source.id} className="ph-card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue/10 text-blue">
                    <BookOpenText className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base leading-snug font-bold">{source.reference}</h2>
                    <span
                      className={cn(
                        "mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        STATUS_STYLE[source.status],
                      )}
                    >
                      {source.statusLabel}
                    </span>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2.5 text-sm">
                  {(
                    [
                      ["Citation", source.citation],
                      ["Supports", source.supports],
                      ["Evidence strength", source.evidence],
                      ["Use limitations", source.limitations],
                      ["Copyright or licensing", source.licensing],
                      ["Clinical review", source.review],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-navy/80">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
