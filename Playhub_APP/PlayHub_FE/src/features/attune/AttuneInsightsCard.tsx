import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpenText, Lock, Share2, ShieldAlert, ThumbsUp } from "lucide-react";
import { getAttuneInsights } from "@/api/attune";
import { AttuneAvatar } from "./AttuneAvatar";

/** Platform-wide Attune usage for the admin overview. Counts only: chats stay private. */
export function AttuneInsightsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["attune", "insights"],
    queryFn: getAttuneInsights,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="ph-skeleton h-64" aria-label="Loading Attune insights" />;
  if (isError || !data) {
    return <p className="ph-card p-5 text-sm text-navy/60">Attune insights couldn’t be loaded.</p>;
  }

  const rated = data.ratedUp + data.ratedDown;
  const helpful = rated ? Math.round((data.ratedUp / rated) * 100) : null;
  const peak = Math.max(1, ...data.daily.map((d) => d.questions));
  const figures = [
    { label: "Questions today", value: data.questionsToday },
    { label: "Last 7 days", value: data.questions7Days },
    { label: "Last 30 days", value: data.questions30Days },
    { label: "People asking (30 days)", value: data.people30Days },
  ];

  return (
    <section className="ph-card p-5" aria-labelledby="attune-insights-heading">
      <div className="flex flex-wrap items-center gap-3">
        <AttuneAvatar className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h3 id="attune-insights-heading" className="text-base font-bold">
            Attune™ insights
          </h3>
          <p className="text-xs text-navy/55">
            How families and staff use the 24/7 Play Partner, across {data.children30Days}{" "}
            {data.children30Days === 1 ? "member" : "members"} this month.
          </p>
        </div>
        <Link
          to="/admin/attune-sources"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/35"
        >
          <BookOpenText className="h-4 w-4" aria-hidden /> Source register
        </Link>
        <Link
          to="/attune"
          className="inline-flex min-h-10 items-center rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/35"
        >
          Open Attune
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-2xl bg-navy/4 p-4">
            <dt className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">
              {figure.label}
            </dt>
            <dd className="mt-1 text-2xl font-bold">{figure.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-bold text-navy/60">Questions per day, last 14 days</p>
          <div
            className="mt-2 flex h-28 items-end gap-1.5"
            role="img"
            aria-label={`Questions per day: ${data.daily.map((d) => d.questions).join(", ")}`}
          >
            {data.daily.map((day) => (
              <div
                key={day.date}
                className="flex h-full flex-1 flex-col justify-end"
                title={`${day.date}: ${day.questions}`}
              >
                <div
                  className="rounded-t-md bg-gradient-to-t from-blue to-blue/60"
                  style={{
                    height: `${Math.max(4, (day.questions / peak) * 100)}%`,
                    opacity: day.questions ? 1 : 0.25,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-navy/45">
            <span>
              {data.daily[0]
                ? new Date(`${data.daily[0].date}T00:00:00`).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                  })
                : ""}
            </span>
            <span>Today</span>
          </div>
        </div>
        <div className="rounded-2xl border border-navy/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-navy/60">
            <ThumbsUp className="h-3.5 w-3.5 text-blue" aria-hidden /> Answers rated helpful
          </p>
          <p className="mt-1 text-2xl font-bold">{helpful === null ? "—" : `${helpful}%`}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy/8">
            <div className="h-full rounded-full bg-blue" style={{ width: `${helpful ?? 0}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-navy/50">
            {rated
              ? `${data.ratedUp} helpful · ${data.ratedDown} not helpful`
              : "No answers rated yet."}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-navy/8 pt-3 text-xs">
            <div>
              <dt className="flex items-center gap-1 font-bold text-navy/55">
                <ShieldAlert className="h-3.5 w-3.5 text-coral" aria-hidden /> Safety answers
              </dt>
              <dd className="mt-0.5 text-lg font-bold">{data.safety30Days}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 font-bold text-navy/55">
                <Share2 className="h-3.5 w-3.5 text-blue" aria-hidden /> Shared notes
              </dt>
              <dd className="mt-0.5 text-lg font-bold">{data.shared30Days}</dd>
            </div>
          </dl>
          <p className="mt-1 text-[10px] text-navy/45">Last 30 days, for clinical review.</p>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-navy/50">
        <Lock className="h-3 w-3" aria-hidden /> Counts only. Chats stay private to the people who
        wrote them.
      </p>
    </section>
  );
}
