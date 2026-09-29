import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronDown, Lock, PlayCircle, Sparkles } from "lucide-react";
import { listAttempts, logAttempt } from "@/api/attempts";
import { goalById, planByGoalAndLevel, planById } from "@/api/domain";
import { entryActivities, entryStates, getPlan, type EntryState } from "@/api/plans";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { LockedOverlay } from "@/components/LockedOverlay";
import { LevelDots, TOKEN_SOFT } from "@/components/brand";
import { AttemptScore } from "@/components/AttemptScore";
import { ReflectionForm, type ReflectionValues } from "@/features/attempts/ReflectionForm";
import { useActiveChild } from "@/lib/active-child";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

type VideoSource = { kind: "file" | "embed"; src: string };

/** Turn a stored video link into something we can render inline. */
function videoSourceOf(url?: string): VideoSource | null {
  const raw = url?.trim();
  if (!raw) return null;
  const yt = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
  if (yt) return { kind: "embed", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/^(blob:|data:video\/)|\.(mp4|webm|ogg|mov)(\?|$)/i.test(raw)) {
    return { kind: "file", src: raw };
  }
  return { kind: "embed", src: raw };
}

export const Route = createFileRoute("/plans/$planId/$entryId")({
  head: ({ params }) => {
    const plan = planById(params.planId);
    const entry = plan?.entries.find((e) => e.id === params.entryId);
    const title = entry ? `${entry.title} — Play Hub` : "Play Dose — Play Hub";
    const description =
      entry?.activity ?? "A single Play Dose with video, instructions and a reflection.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: () => (
    <Protected>
      <PlayDosePage />
    </Protected>
  ),
});

function PlayDosePage() {
  const { planId, entryId } = Route.useParams();
  const { session } = useSession();
  const {
    canLogAttempts,
    isFreeGated,
    canManageSubscription,
    canLeaveConsultNotes,
    isReadOnlyParent,
  } = useCapabilities();
  const { activeChild } = useActiveChild();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [attuneOpen, setAttuneOpen] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  const planQuery = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => getPlan(planId),
  });
  const plan = planQuery.data ?? planById(planId);
  const entry = plan?.entries.find((e) => e.id === entryId);

  const attempts = useQuery({
    queryKey: ["attempts", activeChild?.id],
    queryFn: () => listAttempts(activeChild!.id),
    enabled: !!activeChild,
  });

  const mutation = useMutation({
    mutationFn: (values: ReflectionValues) =>
      logAttempt({
        childId: activeChild!.id,
        planId,
        entryId,
        date: values.date,
        completion: values.completion,
        completionStatus: values.completionStatus,
        helpLevel: values.helpLevel,
        mood: values.mood,
        bigWin: values.bigWin,
        consultNotes: values.consultNotes,
        source: "play_dose",
        loggedBy: session.name,
      }),
    onSuccess: () => {
      setJustLogged(true);
      queryClient.invalidateQueries({ queryKey: ["attempts", activeChild?.id] });
      queryClient.invalidateQueries({ queryKey: ["progress", activeChild?.id] });
    },
  });

  if (planQuery.isLoading && !plan) return <CardSkeleton lines={6} />;
  if (!plan || !entry)
    return <p className="ph-card p-8 text-center">That Play Dose doesn't exist.</p>;

  const goal = goalById(plan.goalId);
  // Every Activity configured inside the Play Dose is available to the learner.
  const activities = entryActivities(entry);
  const startedAt =
    activeChild && activeChild.currentPlanId === plan.id
      ? activeChild.planStartedAt
      : new Date().toISOString().slice(0, 10);
  const states = entryStates(plan, session, startedAt);
  const state = states.find((s) => s.entry.id === entryId);
  const entitled = state?.entitled ?? true;
  const entryAttempts = (attempts.data ?? []).filter((a) => a.entryId === entryId);
  const weekAttempts = (attempts.data ?? []).filter((a) => a.planId === plan.id);
  const loggedEntryIds = [
    ...new Set((attempts.data ?? []).filter((a) => a.planId === plan.id).map((a) => a.entryId)),
  ];

  if (entry.kind === "levelup") {
    return (
      <>
        <BackLink planId={planId} />
        <PageHeader eyebrow={plan.title} title={entry.title} description={entry.activity} />
        <div className="ph-card grid gap-5 p-6 lg:grid-cols-3">
          {(["Rookie", "Starter", "Pro"] as const).map((level) => (
            <Link
              key={level}
              to="/plans/$planId"
              params={{ planId: planByGoalAndLevel(plan.goalId, level)?.id ?? plan.id }}
              className={cn(
                "rounded-2xl border-2 p-5 transition-transform hover:-translate-y-0.5",
                level === plan.level ? "border-blue bg-blue/6" : "border-navy/12",
              )}
            >
              <LevelDots level={level} />
              <p className="mt-2 text-sm text-navy/70">
                {level === plan.level
                  ? "Repeat this week at the same level."
                  : `Move to the ${level} version of this Play Plan.`}
              </p>
              <span className="mt-4 inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-bold text-white">
                Start
              </span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink planId={planId} />
      <PageHeader
        eyebrow={`${plan.title} · ${entry.label}`}
        title={entry.title}
        description={entry.activity}
        actions={<LevelDots level={plan.level} />}
      />

      <div className="grid gap-5 xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start">
        <DoseRail
          planId={planId}
          currentId={entryId}
          states={states}
          loggedEntryIds={loggedEntryIds}
        />

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-5">
            {entry.isRealLifeTry && (
              <section className="ph-card border-blue/20 bg-blue/5 p-5">
                <p className="eyebrow text-blue">Before the Real-Life Try</p>
                <h2 className="mt-1 text-lg font-bold">This week so far</h2>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xl font-bold">
                      {weekAttempts.filter((a) => !a.isRealLifeTry).length}/5
                    </p>
                    <p className="text-[11px] text-navy/55">Kit sessions</p>
                  </div>
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xl font-bold">
                      {weekAttempts.filter((a) => a.completionStatus === "finished").length}
                    </p>
                    <p className="text-[11px] text-navy/55">Finished</p>
                  </div>
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xl font-bold">
                      {weekAttempts.length
                        ? (
                            weekAttempts.reduce((sum, a) => sum + a.mood, 0) / weekAttempts.length
                          ).toFixed(1)
                        : "—"}
                    </p>
                    <p className="text-[11px] text-navy/55">Average mood</p>
                  </div>
                </div>
                {plan.safetyNote && (
                  <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-xs font-bold text-coral">
                    Safety: {plan.safetyNote}
                  </p>
                )}
              </section>
            )}
            {activities.map((act, ai) => {
              const source = videoSourceOf(act.videoUrl);
              const showVideo = entry.kind !== "redo";
              return (
                <LockedOverlay key={act.id} locked={!entitled}>
                  <section className="ph-card overflow-hidden">
                    {showVideo && (
                      <div className="relative grid aspect-video place-items-center bg-navy">
                        {source?.kind === "file" ? (
                          <video
                            controls
                            controlsList="nodownload"
                            playsInline
                            preload="metadata"
                            src={source.src}
                            aria-label={act.videoLabel || act.name}
                            className="h-full w-full"
                            onContextMenu={(event) => event.preventDefault()}
                          />
                        ) : source?.kind === "embed" ? (
                          <iframe
                            src={source.src}
                            title={act.videoLabel || act.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full border-0"
                          />
                        ) : (
                          <>
                            <div className="grid h-16 w-16 place-items-center rounded-full bg-amber text-navy">
                              <PlayCircle className="h-8 w-8" aria-hidden />
                            </div>
                            <span className="absolute bottom-3 left-4 text-xs font-bold text-white/80">
                              {act.videoLabel || act.name} · video coming soon
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="p-5">
                      {activities.length > 1 && (
                        <p className="eyebrow text-coral">Activity {ai + 1}</p>
                      )}
                      <h2 className="mt-0.5 text-lg font-bold">{act.name || "The Activity"}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-navy/60">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1",
                            TOKEN_SOFT[goal?.color ?? "navy"],
                          )}
                        >
                          {goal?.short}
                        </span>
                        <span>{plan.kit}</span>
                      </div>

                      <ol className="mt-4 space-y-2.5">
                        {act.instructions.map((step, i) => (
                          <li key={step} className="flex gap-3">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="min-w-0 text-sm text-navy/80">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </section>
                </LockedOverlay>
              );
            })}

            {/* Attune */}
            <section className="ph-card p-5">
              <div className="rounded-2xl border border-blue/25 bg-blue/5 p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue">Ask Attune™</p>
                    <p className="text-xs text-navy/65">
                      Your AI play coach — adapts the activity in the moment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttuneOpen((v) => !v)}
                    aria-expanded={attuneOpen}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-blue/40 px-4 text-sm font-bold text-blue"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden /> Ask Attune™
                  </button>
                </div>
                {attuneOpen && (
                  <p className="mt-3 rounded-xl bg-card px-3 py-2 text-sm font-semibold text-navy/70">
                    Attune™ is coming soon. Until then, your Play Consult Notes go straight to your
                    organisation Admin.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Reflection */}
          <section className="ph-card p-5 lg:sticky lg:top-24">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-coral">Daily Check-In</p>
                <h2 className="mt-0.5 text-lg font-bold">How did it go?</h2>
              </div>
              {activeChild && (
                <span className="shrink-0 rounded-full bg-navy/8 px-3 py-1 text-xs font-bold">
                  {activeChild.name}
                </span>
              )}
            </div>

            <div className="mt-3"></div>

            {justLogged && (
              <p
                role="status"
                className="mt-4 rounded-2xl bg-blue/10 px-4 py-3 text-sm font-bold text-blue"
              >
                Attempt logged. Nothing is overwritten — log again any time.
              </p>
            )}

            {!entry.loggable ? (
              <p className="mt-4 rounded-2xl bg-navy/5 p-4 text-sm text-navy/70">
                The Introduction isn't logged. Watch it, then start Play Dose #1.
              </p>
            ) : isReadOnlyParent ? (
              <p className="mt-4 rounded-2xl bg-navy/5 p-4 text-sm text-navy/70">
                You have a read-only view. Your child's organisation Admin logs the attempts.
              </p>
            ) : !canLogAttempts ? (
              <div className="mt-4 rounded-2xl bg-navy/5 p-4 text-center">
                <Lock className="mx-auto h-5 w-5 text-navy/60" aria-hidden />
                <p className="mt-2 text-sm font-bold">Logging is locked on the free plan</p>
                <p className="mt-1 text-xs text-navy/65">
                  Subscribe for this child to log Attempts, track support and record Parent wins.
                </p>
                {isFreeGated && canManageSubscription && (
                  <Link
                    to="/subscription"
                    search={{ checkout: undefined }}
                    className="mt-4 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
                  >
                    Upgrade to unlock
                  </Link>
                )}
              </div>
            ) : !activeChild ? (
              <p className="mt-4 text-sm text-navy/70">Add a child before logging an Attempt.</p>
            ) : (
              <div className="mt-4">
                <ReflectionForm
                  onSubmit={async (values) => {
                    await mutation.mutateAsync(values);
                  }}
                  showConsultNotes={canLeaveConsultNotes}
                  pending={mutation.isPending}
                  submitLabel="Log this Attempt"
                />
                {mutation.isError && (
                  <p role="alert" className="mt-3 text-sm font-semibold text-coral">
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : "That didn't save. Try again."}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate({ to: "/check-in" })}
                  className="mt-4 text-sm font-bold text-blue hover:underline"
                >
                  Logging an older session? Use Daily Check-In with a past date
                </button>
              </div>
            )}

            {entryAttempts.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold">Previous Attempts at this Play Dose</h3>
                <ul className="mt-2 space-y-2">
                  {entryAttempts.map((a) => (
                    <li
                      key={a.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-navy/4 p-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{a.bigWin}</span>
                        <span className="block text-[11px] text-navy/55">
                          {fmtDate(a.date)} · {a.loggedBy}
                        </span>
                      </span>
                      <AttemptScore completion={a.completion} mood={a.mood} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {attempts.isLoading && (
              <div className="mt-4">
                <CardSkeleton lines={2} />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function DoseRail({
  planId,
  currentId,
  states,
  loggedEntryIds,
}: {
  planId: string;
  currentId: string;
  states: EntryState[];
  loggedEntryIds: string[];
}) {
  const [blocked, setBlocked] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav aria-label="Play Doses in this Play Plan" className="ph-card p-3 xl:sticky xl:top-24">
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left xl:hidden"
      >
        <span>
          <span className="block text-xs font-bold tracking-wide text-navy/55 uppercase">
            Activities this week
          </span>
          <span className="mt-0.5 block text-xs text-navy/55">
            {states.length} activities · tap to {mobileOpen ? "hide" : "view"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-navy/60 transition-transform",
            mobileOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <p className="hidden px-2 pb-2 text-xs font-bold tracking-wide text-navy/55 uppercase xl:block">
        Activities this week
      </p>
      <ul className={cn("mt-2 space-y-1", !mobileOpen && "hidden", "xl:mt-0 xl:block")}>
        {states.map(({ entry, entitled }) => {
          const open = entitled;
          const active = entry.id === currentId;
          const logged = loggedEntryIds.includes(entry.id);
          const reason = "Locked on the free plan — subscribe for this child to unlock it.";

          const inner = (
            <>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/8 text-[11px] font-bold">
                {logged ? (
                  <CheckCircle2 className="h-4 w-4 text-blue" aria-hidden />
                ) : open ? (
                  entry.day
                ) : (
                  <Lock className="h-3.5 w-3.5 text-navy/55" aria-hidden />
                )}
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm leading-snug font-bold">{entry.title}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[11px]",
                    active ? "text-white/70" : "text-navy/55",
                  )}
                >
                  {entry.label}
                </span>
              </span>
            </>
          );

          const base = cn(
            "flex w-full min-h-11 items-center gap-2.5 rounded-2xl px-2 py-2 transition-colors",
            active ? "bg-navy text-white" : "hover:bg-navy/6",
            !open && !active && "opacity-70",
          );

          return (
            <li key={entry.id}>
              {open ? (
                <Link
                  to="/plans/$planId/$entryId"
                  params={{ planId, entryId: entry.id }}
                  onClick={() => setBlocked(null)}
                  aria-current={active ? "page" : undefined}
                  className={base}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setBlocked(blocked === entry.id ? null : entry.id)}
                  className={base}
                >
                  {inner}
                </button>
              )}
              {blocked === entry.id && !open && (
                <p
                  role="status"
                  className="mt-1 rounded-xl bg-amber/15 px-3 py-2 text-[11px] leading-snug font-semibold text-navy/75"
                >
                  {reason}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BackLink({ planId }: { planId: string }) {
  return (
    <Link
      to="/plans/$planId"
      params={{ planId }}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-navy/65 hover:text-navy"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the Play Plan week
    </Link>
  );
}
