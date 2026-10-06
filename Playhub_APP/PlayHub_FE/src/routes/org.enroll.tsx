import { useEffect, useState } from "react";
import { isPlatformRole } from "@/lib/roles";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { createChild } from "@/api/children";
import { inviteParent } from "@/api/org";
import { listGoals, listPlans } from "@/api/plans";
import { getOrg } from "@/api/org";
import { listOrgs, listStaff } from "@/api/admin";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { LEVEL_GUIDANCE } from "@/components/brand";
import { Select } from "@/components/Select";
import type { Level } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/org/enroll")({
  head: () => ({
    meta: [
      { title: "Enrol a child — Play Hub" },
      {
        name: "description",
        content:
          "Add a child to your caseload, pick their skill area and level, and invite their parent.",
      },
      { property: "og:title", content: "Enrol a child — Play Hub" },
      {
        property: "og:description",
        content: "Add a child to your caseload and pick their Play Plan.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["educator", "super_admin", "ttp_employee"]} permission="children">
      <EnrolPage />
    </Protected>
  ),
});

const LEVELS: Level[] = ["Rookie", "Starter", "Pro"];

function EnrolPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const isAdmin = isPlatformRole(session.role);
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: listOrgs, enabled: isAdmin });
  const staff = useQuery({ queryKey: ["staff"], queryFn: listStaff, enabled: isAdmin });

  const [name, setName] = useState("");
  const [age, setAge] = useState("5");
  const [goalId, setGoalId] = useState("pinch");
  const [level, setLevel] = useState<Level>("Starter");
  const [parentEmail, setParentEmail] = useState("");
  const [adminOrgId, setAdminOrgId] = useState("");
  const [adminEducatorId, setAdminEducatorId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const available = goals.data ?? [];
    if (available.length && !available.some((goal) => goal.id === goalId)) {
      setGoalId(available[0]!.id);
    }
  }, [goals.data, goalId]);

  const plan = plans.data?.find((p) => p.goalId === goalId && p.level === level);
  const educatorOptions = (staff.data ?? []).filter(
    (s) => s.role === "educator" && (!adminOrgId || s.orgId === adminOrgId),
  );

  // Picking an organisation fills in its Admin. With none yet, enrolling is replaced by a way to create one.
  const needsAdmin = isAdmin && !!adminOrgId && !staff.isLoading && educatorOptions.length === 0;
  useEffect(() => {
    if (!isAdmin || !adminOrgId) return;
    if (educatorOptions.length && !educatorOptions.some((s) => s.id === adminEducatorId)) {
      setAdminEducatorId(educatorOptions[0]!.id);
    }
  }, [isAdmin, adminOrgId, educatorOptions, adminEducatorId]);

  const enrol = useMutation({
    mutationFn: async () => {
      const child = await createChild({
        name: name.trim(),
        age: Number(age),
        planId: plan!.id,
        accountType: isAdmin ? (adminOrgId ? "b2b" : "b2c") : "b2b",
        ownerUserId: session.userId,
        orgId: isAdmin ? adminOrgId || undefined : session.orgId,
        educatorId: isAdmin ? adminEducatorId || undefined : session.userId,
        parentEmail: parentEmail.trim() || undefined,
      });
      if (parentEmail.trim()) await inviteParent(child.id, parentEmail.trim());
      return child;
    },
    onSuccess: () => setTimeout(() => navigate({ to: isAdmin ? "/admin/children" : "/org" }), 900),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next["name"] = "Enter the child's name.";
    const n = Number(age);
    if (!Number.isFinite(n) || n < 1 || n > 18) next["age"] = "Age must be between 1 and 18.";
    if (parentEmail && !/^\S+@\S+\.\S+$/.test(parentEmail))
      next["parentEmail"] = "Enter a valid email address.";
    if (!plan) next["plan"] = "No Play Plan matches that combination.";
    setErrors(next);
    if (Object.keys(next).length === 0) enrol.mutate();
  }

  return (
    <>
      <PageHeader
        eyebrow={isAdmin ? "Super Admin" : org.data ? `${org.data.name} · Caseload` : "Caseload"}
        title="Enrol a child"
        description="Licenses come from your organisation's plan — no card needed here."
      />

      <form onSubmit={submit} className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <section className="ph-card space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1.6fr_0.6fr]">
            <div>
              <label htmlFor="child-name" className="text-sm font-bold">
                Child's name
              </label>
              <input
                id="child-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 min-h-13 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
              />
              {errors["name"] && (
                <p className="mt-1.5 text-xs font-semibold text-coral">{errors["name"]}</p>
              )}
            </div>
            <div>
              <label htmlFor="child-age" className="text-sm font-bold">
                Age
              </label>
              <input
                id="child-age"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-2 min-h-13 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
              />
              {errors["age"] && (
                <p className="mt-1.5 text-xs font-semibold text-coral">{errors["age"]}</p>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="enrol-org" className="text-sm font-bold">
                  Organisation
                </label>
                <Select
                  id="enrol-org"
                  value={adminOrgId}
                  onChange={(nextOrgId) => {
                    setAdminOrgId(nextOrgId);
                    setAdminEducatorId("");
                  }}
                  options={[
                    { value: "", label: "Individual family" },
                    ...(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name })),
                  ]}
                  className="mt-2 min-h-13"
                />
              </div>
              <div>
                <label htmlFor="enrol-educator" className="text-sm font-bold">
                  Organisation Admin
                </label>
                <Select
                  id="enrol-educator"
                  value={adminEducatorId}
                  onChange={setAdminEducatorId}
                  options={
                    adminOrgId
                      ? educatorOptions.length
                        ? educatorOptions.map((s) => ({ value: s.id, label: s.name }))
                        : [{ value: "", label: staff.isLoading ? "Loading…" : "No Admin yet" }]
                      : [{ value: "", label: "Not assigned" }]
                  }
                  className="mt-2 min-h-13"
                />
              </div>
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-bold">Skill area</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(goals.data ?? []).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoalId(g.id)}
                  aria-pressed={goalId === g.id}
                  className={cn(
                    "min-h-14 rounded-2xl border px-3 text-left text-sm font-semibold transition-all active:scale-[0.98]",
                    goalId === g.id
                      ? "border-blue bg-blue/10 text-blue"
                      : "border-navy/15 bg-card hover:border-navy/35",
                  )}
                >
                  {g.short}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold">Level</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                  className={cn(
                    "min-h-12 rounded-2xl border text-sm font-bold transition-all active:scale-[0.98]",
                    level === l
                      ? "border-amber bg-amber/40"
                      : "border-navy/15 bg-card hover:border-navy/35",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-navy/60">{LEVEL_GUIDANCE}</p>
          </fieldset>

          <div>
            <label htmlFor="parent-email" className="text-sm font-bold">
              Child's account email <span className="font-normal text-navy/50">(optional)</span>
            </label>
            <p className="text-xs text-navy/60">
              The account belongs to the member — their Member account manages it on their behalf,
              with read-only access to the Play Plan and Progress.
            </p>
            <input
              id="parent-email"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@example.com"
              className="mt-2 min-h-13 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
            {errors["parentEmail"] && (
              <p className="mt-1.5 text-xs font-semibold text-coral">{errors["parentEmail"]}</p>
            )}
          </div>

          {needsAdmin ? (
            <div role="status" className="rounded-2xl border border-amber/60 bg-amber/15 p-4">
              <p className="text-sm font-bold">This organisation has no Admin yet</p>
              <p className="mt-1 text-xs text-navy/70">
                Create its Admin first. Children are enrolled by an organisation&apos;s Admin.
              </p>
              <Link
                to="/admin/educators"
                className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white"
              >
                <UserPlus className="h-4 w-4" aria-hidden /> Create Admin
              </Link>
            </div>
          ) : (
            <button
              type="submit"
              disabled={enrol.isPending || enrol.isSuccess}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
            >
              {enrol.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden />
              )}
              Enrol child
            </button>
          )}

          {enrol.isSuccess && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-2xl bg-blue/10 p-3 text-sm font-semibold text-blue"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> {name} enrolled. Taking you
              back to the caseload…
            </p>
          )}
        </section>

        <aside className="ph-card p-5 sm:p-6">
          <p className="eyebrow text-blue">Play Plan preview</p>
          <h2 className="mt-1 text-lg font-bold">{plan?.title ?? "Pick a skill area and level"}</h2>
          <p className="mt-2 text-sm text-navy/70">{plan?.summary}</p>
          {errors["plan"] && (
            <p className="mt-2 text-xs font-semibold text-coral">{errors["plan"]}</p>
          )}
          <ol className="mt-4 space-y-1.5">
            {(plan?.entries ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-navy/4 px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate font-semibold">{entry.title}</span>
                <span className="shrink-0 text-navy/50">
                  {entry.kind === "intro" || entry.kind === "levelup"
                    ? entry.label
                    : `Day ${entry.day}`}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </form>
    </>
  );
}
