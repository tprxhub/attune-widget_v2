import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { assignSupporter, listChildrenForSession, updateChild } from "@/api/children";
import { listOrgs, listStaff } from "@/api/admin";
import { getProgressForChildren } from "@/api/progress";
import { inviteParent } from "@/api/org";
import { listPlans } from "@/api/plans";
import {
  PRICE_PLANS,
  adminActivateSubscription,
  adminCancelSubscription,
  getSubscriptions,
} from "@/api/subscriptions";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { ChildAvatar } from "@/components/brand";
import { ModalPortal } from "@/components/ModalPortal";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/format";
import type { Child, Org, PlanDuration, StaffMember, Subscription } from "@/lib/types";
import { useOrgScope } from "@/lib/org-scope";
import { useActiveChild } from "@/lib/active-child";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/children")({
  head: () => ({
    meta: [
      { title: "Children — Play Hub admin" },
      {
        name: "description",
        content:
          "Every child on Play Hub: maintain their profile, assign a Moderator, invite the Member and manage their subscription.",
      },
      { property: "og:title", content: "Children — Play Hub admin" },
      {
        property: "og:description",
        content: "Maintain child profiles, Moderators and subscriptions across Play Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <AdminChildren />
    </Protected>
  ),
});

type Filter = "all" | "b2c" | "b2b" | "unassigned";

function AdminChildren() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { setActiveChildId } = useActiveChild();
  const kids = useQuery({
    queryKey: ["children", session.personaId],
    queryFn: () => listChildrenForSession(session),
  });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: listOrgs });
  const staff = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { matchesChild, scopeId, label: scopeLabel } = useOrgScope();
  const list = useMemo(() => (kids.data ?? []).filter(matchesChild), [kids.data, matchesChild]);
  const subs = useQuery({
    queryKey: ["subs", list.map((c) => c.id).join(",")],
    queryFn: () => getSubscriptions(list.map((c) => c.id)),
    enabled: list.length > 0,
  });
  const progress = useQuery({
    queryKey: ["children-progress", list.map((child) => child.id).join(",")],
    queryFn: () => getProgressForChildren(list.map((child) => child.id)),
    enabled: list.length > 0,
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Child | null>(null);
  const [billing, setBilling] = useState<Child | null>(null);
  const [inviting, setInviting] = useState<Child | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["children"] });
    queryClient.invalidateQueries({ queryKey: ["subs"] });
  };

  const q = search.trim().toLowerCase();
  const filtered = list.filter((child) => {
    if (filter === "b2c" && child.accountType !== "b2c") return false;
    if (filter === "b2b" && child.accountType !== "b2b") return false;
    if (filter === "unassigned" && child.supporterId) return false;
    if (!q) return true;
    return (
      child.name.toLowerCase().includes(q) || (child.parentEmail ?? "").toLowerCase().includes(q)
    );
  });

  const subFor = (childId: string) => subs.data?.find((s) => s.childId === childId);
  const progressFor = (childId: string) =>
    progress.data?.find((report) => report.childId === childId);
  const orgName = (orgId?: string) => orgs.data?.find((o) => o.id === orgId)?.name;
  const supporters = (staff.data ?? []).filter((s) => s.role === "supporter");

  const activeSubs = (subs.data ?? []).filter((s) => s.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Children"
        description={
          scopeId === "all"
            ? "Every child on the platform — profiles, Moderators, Member invites and subscriptions."
            : `${scopeLabel} — profiles, Moderators, Member invites and subscriptions.`
        }
        actions={
          <Link
            to="/org/enroll"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" aria-hidden /> Enrol a child
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 rounded-3xl bg-navy p-5 text-cream lg:grid-cols-4">
        <Stat label="Children" value={list.length} />
        <Stat label="Family accounts" value={list.filter((c) => c.accountType === "b2c").length} />
        <Stat label="Organisation" value={list.filter((c) => c.accountType === "b2b").length} />
        <Stat label="Active subscriptions" value={activeSubs} />
      </section>

      <div className="ph-card mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "Everyone"],
              ["b2c", "Families"],
              ["b2b", "Organisations"],
              ["unassigned", "No Moderator"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "min-h-10 rounded-full px-4 text-xs font-bold transition-colors",
                filter === key
                  ? "bg-navy text-white"
                  : "border border-navy/15 text-navy hover:border-navy/35",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 sm:w-60">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy/40"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search children"
            aria-label="Search children"
            className="min-h-10 w-full rounded-full border border-navy/15 bg-card pr-4 pl-9 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
          />
        </div>
      </div>

      {kids.isLoading ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ph-card mt-4 p-10 text-center">
          <Users className="mx-auto h-9 w-9 text-navy/35" aria-hidden />
          <p className="mt-3 text-lg font-bold">No children match</p>
          <p className="mt-2 text-sm text-navy/65">Try a different filter or search.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((child, i) => (
            <article
              key={child.id}
              className="ph-card ph-rise flex flex-col p-5"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <ChildAvatar name={child.name} token={child.colorToken ?? "blue"} size={48} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-lg leading-tight font-bold">{child.name}</h2>
                    {progressFor(child.id) && (
                      <StatusBadge status={progressFor(child.id)!.status} size="sm" />
                    )}
                  </div>
                  <p className="truncate text-xs text-navy/55">
                    Age {child.age} ·{" "}
                    {child.accountType === "b2b"
                      ? (orgName(child.orgId) ?? "Organisation")
                      : "Family account"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-navy/4 p-3">
                <p className="text-[11px] font-bold tracking-[0.12em] text-navy/45 uppercase">
                  Current Play Plan
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-bold">
                  {plans.data?.find((p) => p.id === child.currentPlanId)?.title ?? "—"}
                </p>
                <p className="mt-1 text-xs text-navy/55">Started {fmtDate(child.planStartedAt)}</p>
              </div>

              <label className="mt-3 block">
                <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                  <UserCog className="h-3.5 w-3.5" aria-hidden /> Assigned Moderator
                </span>
                <Select
                  value={child.supporterId ?? ""}
                  onChange={async (nextId) => {
                    await assignSupporter(child.id, nextId || undefined);
                    invalidate();
                  }}
                  options={[
                    { value: "", label: "Not assigned" },
                    ...supporters.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  className="mt-1.5 min-h-11 rounded-xl border-2 border-navy/12"
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(child)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-navy/15 text-xs font-bold hover:border-navy/40"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Profile
                </button>
                <button
                  type="button"
                  onClick={() => setBilling(child)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-navy/15 text-xs font-bold hover:border-navy/40"
                >
                  <CreditCard className="h-3.5 w-3.5" aria-hidden /> Subscription
                </button>
                <button
                  type="button"
                  onClick={() => setInviting(child)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-navy/15 text-xs font-bold hover:border-navy/40"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden /> Invite Member
                </button>
                <Link
                  to="/check-in"
                  onClick={() => setActiveChildId(child.id)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-navy text-xs font-bold text-cream hover:bg-blue"
                >
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Check-in
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <EditChildModal
          child={editing}
          orgs={orgs.data ?? []}
          staff={staff.data ?? []}
          plans={(plans.data ?? []).map((p) => ({ id: p.id, title: p.title }))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}

      {billing && (
        <SubscriptionModal
          child={billing}
          sub={subFor(billing.id)}
          onClose={() => setBilling(null)}
          onChanged={invalidate}
        />
      )}

      {inviting && <InviteParentModal child={inviting} onClose={() => setInviting(null)} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold tracking-[0.14em] text-amber uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
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
      <div
        className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl sm:p-6">
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

const inputCls =
  "mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25";

function EditChildModal({
  child,
  orgs,
  staff,
  plans,
  onClose,
  onSaved,
}: {
  child: Child;
  orgs: Org[];
  staff: StaffMember[];
  plans: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(child.name);
  const [age, setAge] = useState(String(child.age));
  const [planId, setPlanId] = useState(child.currentPlanId);
  const [orgId, setOrgId] = useState(child.orgId ?? "");
  const [educatorId, setEducatorId] = useState(child.educatorId ?? "");
  const [note, setNote] = useState(child.note ?? "");
  const [error, setError] = useState("");

  const educators = staff.filter(
    (staffMember) =>
      staffMember.role === "educator" && (orgId ? staffMember.orgId === orgId : !staffMember.orgId),
  );

  const save = useMutation({
    mutationFn: () => {
      const scopeChanged = orgId !== (child.orgId ?? "");
      return updateChild(child.id, {
        name: name.trim(),
        age: Number(age),
        planId,
        orgId: scopeChanged ? orgId : undefined,
        educatorId: educatorId || null,
        ownerUserId: scopeChanged ? (orgId ? null : educatorId || null) : undefined,
        moderatorId: scopeChanged ? null : undefined,
        note: note.trim() || undefined,
      });
    },
    onSuccess: onSaved,
  });

  return (
    <Shell title="Maintain child profile" subtitle={child.name} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(age);
          if (name.trim().length < 2) return setError("Enter the child's name.");
          if (!Number.isFinite(n) || n < 1 || n > 18) return setError("Age must be 1–18.");
          if (!educatorId) return setError("Choose the Account Admin.");
          setError("");
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1.6fr_0.6fr]">
          <div>
            <label htmlFor="ec-name" className="text-sm font-bold">
              Child's name
            </label>
            <input
              id="ec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="ec-age" className="text-sm font-bold">
              Age
            </label>
            <input
              id="ec-age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ec-plan" className="text-sm font-bold">
            Play Plan
          </label>
          <Select
            id="ec-plan"
            value={planId}
            onChange={setPlanId}
            options={plans.map((p) => ({ value: p.id, label: p.title }))}
            className={inputCls}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ec-org" className="text-sm font-bold">
              Organisation
            </label>
            <Select
              id="ec-org"
              value={orgId}
              onChange={(nextOrgId) => {
                setOrgId(nextOrgId);
                setEducatorId("");
              }}
              options={[
                { value: "", label: "Individual family" },
                ...orgs.map((o) => ({ value: o.id, label: o.name })),
              ]}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="ec-edu" className="text-sm font-bold">
              {orgId ? "Organisation Admin" : "Family Account Admin"}
            </label>
            <Select
              id="ec-edu"
              value={educatorId}
              onChange={setEducatorId}
              options={[
                { value: "", label: "Not assigned" },
                ...educators.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className={inputCls}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-navy/4 p-3 text-sm text-navy/70">
          Member: <strong>{child.parentEmail ?? "not linked"}</strong>. Use “Invite Member” on the
          child card to link or replace a Member account.
        </div>

        <div>
          <label htmlFor="ec-note" className="text-sm font-bold">
            Note
          </label>
          <textarea
            id="ec-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={cn(inputCls, "min-h-24 py-3")}
          />
        </div>

        {error && <p className="text-xs font-semibold text-coral">{error}</p>}

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-full bg-navy/6 px-6 text-sm font-bold text-navy hover:bg-navy/12"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Save changes
          </button>
        </div>
      </form>
    </Shell>
  );
}

function SubscriptionModal({
  child,
  sub,
  onClose,
  onChanged,
}: {
  child: Child;
  sub: Subscription | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [duration, setDuration] = useState<PlanDuration>(sub?.duration ?? "6m");
  const start = useMutation({
    mutationFn: () => adminActivateSubscription(child.id, duration),
    onSuccess: onChanged,
  });
  const cancel = useMutation({
    mutationFn: () => adminCancelSubscription(child.id),
    onSuccess: onChanged,
  });
  const current = start.data ?? cancel.data ?? sub;

  return (
    <Shell title="Manage subscription" subtitle={child.name} onClose={onClose}>
      <div className="rounded-2xl bg-navy/4 p-4 text-sm">
        <p className="font-bold">
          {current?.status === "active"
            ? `Active · ${current.priceLabel ?? ""}`
            : current?.status === "expired"
              ? "Expired"
              : "Free plan"}
        </p>
        {current?.expiresAt && (
          <p className="mt-1 text-xs text-navy/60">Renews / ends {fmtDate(current.expiresAt)}</p>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        {PRICE_PLANS.map((p) => (
          <button
            key={p.duration}
            type="button"
            onClick={() => setDuration(p.duration)}
            aria-pressed={duration === p.duration}
            className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
              duration === p.duration
                ? "border-blue bg-blue/8"
                : "border-navy/15 hover:border-navy/35",
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold">{p.label}</span>
              <span className="block text-xs text-navy/60">{p.note}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold">{p.price}</span>
              <span className="block text-[11px] text-navy/55">{p.per}</span>
            </span>
          </button>
        ))}
      </div>

      {(start.isSuccess || cancel.isSuccess) && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-blue/10 px-4 py-3 text-sm font-semibold text-blue">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Subscription updated.
        </p>
      )}

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {current?.status === "active" && (
          <button
            type="button"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-navy/15 px-6 text-sm font-bold hover:border-coral/50 hover:text-coral disabled:opacity-60"
          >
            {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Cancel subscription
          </button>
        )}
        <button
          type="button"
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
        >
          {start.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {current?.status === "active" ? "Change plan" : "Activate plan"}
        </button>
      </div>
    </Shell>
  );
}

function InviteParentModal({ child, onClose }: { child: Child; onClose: () => void }) {
  const [email, setEmail] = useState(child.parentEmail ?? "");
  const [error, setError] = useState("");
  const invite = useMutation({ mutationFn: () => inviteParent(child.id, email.trim()) });

  return (
    <Shell title="Invite the Member" subtitle={child.name} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
          setError("");
          invite.mutate();
        }}
      >
        <p className="text-sm text-navy/70">
          The Member gets read-only access to this child's Play Plan and Progress.
        </p>
        <div>
          <label htmlFor="inv-email" className="text-sm font-bold">
            Member email
          </label>
          <input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          {error && <p className="mt-1.5 text-xs font-semibold text-coral">{error}</p>}
        </div>
        {invite.isSuccess && (
          <p className="flex items-center gap-2 rounded-2xl bg-blue/10 px-4 py-3 text-sm font-semibold text-blue">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Invitation sent to {email}.
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-full bg-navy/6 px-6 text-sm font-bold text-navy hover:bg-navy/12"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={invite.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {invite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="h-4 w-4" aria-hidden />
            )}
            Send invite
          </button>
        </div>
      </form>
    </Shell>
  );
}
