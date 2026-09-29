import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Flame,
  History,
  Lock,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { listAttempts, logAttempt } from "@/api/attempts";
import { listGoals, listPlans } from "@/api/plans";
import { getProgress } from "@/api/progress";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { AttemptScore } from "@/components/AttemptScore";
import { Select } from "@/components/Select";
import { ReflectionForm, type ReflectionValues } from "@/features/attempts/ReflectionForm";
import { useActiveChild } from "@/lib/active-child";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/check-in")({
  head: () => ({
    meta: [
      { title: "Daily Check-In — Play Hub" },
      {
        name: "description",
        content:
          "Log a Play Dose session — today or a past date — and keep the Attempt record complete.",
      },
      { property: "og:title", content: "Daily Check-In — Play Hub" },
      {
        property: "og:description",
        content: "Log a Play Dose session, including past dates.",
      },
    ],
  }),
  component: () => (
    <Protected>
      <CheckInPage />
    </Protected>
  ),
});

function CheckInPage() {
  const { session } = useSession();
  const {
    canLogAttempts,
    canLeaveConsultNotes,
    isFreeGated,
    canManageSubscription,
    isReadOnlyParent,
  } = useCapabilities();
  const { activeChild } = useActiveChild();
  const queryClient = useQueryClient();
  const [playPlanId, setPlayPlanId] = useState<string>("");
  const [doseId, setDoseId] = useState<string>("");
  const [entryId, setEntryId] = useState<string>("");
  const [done, setDone] = useState(false);
  const [doseOpen, setDoseOpen] = useState(false);

  useEffect(() => {
    setPlayPlanId("");
    setDoseId("");
    setEntryId("");
    setDone(false);
  }, [activeChild?.id]);

  const attempts = useQuery({
    queryKey: ["attempts", activeChild?.id],
    queryFn: () => listAttempts(activeChild!.id),
    enabled: !!activeChild,
  });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const progress = useQuery({
    queryKey: ["progress", activeChild?.id],
    queryFn: () => getProgress(activeChild!.id),
    enabled: Boolean(activeChild),
  });

  const allDoses = plans.data ?? [];
  const currentDose = allDoses.find((dose) => dose.id === activeChild?.currentPlanId);
  const availablePlanIds = new Set(allDoses.map((dose) => dose.goalId));
  const playPlans = (goals.data ?? []).filter((goal) => availablePlanIds.has(goal.id));
  const selectedPlayPlanId = availablePlanIds.has(playPlanId)
    ? playPlanId
    : (currentDose?.goalId ?? playPlans[0]?.id ?? "");
  const doses = allDoses.filter((dose) => dose.goalId === selectedPlayPlanId);
  const selectedDose = doses.find((dose) => dose.id === doseId)
    ? doses.find((dose) => dose.id === doseId)
    : currentDose?.goalId === selectedPlayPlanId
      ? currentDose
      : doses[0];
  const loggable = selectedDose?.entries.filter((entry) => entry.loggable) ?? [];
  const chosen = loggable.some((entry) => entry.id === entryId) ? entryId : (loggable[0]?.id ?? "");
  const logged = attempts.data ?? [];
  const loggedEntryIds = new Set(logged.map((a) => a.entryId));

  const mutation = useMutation({
    mutationFn: (values: ReflectionValues) =>
      logAttempt({
        childId: activeChild!.id,
        planId: selectedDose!.id,
        entryId: chosen,
        date: values.date,
        completion: values.completion,
        completionStatus: values.completionStatus,
        helpLevel: values.helpLevel,
        mood: values.mood,
        bigWin: values.bigWin,
        consultNotes: values.consultNotes,
        source: "daily_check_in",
        loggedBy: session.name,
      }),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["attempts", activeChild?.id] });
      queryClient.invalidateQueries({ queryKey: ["progress", activeChild?.id] });
    },
  });

  if (!activeChild) {
    return (
      <>
        <PageHeader eyebrow="Attempt logging" title="Daily Check-In" />
        <div className="ph-card p-8 text-center">
          <p className="text-lg font-bold">No child is available</p>
          <p className="mt-2 text-sm text-navy/65">Enrol a child before logging an Attempt.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Attempt logging"
        title="Daily Check-In"
        description="Record a Play Dose session here — today or a past date. Nothing is ever overwritten."
      />

      {!canLogAttempts ? (
        <div className="ph-card mx-auto max-w-md p-8 text-center">
          <span
            className="mx-auto grid h-14 w-14 place-items-center bg-navy text-cream"
            style={{ borderRadius: "9999px" }}
          >
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-bold">
            {isReadOnlyParent ? "Read-only access" : "Logging is locked on the free plan"}
          </p>
          <p className="mt-2 text-sm text-navy/70">
            {isReadOnlyParent
              ? "Your child's organisation Admin records the attempts. You'll see every one of them in Progress."
              : "Subscribe for this child to log Attempts and keep a full history."}
          </p>
          {isFreeGated && canManageSubscription && (
            <Link
              to="/subscription"
              search={{ checkout: undefined }}
              className="mt-5 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
            >
              Upgrade to unlock
            </Link>
          )}
        </div>
      ) : plans.isLoading || goals.isLoading ? (
        <CardSkeleton lines={5} />
      ) : !selectedDose || !chosen ? (
        <div className="ph-card p-8 text-center">
          <p className="text-lg font-bold">No loggable Activity is assigned</p>
          <p className="mt-2 text-sm text-navy/65">
            Ask an Admin to assign an active Play Dose containing at least one loggable Activity.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            {/* Who are we logging for */}
            <section className="ph-card p-5">
              <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
                <CalendarCheck className="h-4 w-4" aria-hidden /> Who are we logging for?
              </p>
              <p className="mt-3 border-t border-navy/8 pt-3 text-sm text-navy/60">
                Logging an Attempt for{" "}
                <span className="font-bold text-navy">{activeChild.name}</span>
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="checkin-play-plan" className="text-sm font-bold text-navy">
                    Play Plan
                  </label>
                  <Select
                    id="checkin-play-plan"
                    value={selectedPlayPlanId}
                    onChange={(nextPlanId) => {
                      const firstDose = allDoses.find((dose) => dose.goalId === nextPlanId);
                      setPlayPlanId(nextPlanId);
                      setDoseId(firstDose?.id ?? "");
                      setEntryId("");
                      setDone(false);
                    }}
                    options={playPlans.map((playPlan) => ({
                      value: playPlan.id,
                      label: playPlan.name,
                    }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label htmlFor="checkin-play-dose" className="text-sm font-bold text-navy">
                    Play Dose
                  </label>
                  <Select
                    id="checkin-play-dose"
                    value={selectedDose.id}
                    onChange={(nextDoseId) => {
                      setDoseId(nextDoseId);
                      setEntryId("");
                      setDone(false);
                    }}
                    options={doses.map((dose) => ({
                      value: dose.id,
                      label: `${dose.title} · ${dose.level}`,
                    }))}
                    className="mt-2"
                  />
                </div>
              </div>
              {currentDose && currentDose.id !== selectedDose.id && (
                <p className="mt-3 rounded-xl bg-blue/8 px-3 py-2 text-xs text-navy/65">
                  Assigned dose: <span className="font-bold text-navy">{currentDose.title}</span>.
                  This check-in will be saved against the selected dose above.
                </p>
              )}
            </section>

            {done && (
              <p
                role="status"
                className="ph-rise flex items-center gap-2 rounded-2xl bg-blue/10 px-4 py-3 text-sm font-bold text-blue"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                Attempt saved to {activeChild?.name}'s history.
              </p>
            )}

            {/* Step 1 — pick the Play Dose */}
            <section className="ph-card p-5">
              <button
                type="button"
                onClick={() => setDoseOpen((v) => !v)}
                aria-expanded={doseOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
              >
                <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
                  <span
                    className="grid h-5 w-5 place-items-center bg-navy text-[10px] text-cream"
                    style={{ borderRadius: "9999px" }}
                  >
                    1
                  </span>
                  Which Activity was it?
                </p>
                <span className="flex items-center gap-2 text-xs font-bold text-navy/70">
                  {chosen ? (loggable.find((e) => e.id === chosen)?.title ?? "Selected") : "Choose"}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-navy/50 transition-transform duration-200",
                      doseOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </span>
              </button>
              {doseOpen && (
                <ul className="mt-3 divide-y divide-navy/8 border-y border-navy/8">
                  {loggable.map((e) => {
                    const active = chosen === e.id;
                    const isRedo = e.kind === "redo";
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setEntryId(e.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex w-full items-center gap-3 px-2 py-3 text-left transition-colors",
                            active ? "bg-navy/4" : "hover:bg-navy/3",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-4 w-4 shrink-0 place-items-center border-2 transition-colors",
                              active ? "border-navy bg-navy" : "border-navy/25",
                            )}
                            style={{ borderRadius: "9999px" }}
                            aria-hidden
                          >
                            {active && (
                              <span
                                className="h-1.5 w-1.5 bg-cream"
                                style={{ borderRadius: "9999px" }}
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-navy">
                              {e.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-navy/50">
                              {isRedo && <Repeat2 className="h-3.5 w-3.5" aria-hidden />}
                              {e.label}
                            </span>
                          </span>
                          {loggedEntryIds.has(e.id) && (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-blue">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Logged
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Step 2 — the reflection */}
            <section className="ph-card p-5">
              <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
                <span
                  className="grid h-5 w-5 place-items-center bg-navy text-[10px] text-cream"
                  style={{ borderRadius: "9999px" }}
                >
                  2
                </span>
                How did it go?
              </p>
              <div className="mt-4">
                <ReflectionForm
                  showDate
                  showConsultNotes={canLeaveConsultNotes}
                  pending={mutation.isPending}
                  submitLabel="Log this Attempt"
                  onSubmit={async (values) => {
                    await mutation.mutateAsync(values);
                  }}
                />
                {mutation.isError && (
                  <p role="alert" className="mt-3 text-sm font-semibold text-coral">
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : "That Attempt could not be saved."}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Right rail */}
          <div className="space-y-4 lg:sticky lg:top-4">
            <section className="grid grid-cols-2 gap-3">
              <div className="ph-card p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
                  <Flame className="h-3.5 w-3.5 text-coral" aria-hidden /> Attempts
                </p>
                <p className="mt-1 text-3xl font-bold text-coral">{logged.length}</p>
              </div>
              <div className="ph-card p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-blue" aria-hidden /> Support Score
                </p>
                <p className="mt-1 text-2xl font-bold text-blue">
                  {progress.data?.supportScore ?? "—"}
                  {progress.data?.supportScore !== null && progress.data?.supportScore !== undefined
                    ? "/100"
                    : ""}
                </p>
              </div>
            </section>

            <section className="ph-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <History className="h-5 w-5 text-navy/50" aria-hidden /> Recent Attempts
              </h2>
              {attempts.isLoading ? (
                <div className="mt-4">
                  <CardSkeleton lines={3} />
                </div>
              ) : logged.length === 0 ? (
                <p className="mt-4 text-sm text-navy/65">
                  Nothing logged for {activeChild?.name} yet.
                </p>
              ) : (
                <ol className="mt-4 space-y-2 border-l-2 border-navy/8 pl-4">
                  {[...logged]
                    .sort(
                      (a, b) =>
                        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
                    )
                    .slice(0, 8)
                    .map((a) => (
                      <li
                        key={a.id}
                        className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-navy/4 p-3"
                      >
                        <span
                          className="absolute top-1/2 -left-[21px] h-2.5 w-2.5 -translate-y-1/2 bg-blue"
                          style={{ borderRadius: "9999px" }}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{a.activity}</span>
                          <span className="block truncate text-[11px] text-navy/55">
                            {fmtDate(a.date)} ·{" "}
                            {a.source === "daily_check_in" ? "Daily Check-In" : "In activity"}
                          </span>
                        </span>
                        <AttemptScore
                          completion={a.completion}
                          mood={a.mood}
                          completionStatus={a.completionStatus}
                          helpLevel={a.helpLevel}
                        />
                      </li>
                    ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
