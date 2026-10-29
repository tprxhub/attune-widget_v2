import { SessionEditStamp } from "@/components/SessionEditStamp";
import { AttuneStruggleLink } from "@/features/attune/AttuneStruggleLink";
import { playPlanName } from "@/lib/planNames";
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
  Pencil,
  Repeat2,
  Gauge,
  Trash2,
} from "lucide-react";
import { correctAttempt, deleteAttempt, listAttempts, logAttempt } from "@/api/attempts";
import { listGoals, listPlans } from "@/api/plans";
import { getProgress } from "@/api/progress";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { AttemptScore } from "@/components/AttemptScore";
import { ParentWinNote } from "@/components/ParentWinNote";
import { SupportScoreInfo } from "@/components/SupportScoreInfo";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ModalPortal } from "@/components/ModalPortal";
import { Select } from "@/components/Select";
import { ReflectionForm, type ReflectionValues } from "@/features/attempts/ReflectionForm";
import { useActiveChild } from "@/lib/active-child";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import type { Attempt } from "@/lib/types";

export const Route = createFileRoute("/check-in")({
  head: () => ({
    meta: [
      { title: "Daily Check-In — Play Hub" },
      {
        name: "description",
        content:
          "Log a Play Dose session — today or a past date — and keep the Session record complete.",
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
        <PageHeader eyebrow="Session logging" title="Daily Check-In" />
        <div className="ph-card p-8 text-center">
          <p className="text-lg font-bold">No member is available</p>
          <p className="mt-2 text-sm text-navy/65">Enrol a member before logging an Session.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Session logging"
        title="Daily Check-In"
        description="Record a session for today or a past date."
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
              ? "Your member's organisation Admin records the attempts. You'll see every one of them in Progress."
              : "Subscribe for this member to log Sessions and keep a full history."}
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
          <div className="min-w-0 space-y-4">
            {/* Who are we logging for */}
            <section className="ph-card p-5">
              <div className="rounded-2xl bg-navy p-4 text-cream">
                <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-cream/70 uppercase">
                  <CalendarCheck className="h-4 w-4" aria-hidden /> Logging a session for
                </p>
                <h2 className="mt-1 break-words text-2xl font-bold sm:text-3xl">
                  {activeChild.name}
                </h2>
                <p className="mt-2 text-sm text-cream/80">
                  Check the member's name before saving. Use the member selector to switch.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
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
                      label: playPlanName(playPlan),
                    }))}
                    className="mt-2"
                  />
                </div>
                <div className="min-w-0">
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
                      label: dose.level,
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
                Session saved to {activeChild?.name}'s history.
              </p>
            )}
            {done && <AttuneStruggleLink className="-mt-2 px-1" />}

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
                  submitLabel="Log this Session"
                  onSubmit={async (values) => {
                    await mutation.mutateAsync(values);
                  }}
                />
                {mutation.isError && (
                  <p role="alert" className="mt-3 text-sm font-semibold text-coral">
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : "That Session could not be saved."}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Right rail */}
          <div className="min-w-0 space-y-4 lg:sticky lg:top-4">
            <section className="grid grid-cols-2 gap-3">
              <div className="ph-card p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
                  <Flame className="h-3.5 w-3.5 text-coral" aria-hidden /> Sessions
                </p>
                <p className="mt-1 text-3xl font-bold text-coral">{logged.length}</p>
              </div>
              <div className="ph-card p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
                  <Gauge className="h-3.5 w-3.5 text-blue" aria-hidden /> Support Score{" "}
                  <SupportScoreInfo />
                </p>
                <p className="mt-1 text-2xl font-bold text-blue">
                  {progress.data?.supportScore != null ? `${progress.data.supportScore}%` : "—"}
                </p>
              </div>
            </section>

            <RecentSessions
              key={activeChild.id}
              loading={attempts.isLoading}
              childName={activeChild?.name}
              sessions={[...logged]
                .sort(
                  (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
                )
                .slice(0, 8)}
            />
            {logged.length > 0 && (
              <div className="flex justify-end">
                <Link
                  to="/progress"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-navy px-5 text-sm font-bold text-cream transition hover:bg-navy/90"
                >
                  Full history in Progress
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Collapsible list of the latest sessions; each one opens to show its Big Win. */
function RecentSessions({
  loading,
  childName,
  sessions,
}: {
  loading: boolean;
  childName: string | undefined;
  sessions: Attempt[];
}) {
  const { canLogAttempts, canLeaveConsultNotes } = useCapabilities();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<Attempt | null>(null);
  const removal = useMutation({
    mutationFn: deleteAttempt,
    onSuccess: () => {
      setDeleting(null);
      void queryClient.invalidateQueries();
    },
  });
  const [editing, setEditing] = useState<Attempt | null>(null);
  const correction = useMutation({
    mutationFn: (values: ReflectionValues) => correctAttempt(editing!, values),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["attempts"] });
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-progress"] });
    },
  });
  const [open, setOpen] = useState(true);
  // Until someone picks a session, the newest one stays open so a just-saved Big Win shows.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const expanded = picked === undefined ? (sessions[0]?.id ?? null) : picked;
  // Only the latest log shows at first; the rest are one tap away.
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(0, 1);
  const hidden = sessions.length - visible.length;
  return (
    <section className="ph-card overflow-hidden">
      {deleting && (
        <DeleteConfirmDialog
          title="Delete check-in?"
          description={
            <p>
              Permanently delete {childName}'s check-in for <strong>{deleting.activity}</strong>
              {" on "}
              {fmtDate(deleting.date)}? Their session totals and progress will update.
            </p>
          }
          confirmText={childName ?? "Delete"}
          rows={[]}
          loading={false}
          deleting={removal.isPending}
          error={removal.isError ? removal.error.message : undefined}
          deleteLabel="Delete check-in"
          onDelete={() => removal.mutate(deleting)}
          onClose={() => {
            if (!removal.isPending) setDeleting(null);
          }}
        />
      )}
      {editing && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/45 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Edit session"
              className="min-w-0 max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-card p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Edit session · {editing.activity}</h2>
                <button
                  type="button"
                  disabled={correction.isPending}
                  onClick={() => setEditing(null)}
                  className="text-sm font-bold text-blue"
                >
                  Cancel
                </button>
              </div>
              <ReflectionForm
                key={editing.id}
                showDate
                showConsultNotes={canLeaveConsultNotes}
                initialValues={{
                  date: editing.date,
                  completion: editing.completion,
                  completionStatus: editing.completionStatus,
                  helpLevel: editing.helpLevel,
                  mood: editing.mood,
                  bigWin: editing.bigWin,
                  consultNotes: editing.consultNotes ?? "",
                }}
                pending={correction.isPending}
                submitLabel="Save changes"
                onSubmit={async (values) => {
                  await correction.mutateAsync(values);
                }}
              />
              {correction.isError && (
                <p role="alert" className="mt-3 text-sm text-coral">
                  {correction.error instanceof Error
                    ? correction.error.message
                    : "Changes could not be saved."}
                </p>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="recent-sessions-list"
        className="flex w-full items-center gap-2 p-5 text-left transition hover:bg-navy/[0.02]"
      >
        <History className="h-5 w-5 shrink-0 text-navy/50" aria-hidden />
        <h2 className="flex-1 text-lg font-bold">Recent Sessions</h2>
        {sessions.length > 0 && (
          <span className="shrink-0 rounded-full bg-navy/6 px-2.5 py-0.5 text-[11px] font-bold text-navy/65">
            {sessions.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-navy/55 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div id="recent-sessions-list" className="px-5 pb-5">
          {loading ? (
            <CardSkeleton lines={3} />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-navy/65">Nothing logged for {childName} yet.</p>
          ) : (
            <ol className="space-y-2 border-l-2 border-navy/8 pl-4">
              {visible.map((a) => {
                const isOpen = expanded === a.id;
                const hasWin = !!a.bigWin?.trim();
                return (
                  <li key={a.id} className="group relative rounded-2xl bg-navy/4">
                    <span
                      className="absolute top-[26px] -left-[21px] h-2.5 w-2.5 bg-blue"
                      style={{ borderRadius: "9999px" }}
                      aria-hidden
                    />
                    {/* The whole row opens the Big Win; the pencil beside the name edits the session. */}
                    <div
                      onClick={() => hasWin && setPicked(isOpen ? null : a.id)}
                      className={cn(
                        "flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-2 p-3 text-left",
                        hasWin && "cursor-pointer",
                      )}
                    >
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-bold">{a.activity}</span>
                          {canLogAttempts && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                correction.reset();
                                setEditing(a);
                              }}
                              aria-label={`Edit session: ${a.activity}, ${fmtDate(a.date)}`}
                              title="Edit session"
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-blue transition hover:bg-blue/10 focus-visible:ring-2 focus-visible:ring-blue/40 focus-visible:outline-none"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                          {session.role === "super_admin" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removal.reset();
                                setDeleting(a);
                              }}
                              aria-label={`Delete check-in: ${a.activity}, ${fmtDate(a.date)}`}
                              title="Delete check-in"
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-coral opacity-100 transition hover:bg-coral/10 focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:outline-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-navy/55">
                          {fmtDate(a.date)} ·{" "}
                          {a.source === "daily_check_in" ? "Daily Check-In" : "In activity"}
                        </span>
                        <SessionEditStamp session={a} />
                      </span>
                      <span className="flex items-center gap-1.5">
                        <AttemptScore
                          completion={a.completion}
                          mood={a.mood}
                          completionStatus={a.completionStatus}
                          helpLevel={a.helpLevel}
                        />
                        {hasWin && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPicked(isOpen ? null : a.id);
                            }}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? "Hide Big Win" : "Show Big Win"}
                            className="grid h-7 w-7 place-items-center rounded-full text-navy/45 hover:bg-navy/8"
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                              aria-hidden
                            />
                          </button>
                        )}
                      </span>
                    </div>
                    {isOpen && <ParentWinNote text={a.bigWin} className="mx-3 mb-3 w-auto" />}
                  </li>
                );
              })}
            </ol>
          )}
          {!loading && sessions.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-4">
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-navy/15 px-4 text-xs font-bold text-navy transition hover:border-navy/35"
              >
                {showAll ? "Show less" : `See more (${hidden})`}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")}
                  aria-hidden
                />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
