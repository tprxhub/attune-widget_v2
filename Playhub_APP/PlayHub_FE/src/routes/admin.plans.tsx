import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  EyeOff,
  Globe2,
  ImagePlus,
  Lock,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { GOALS, goalById } from "@/api/domain";
import {
  blankPlanEntries,
  createPlan,
  createPlayPlan,
  updatePlayPlanCredit,
  updatePlayPlanStatus,
  deletePlan,
  entryActivities,
  listAllGoals,
  listPlanUsage,
  listPlans,
  updatePlan,
  type PlanInput,
  reorderPlayDoses,
  reorderPlayPlans,
  type PlanPublicationStatus,
} from "@/api/plans";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { ModalPortal } from "@/components/ModalPortal";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import {
  LEVELS,
  type EntryKind,
  type Level,
  type PlanActivity,
  type PlanEntry,
  type PlayPlan,
} from "@/lib/types";

import { StepsEditor } from "@/components/StepsEditor";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({
    meta: [
      { title: "Play Plans library — Play Hub admin" },
      {
        name: "description",
        content:
          "Create, edit and remove the Play Plans families and organisations follow, including every day's activity and instructions.",
      },
      { property: "og:title", content: "Play Plans library — Play Hub admin" },
      {
        property: "og:description",
        content: "Maintain the Play Plan library and its weekly activities across Play Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]} permission="plans">
      <AdminPlans />
    </Protected>
  ),
});

const inputCls =
  "mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25";

function AdminPlans() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const canDelete = session.role === "super_admin";
  const plans = useQuery({
    queryKey: ["plans", "library"],
    queryFn: () => listPlans(undefined, true),
  });
  const goals = useQuery({ queryKey: ["goals", "library"], queryFn: listAllGoals });
  const usage = useQuery({ queryKey: ["plan-usage"], queryFn: listPlanUsage });

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<Level | "all">("all");
  const [creditFor, setCreditFor] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<PlayPlan | "new" | "new-play-plan" | null>(null);
  const [newDoseGoalId, setNewDoseGoalId] = useState<string | undefined>();
  const [removing, setRemoving] = useState<PlayPlan | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["plans"] });
    queryClient.invalidateQueries({ queryKey: ["plan-usage"] });
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  };

  const [reorderError, setReorderError] = useState<string | null>(null);
  const reorder = useMutation({
    mutationFn: (job: () => Promise<void>) => job(),
    onSuccess: () => {
      setReorderError(null);
      invalidate();
    },
    onError: (error: Error) => setReorderError(error.message),
  });
  const statusChange = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PlanPublicationStatus }) =>
      updatePlayPlanStatus(id, status),
    onSuccess: invalidate,
  });
  /** Swaps one item with its neighbour in the full (unfiltered) list and saves the new order. */
  const shift = (ids: string[], id: string, dir: -1 | 1) => {
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return null;
    const next = [...ids];
    [next[from], next[to]] = [next[to]!, next[from]!];
    return next;
  };
  const movePlayPlan = (goalId: string, dir: -1 | 1) => {
    const next = shift(
      (goals.data ?? []).map((g) => g.id),
      goalId,
      dir,
    );
    if (next) reorder.mutate(() => reorderPlayPlans(next));
  };
  const movePlayDose = (goalId: string, doseId: string, dir: -1 | 1) => {
    const all = (plans.data ?? []).filter((p) => p.goalId === goalId).map((p) => p.id);
    const next = shift(all, doseId, dir);
    if (next) reorder.mutate(() => reorderPlayDoses(goalId, next));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (plans.data ?? []).filter((p) => {
      if (level !== "all" && p.level !== level) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.kit.toLowerCase().includes(q) ||
        (goalById(p.goalId)?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [plans.data, search, level]);

  const grouped = useMemo(() => {
    const libraryGoals = goals.data ?? GOALS;
    const known = libraryGoals.map((g) => ({
      goalId: g.id,
      name: g.name,
      createdBy: g.createdBy,
      publicationStatus: g.publicationStatus ?? "published",
      plans: filtered.filter((p) => p.goalId === g.id),
    }));
    const others = filtered.filter((p) => !libraryGoals.some((g) => g.id === p.goalId));
    return others.length
      ? [
          ...known,
          {
            goalId: "other",
            name: "Other goals",
            createdBy: undefined,
            publicationStatus: "published" as const,
            plans: others,
          },
        ]
      : known;
  }, [filtered, goals.data]);

  if (plans.isLoading || !plans.data) {
    return (
      <>
        <PageHeader eyebrow="Super Admin" title="Play Plans library" />
        <div className="mt-5 grid gap-4">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={3} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Play Plans library"
        description="Play Plan → Play Dose → Activity. Each activity carries one optional video and written instructions."
      />

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-navy/55">
        <span className="rounded-full bg-navy/8 px-3 py-1">Play Plan</span>
        <span aria-hidden>→</span>
        <span className="rounded-full bg-navy/8 px-3 py-1">Play Dose</span>
        <span aria-hidden>→</span>
        <span className="rounded-full bg-navy/8 px-3 py-1">Activity (video + instructions)</span>
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-navy/40"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search play plans, play doses or activities"
            aria-label="Search Play Plans"
            className="min-h-12 w-full rounded-2xl border border-navy/15 bg-card pr-4 pl-11 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...LEVELS] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l as Level | "all")}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold",
                level === l
                  ? "border-navy bg-navy text-white"
                  : "border-navy/15 bg-card text-navy/70",
              )}
            >
              {l === "all" ? "All levels" : l}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditing("new-play-plan")}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-coral px-4 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden /> New Play Plan
          </button>
        </div>
      </div>

      {reorderError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-coral">
          {reorderError}
        </p>
      )}
      <div className="mt-5 space-y-5">
        {grouped.map((group, groupIndex) => (
          <section key={group.goalId} className="ph-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-coral">Play Plan</p>
                <h2 className="text-lg font-bold">{group.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-navy/55">
                  <span>
                    {group.plans.length} {group.plans.length === 1 ? "Play Dose" : "Play Doses"}
                  </span>
                  {group.goalId !== "other" && (
                    <>
                      <span
                        data-testid="plan-creator"
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue/20 bg-blue/8 px-2.5 py-1 font-bold text-navy"
                      >
                        <UserRound className="h-3.5 w-3.5 text-blue" aria-hidden />
                        Created by{" "}
                        <span className="text-blue">{group.createdBy ?? "Super Admin"}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCreditFor({ id: group.goalId, name: group.createdBy ?? "Super Admin" })
                        }
                        aria-label={`Edit who created ${group.name}`}
                        className="ml-1.5 inline-flex align-middle text-navy/50 hover:text-navy"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {group.goalId !== "other" && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div
                    className="inline-flex rounded-full border border-navy/12 bg-navy/[0.035] p-1"
                    aria-label={`Publishing status for ${group.name}`}
                  >
                    {(
                      [
                        ["published", "Visible", Globe2],
                        ["invisible", "Invisible", EyeOff],
                        ["locked", "Locked", Lock],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        title={
                          value === "invisible"
                            ? "Hide this old or unpopular plan"
                            : value === "locked"
                              ? "Show as upcoming, but prevent starting it"
                              : "Show and allow this plan"
                        }
                        onClick={() => statusChange.mutate({ id: group.goalId, status: value })}
                        disabled={statusChange.isPending}
                        className={cn(
                          "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition",
                          group.publicationStatus === value
                            ? value === "published"
                              ? "bg-blue text-white"
                              : value === "locked"
                                ? "bg-amber text-navy"
                                : "bg-navy text-white"
                            : "text-navy/55 hover:bg-white",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                      </button>
                    ))}
                  </div>
                  <MoveButtons
                    label={`Play Plan ${group.name}`}
                    disabled={reorder.isPending}
                    first={groupIndex === 0}
                    last={
                      groupIndex === grouped.length - 1 ||
                      grouped[groupIndex + 1]?.goalId === "other"
                    }
                    onMove={(dir) => movePlayPlan(group.goalId, dir)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNewDoseGoalId(group.goalId);
                      setEditing("new");
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> New Play Dose
                  </button>
                </div>
              )}
            </div>
            {group.plans.length === 0 ? (
              <p className="mt-2 text-sm text-navy/55">No plans match your filters.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {group.plans.map((plan, doseIndex) => {
                  const used = usage.data?.[plan.id] ?? 0;
                  const acts = plan.entries.reduce((n, e) => n + entryActivities(e).length, 0);
                  const vids = plan.entries.reduce(
                    (n, e) => n + entryActivities(e).filter((a) => a.videoUrl?.trim()).length,
                    0,
                  );
                  return (
                    <li
                      key={plan.id}
                      className="rounded-2xl border border-navy/10 bg-card p-4 md:flex md:items-center md:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold tracking-[0.12em] text-blue uppercase">
                          Play Dose · {plan.level}
                        </p>
                        <p className="mt-1 font-bold">{plan.title}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-navy/10 bg-navy/[0.035] px-2.5 py-1 text-xs font-semibold text-navy/65">
                          <UserRound className="h-3.5 w-3.5 text-blue" aria-hidden /> Created by{" "}
                          <span data-testid="dose-creator" className="font-bold text-navy">
                            {plan.createdBy ?? "Super Admin"}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-navy/65">{plan.summary}</p>
                        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-navy/55">
                          <span>{acts} activities</span>
                          <span>
                            {vids} with video · {acts - vids} instructions only
                          </span>
                          <span>
                            {used} {used === 1 ? "child" : "children"} on this plan
                          </span>
                        </p>
                      </div>
                      <div className="mt-3 flex shrink-0 items-center gap-2 md:mt-0">
                        <MoveButtons
                          label={`Play Dose ${plan.title} (${plan.level})`}
                          disabled={reorder.isPending}
                          first={doseIndex === 0}
                          last={doseIndex === group.plans.length - 1}
                          onMove={(dir) => movePlayDose(group.goalId, plan.id, dir)}
                        />
                        <button
                          type="button"
                          onClick={() => setEditing(plan)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold"
                        >
                          <Pencil className="h-4 w-4" aria-hidden /> Edit Play Dose
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setRemoving(plan)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-coral/40 px-4 text-sm font-bold text-coral"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden /> Delete
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {editing && (
        <PlanModal
          plan={typeof editing === "object" ? editing : null}
          createNewPlayPlan={editing === "new-play-plan"}
          {...(newDoseGoalId ? { initialGoalId: newDoseGoalId } : {})}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}
      {creditFor && (
        <CreditModal
          initial={creditFor.name}
          onClose={() => setCreditFor(null)}
          onSave={async (name) => {
            await updatePlayPlanCredit(creditFor.id, name);
            invalidate();
            setCreditFor(null);
          }}
        />
      )}
      {canDelete && removing && (
        <DeletePlanModal
          plan={removing}
          inUse={usage.data?.[removing.id] ?? 0}
          onClose={() => setRemoving(null)}
          onDeleted={() => {
            invalidate();
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}

function MoveButtons({
  label,
  first,
  last,
  disabled,
  onMove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const cls =
    "grid h-9 w-9 place-items-center rounded-full bg-navy/6 hover:bg-navy/10 disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={first || disabled}
        aria-label={`Move ${label} up`}
        className={cls}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={last || disabled}
        aria-label={`Move ${label} down`}
        className={cls}
      >
        <ArrowDown className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function Shell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/45 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="my-6 w-full max-w-3xl rounded-3xl bg-cream p-5 shadow-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-xs text-navy/55">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/6 text-navy hover:bg-navy/12"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

const ENTRY_KIND_OPTIONS: Array<{
  value: EntryKind;
  label: string;
  description: string;
}> = [
  {
    value: "intro",
    label: "Intro",
    description: "Introduces the goal and prepares the family for the week.",
  },
  {
    value: "dose",
    label: "Activity",
    description: "One of the five guided skill-building activities.",
  },
  {
    value: "redo",
    label: "Real-Life Try",
    description: "Practises the skill in an everyday, real-life moment.",
  },
  {
    value: "levelup",
    label: "Level Up",
    description: "Ends the week with the prompt for what comes next.",
  },
];

function PlanModal({
  plan,
  createNewPlayPlan = false,
  initialGoalId,
  onClose,
  onSaved,
}: {
  plan: PlayPlan | null;
  createNewPlayPlan?: boolean;
  initialGoalId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const canDelete = session.role === "super_admin";
  const [title, setTitle] = useState(plan?.title ?? "");
  const [goalId, setGoalId] = useState(plan?.goalId ?? initialGoalId ?? GOALS[0]!.id);
  const [level, setLevel] = useState<Level>(plan?.level ?? "Starter");
  const [kit, setKit] = useState(plan?.kit ?? "Fine Motor Play Kit");
  const [summary, setSummary] = useState(plan?.summary ?? "");
  const [safetyNote, setSafetyNote] = useState(plan?.safetyNote ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(plan?.thumbnailUrl ?? "");
  const [thumbnailFile, setThumbnailFile] = useState<File | undefined>();
  const [createdBy, setCreatedBy] = useState(plan ? (plan.createdBy ?? "Super Admin") : "");
  const [playPlanName, setPlayPlanName] = useState("");
  const [playPlanSummary, setPlayPlanSummary] = useState("");
  const [entries, setEntries] = useState<PlanEntry[]>(() =>
    plan
      ? plan.entries.map((e) => ({
          ...e,
          instructions: [...e.instructions],
          activities: entryActivities(e).map((a) => ({ ...a, instructions: [...a.instructions] })),
        }))
      : blankPlanEntries(),
  );
  const [error, setError] = useState("");
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  const patch = (id: string, next: Partial<PlanEntry>) =>
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...next } : e)));

  const patchActivity = (entryId: string, activityId: string, next: Partial<PlanActivity>) =>
    setEntries((list) =>
      list.map((e) =>
        e.id === entryId
          ? {
              ...e,
              activities: (e.activities ?? []).map((a) =>
                a.id === activityId ? { ...a, ...next } : a,
              ),
            }
          : e,
      ),
    );

  // An entry holds a single activity and shares its name, so there is only one name to type.
  const renameActivity = (entryId: string, name: string) =>
    setEntries((list) =>
      list.map((e) =>
        e.id === entryId
          ? {
              ...e,
              title: name,
              activity: name,
              activities: (e.activities ?? []).map((a, index) =>
                index === 0 ? { ...a, name } : a,
              ),
            }
          : e,
      ),
    );

  const move = (index: number, dir: -1 | 1) =>
    setEntries((list) => {
      const target = index + dir;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item!);
      return copy;
    });

  const addEntry = () =>
    setEntries((list) => [
      ...list,
      {
        id: `new-${Date.now().toString(36)}-${list.length}`,
        kind: "dose",
        day: Math.min(7, list.length),
        label: `Activity #${list.length + 1}`,
        title: "",
        activity: "",
        loggable: true,
        minutes: 10,
        instructions: [],
        videoLabel: "",
        activities: [
          {
            id: `act-${Date.now().toString(36)}-0`,
            name: "",
            minutes: 10,
            instructions: [""],
            videoLabel: "",
          },
        ],
      },
    ]);

  const save = useMutation<unknown, Error, void>({
    mutationFn: () => {
      const input: PlanInput = {
        title: title.trim(),
        goalId,
        level,
        kit: kit.trim(),
        summary: summary.trim(),
        safetyNote: safetyNote.trim() || undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        thumbnailFile,
        createdBy: createdBy.trim() || undefined,
        entries: entries.map((e) => {
          const activities = (e.activities ?? []).map((a) => ({
            ...a,
            name: a.name.trim(),
            // The video is titled after the activity unless someone chose another title earlier.
            videoLabel: a.videoLabel.trim() || a.name.trim(),
            videoUrl: a.videoUrl?.trim() ? a.videoUrl.trim() : undefined,
            instructions: a.instructions.map((i) => i.trim()).filter(Boolean),
          }));
          const first = activities[0]!;
          return {
            ...e,
            title: e.title.trim(),
            activities,
            // keep the single-activity fields in sync for the rest of the app
            activity: activities.map((a) => a.name).join(" · "),
            minutes: activities.reduce((sum, a) => sum + (Number(a.minutes) || 0), 0),
            instructions: first.instructions,
            videoLabel: first.videoLabel,
            videoUrl: first.videoUrl,
          };
        }),
      };
      return plan
        ? updatePlan(plan.id, input)
        : createNewPlayPlan
          ? createPlayPlan({ name: playPlanName, summary: playPlanSummary, createdBy })
          : createPlan(input);
    },
    onSuccess: onSaved,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createNewPlayPlan) {
      if (playPlanName.trim().length < 3) return setError("Give the new Play Plan a name.");
      setError("");
      save.mutate();
      return;
    }
    if (title.trim().length < 3) return setError("Give the Play Dose a title.");
    if (entries.length === 0) return setError("Add at least one activity.");
    for (const entry of entries) {
      if (!entry.title.trim()) return setError("Every activity needs a name.");
      if (!Number.isFinite(entry.day) || entry.day < 0 || entry.day > 7)
        return setError("Days must be between 0 and 7.");
      const activities = entry.activities ?? [];
      if (activities.length === 0) return setError(`“${entry.title}” needs at least one activity.`);
      for (const act of activities) {
        if (!act.name.trim()) return setError("Every activity needs a name.");
        const url = act.videoUrl?.trim();
        if (url && !/^(https?:\/\/\S+|blob:\S+)$/i.test(url))
          return setError("Video links must start with http:// or https://.");
      }
    }
    if (thumbnailUrl.trim() && !/^(https?:\/\/\S+|blob:\S+)$/i.test(thumbnailUrl.trim()))
      return setError("Play Dose thumbnail links must start with http:// or https://.");
    setError("");
    save.mutate();
  };

  if (createNewPlayPlan) {
    return (
      <Shell
        title="New Play Plan"
        subtitle="Create the top-level Play Plan. Play Doses and activities are added separately."
        onClose={onClose}
      >
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="pl-root-name" className="text-sm font-bold">
              Play Plan name
            </label>
            <input
              id="pl-root-name"
              value={playPlanName}
              onChange={(e) => setPlayPlanName(e.target.value)}
              placeholder="e.g. Pinch & Grip Development"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="pl-root-summary" className="text-sm font-bold">
              Short description
            </label>
            <textarea
              id="pl-root-summary"
              value={playPlanSummary}
              onChange={(e) => setPlayPlanSummary(e.target.value)}
              rows={3}
              className={cn(inputCls, "min-h-24 py-3")}
            />
          </div>
          <div>
            <label htmlFor="pl-created-by" className="text-sm font-bold">
              Created by (full name)
            </label>
            <input
              id="pl-created-by"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              maxLength={120}
              className={inputCls}
              placeholder="Defaults to your name"
            />
          </div>
          {error && <p className="text-sm font-semibold text-coral">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Create Play Plan
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  return (
    <Shell
      title={plan ? "Edit Play Dose" : createNewPlayPlan ? "New Play Plan" : "New Play Dose"}
      subtitle={
        plan
          ? `${goalById(plan.goalId)?.name ?? "Play Plan"} › ${plan.title}`
          : createNewPlayPlan
            ? "Create the Play Plan, its first Play Dose, and the activities inside it"
            : "Choose a Play Plan, then add its Play Dose and activities"
      }
      onClose={onClose}
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-4 rounded-2xl border border-navy/10 bg-card p-4">
          <h3 className="text-sm font-bold tracking-wide text-navy/55 uppercase">
            {createNewPlayPlan
              ? "Step 1 · Play Plan and first Play Dose"
              : "Step 1 · Play Dose details"}
          </h3>
          {createNewPlayPlan && (
            <>
              <div>
                <label htmlFor="pl-root-name" className="text-sm font-bold">
                  Play Plan name
                </label>
                <input
                  id="pl-root-name"
                  value={playPlanName}
                  onChange={(e) => setPlayPlanName(e.target.value)}
                  placeholder="e.g. Pinch & Grip Development"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="pl-root-summary" className="text-sm font-bold">
                  Play Plan summary
                </label>
                <textarea
                  id="pl-root-summary"
                  value={playPlanSummary}
                  onChange={(e) => setPlayPlanSummary(e.target.value)}
                  rows={2}
                  className={cn(inputCls, "min-h-20 py-3")}
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="pl-title" className="text-sm font-bold">
              Play Dose title
            </label>
            <input
              id="pl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Fix the Pencil Grip"
            />
          </div>
          <div>
            <label htmlFor="pl-created-by" className="text-sm font-bold">
              Created by (full name)
            </label>
            <input
              id="pl-created-by"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              maxLength={120}
              className={inputCls}
              placeholder="Defaults to your name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {!createNewPlayPlan && (
              <div>
                <label htmlFor="pl-goal" className="text-sm font-bold">
                  Play Plan
                </label>
                <Select
                  id="pl-goal"
                  value={goalId}
                  onChange={setGoalId}
                  options={GOALS.map((g) => ({ value: g.id, label: g.name }))}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label htmlFor="pl-level" className="text-sm font-bold">
                Level
              </label>
              <Select
                id="pl-level"
                value={level}
                onChange={(nextLevel) => setLevel(nextLevel as Level)}
                options={LEVELS.map((l) => ({ value: l, label: l }))}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label htmlFor="pl-summary" className="text-sm font-bold">
              Short summary
            </label>
            <textarea
              id="pl-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className={cn(inputCls, "min-h-20 py-3")}
            />
          </div>
          <div>
            <label htmlFor="pl-safety-note" className="text-sm font-bold">
              Safety note <span className="font-normal text-navy/55">(optional)</span>
            </label>
            <textarea
              id="pl-safety-note"
              value={safetyNote}
              onChange={(event) => setSafetyNote(event.target.value)}
              rows={2}
              placeholder="Shown to families on the Play Dose, for example to supervise small parts."
              className={cn(inputCls, "min-h-20 py-3")}
            />
          </div>
          <div>
            <label htmlFor="pl-thumbnail" className="text-sm font-bold">
              Play Dose card thumbnail
            </label>
            <input
              id="pl-thumbnail"
              value={thumbnailUrl}
              onChange={(e) => {
                setThumbnailUrl(e.target.value);
                setThumbnailFile(undefined);
              }}
              placeholder="https://…/play-dose-thumbnail.jpg"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-navy/55">
              Paste an image link, or upload an image below. It appears on the Play Dose card.
            </p>
            <input
              id="pl-thumbnail-file"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("image/")) {
                  setError("Choose an image file for the Play Dose thumbnail.");
                  event.target.value = "";
                  return;
                }
                setThumbnailFile(file);
                setThumbnailUrl(URL.createObjectURL(file));
                setError("");
              }}
            />
            <label
              htmlFor="pl-thumbnail-file"
              className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold text-navy hover:border-blue hover:text-blue"
            >
              <ImagePlus className="h-4 w-4" aria-hidden /> Upload thumbnail
            </label>
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt="Play Dose thumbnail preview"
                className="mt-3 aspect-video w-full rounded-xl border border-navy/10 object-cover"
              />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-wide text-navy/55 uppercase">
                Step 2 · Activities in this Play Dose ({entries.length})
              </h3>
              <p className="text-xs text-navy/55">
                Each activity has a name, a day, written steps and, if you like, a video.
              </p>
            </div>
            <button
              type="button"
              onClick={addEntry}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add activity
            </button>
          </div>

          {entries.map((entry, index) => {
            const open = openEntry === entry.id;
            const first = (entry.activities ?? [])[0];
            const steps = first ? first.instructions.filter((line) => line.trim()).length : 0;
            const hasVideo = Boolean(first?.videoUrl?.trim());
            return (
              <div key={entry.id} className="rounded-2xl border border-navy/10 bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenEntry(open ? null : entry.id)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-bold">{entry.title || "Untitled activity"}</p>
                    <p className="text-xs text-navy/55">
                      Day {entry.day} · {steps} step{steps === 1 ? "" : "s"} ·{" "}
                      {hasVideo ? "video" : "no video"}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenEntry(entry.id)}
                    aria-label="Edit activity"
                    className="grid h-9 w-9 place-items-center rounded-full bg-blue/12 text-blue"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    aria-label="Move up"
                    className="grid h-9 w-9 place-items-center rounded-full bg-navy/6"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    aria-label="Move down"
                    className="grid h-9 w-9 place-items-center rounded-full bg-navy/6"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setEntries((l) => l.filter((e) => e.id !== entry.id))}
                      aria-label="Remove activity"
                      className="grid h-9 w-9 place-items-center rounded-full bg-coral/12 text-coral"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>

                {open && first && (
                  <div className="mt-4 space-y-5 border-t border-navy/10 pt-4">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <div>
                        <label htmlFor={`an-${first.id}`} className="text-sm font-bold">
                          Activity name
                        </label>
                        <input
                          id={`an-${first.id}`}
                          value={first.name}
                          onChange={(e) => renameActivity(entry.id, e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor={`d-${entry.id}`} className="text-sm font-bold">
                          Day
                        </label>
                        <input
                          id={`d-${entry.id}`}
                          inputMode="numeric"
                          value={String(entry.day)}
                          onChange={(e) => patch(entry.id, { day: Number(e.target.value) })}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`steps-${first.id}`} className="text-sm font-bold">
                        Steps
                      </label>
                      <p className="mt-0.5 text-xs text-navy/55">
                        Format it like a document: headings, bold, numbered or bulleted lists. Each
                        list item counts as one step.
                      </p>
                      <StepsEditor
                        key={first.id}
                        id={`steps-${first.id}`}
                        html={first.instructionsHtml}
                        steps={first.instructions}
                        onChange={({ html, steps }) =>
                          patchActivity(entry.id, first.id, {
                            instructions: steps,
                            instructionsHtml: html || undefined,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor={`au-${first.id}`} className="text-sm font-bold">
                        Video link <span className="font-normal text-navy/55">(optional)</span>
                      </label>
                      {first.videoFile ? (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-blue/8 px-4 py-2.5 text-sm">
                          <span className="min-w-0 truncate font-semibold">
                            {first.videoFile.name}
                            <span className="font-normal text-navy/55">
                              {" "}
                              · uploads when you save
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              patchActivity(entry.id, first.id, {
                                videoFile: undefined,
                                videoUrl: "",
                              })
                            }
                            className="shrink-0 text-xs font-bold text-coral hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            id={`au-${first.id}`}
                            value={first.videoUrl ?? ""}
                            onChange={(e) =>
                              patchActivity(entry.id, first.id, {
                                videoUrl: e.target.value,
                                videoFile: undefined,
                              })
                            }
                            placeholder="Paste an MP4, YouTube or Vimeo link"
                            className={inputCls}
                          />
                          <label
                            htmlFor={`af-${first.id}`}
                            className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-navy/60"
                          >
                            or upload a video file
                            <input
                              id={`af-${first.id}`}
                              type="file"
                              accept="video/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                if (!file.type.startsWith("video/")) {
                                  setError("Choose a video file to upload.");
                                  event.target.value = "";
                                  return;
                                }
                                patchActivity(entry.id, first.id, {
                                  videoUrl: URL.createObjectURL(file),
                                  videoFile: file,
                                });
                                setError("");
                              }}
                              className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                            />
                          </label>
                        </>
                      )}
                    </div>

                    <details className="rounded-xl border border-navy/10 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-bold text-navy/70">
                        More options
                      </summary>
                      <div className="mt-4 space-y-4">
                        <div className="sm:max-w-xs">
                          <label htmlFor={`k-${entry.id}`} className="text-sm font-bold">
                            Activity type
                          </label>
                          <Select
                            id={`k-${entry.id}`}
                            value={entry.kind}
                            onChange={(k) => patch(entry.id, { kind: k as EntryKind })}
                            options={ENTRY_KIND_OPTIONS}
                            className={inputCls}
                          />
                          <p className="mt-1.5 text-xs leading-relaxed text-navy/55">
                            Choose where this item belongs in the Play Plan week.
                          </p>
                        </div>
                        <label className="flex items-center gap-3 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={entry.loggable}
                            onChange={(e) => patch(entry.id, { loggable: e.target.checked })}
                            className="h-5 w-5 rounded-md border-navy/25"
                          />
                          Can be logged as an Session
                        </label>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm font-semibold text-coral">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {plan ? "Save changes" : createNewPlayPlan ? "Create Play Plan" : "Create Play Dose"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </form>
    </Shell>
  );
}

function CreditModal({
  initial,
  onClose,
  onSave,
}: {
  initial: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Shell title="Edit creator" subtitle="Who created this Play Plan" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(name);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save.");
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="credit-name" className="text-sm font-bold">
            Created by (full name)
          </label>
          <input
            id="credit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className={inputCls}
          />
        </div>
        {error && <p className="text-sm font-semibold text-coral">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </form>
    </Shell>
  );
}

function DeletePlanModal({
  plan,
  inUse,
  onClose,
  onDeleted,
}: {
  plan: PlayPlan;
  inUse: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [blocked, setBlocked] = useState(inUse);
  const remove = useMutation({
    mutationFn: () => deletePlan(plan.id),
    onSuccess: (result) => (result.ok ? onDeleted() : setBlocked(result.inUse)),
  });

  return (
    <Shell title="Delete Play Plan" subtitle={plan.title} onClose={onClose}>
      {blocked > 0 ? (
        <div className="space-y-4">
          <p className="flex items-start gap-3 rounded-2xl bg-coral/10 p-4 text-sm font-semibold text-coral">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {blocked} {blocked === 1 ? "child is" : "children are"} following this plan right now.
            Move them onto another plan first, then delete it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/children"
              className="inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-bold text-white"
            >
              Go to Children
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-navy/75">
            This removes “{plan.title}” and its {plan.entries.length} Play Doses from the library.
            No child is using it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Delete plan
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
