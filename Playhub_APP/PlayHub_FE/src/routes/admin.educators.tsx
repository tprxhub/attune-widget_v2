import { ConfirmButton } from "@/components/ConfirmButton";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Loader2,
  Plus,
  Power,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  createEducator,
  listOrgs,
  listStaffByOrg,
  regenerateStaffActivation,
  toggleStaffActive,
  type StaffInvitationResult,
} from "@/api/admin";
import { createSupporter } from "@/api/org";
import { ModalPortal } from "@/components/ModalPortal";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { Select } from "@/components/Select";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { useOrgScope } from "@/lib/org-scope";
import { cn } from "@/lib/utils";
import type { Org, StaffMember } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/educators")({
  head: () => ({
    meta: [
      { title: "Admins & Moderators — Play Hub admin" },
      {
        name: "description",
        content:
          "Manage organisation Admins and Moderators, and see the members each one supports.",
      },
      { property: "og:title", content: "Admins & Moderators — Play Hub admin" },
      { property: "og:description", content: "Manage organisation Admins and Moderators." },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]} permission="team">
      <AdminEducators />
    </Protected>
  ),
});

type RoleFilter = "all" | "educator" | "supporter";

function AdminEducators() {
  const queryClient = useQueryClient();
  const groupsQuery = useQuery({ queryKey: ["staff-by-org"], queryFn: listStaffByOrg });
  const { matches } = useOrgScope();
  const groups = {
    ...groupsQuery,
    data: (groupsQuery.data ?? []).filter((g) => matches(g.org?.id)),
  };
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: listOrgs });
  const [view, setView] = useViewMode("admin-staff");

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [createdAccess, setCreatedAccess] = useState<StaffInvitationResult | null>(null);
  const [isReplacementLink, setIsReplacementLink] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [newRole, setNewRole] = useState<"educator" | "supporter">("educator");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), email: email.trim(), orgId: orgId || undefined };
      return newRole === "supporter" ? createSupporter(payload) : createEducator(payload);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff-by-org"] });
      setIsReplacementLink(false);
      setCreatedAccess(result);
      setName("");
      setEmail("");
    },
  });
  const toggle = useMutation({
    mutationFn: toggleStaffActive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-by-org"] }),
  });
  const regenerate = useMutation({
    mutationFn: regenerateStaffActivation,
    onSuccess: (result) => {
      setIsReplacementLink(true);
      setCreatedAccess(result);
      setOpen(true);
    },
  });

  const all = useMemo(() => (groups.data ?? []).flatMap((g) => g.members), [groups.data]);
  const totals = {
    educators: all.filter((m) => m.role === "educator").length,
    supporters: all.filter((m) => m.role === "supporter").length,
    children: all.reduce((sum, m) => sum + m.childCount, 0),
    orgs: (groups.data ?? []).filter((g) => g.org).length,
  };

  const q = search.trim().toLowerCase();
  const filtered = (groups.data ?? [])
    .map((g) => ({
      ...g,
      members: g.members.filter(
        (m) =>
          (roleFilter === "all" || m.role === roleFilter) &&
          (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.members.length > 0 || (!q && roleFilter === "all"));

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Admins & Moderators"
        description="Every staff account grouped by the organisation it belongs to."
        actions={
          <button
            type="button"
            onClick={() => {
              setErrors({});
              setCreatedAccess(null);
              setIsReplacementLink(false);
              create.reset();
              setOpen(true);
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add staff
          </button>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 rounded-3xl bg-navy p-5 text-cream lg:grid-cols-4">
        <SummaryStat label="Admins" value={totals.educators} />
        <SummaryStat label="Moderators" value={totals.supporters} />
        <SummaryStat label="Organisations" value={totals.orgs} />
        <SummaryStat label="Children carried" value={totals.children} />
      </section>

      <section className="mt-5 space-y-5">
        <div className="ph-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              active={roleFilter === "all"}
              onClick={() => setRoleFilter("all")}
              label="Everyone"
              icon={Users}
            />
            <FilterPill
              active={roleFilter === "educator"}
              onClick={() => setRoleFilter("educator")}
              label="Admins"
              icon={GraduationCap}
            />
            <FilterPill
              active={roleFilter === "supporter"}
              onClick={() => setRoleFilter("supporter")}
              label="Moderators"
              icon={HeartHandshake}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy/40"
                aria-hidden
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff"
                aria-label="Search staff"
                className="min-h-10 w-full rounded-full border border-navy/15 bg-card pr-4 pl-9 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
              />
            </div>
            <ViewToggle mode={view} onChange={setView} />
          </div>
        </div>

        {groups.isLoading ? (
          <div className="ph-card p-5">
            <CardSkeleton lines={5} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="ph-card grid place-items-center p-10 text-center text-sm text-navy/60">
            No staff match that search.
          </div>
        ) : (
          filtered.map((group) => (
            <section key={group.org?.id ?? "unassigned"} className="ph-card overflow-hidden">
              <header className="flex flex-col gap-3 bg-navy p-5 text-cream sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream/15 text-cream">
                    {group.org ? (
                      <Building2 className="h-5 w-5" aria-hidden />
                    ) : (
                      <Users className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-[0.14em] text-amber uppercase">
                      {group.org ? `Organisation · ${group.org.kind}` : "Individual"}
                    </p>
                    <h2 className="mt-0.5 truncate text-lg font-bold">
                      {group.org?.name ?? "Individual families"}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-cream/70">
                      {group.org
                        ? `${group.org.licensesUsed}/${group.org.licenses} licenses used`
                        : "Direct family accounts"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-cream/15 px-3 py-1.5 text-[11px] font-bold whitespace-nowrap">
                  {group.members.filter((m) => m.role === "educator").length === 1
                    ? "1 Admin"
                    : `${group.members.filter((m) => m.role === "educator").length} Admins`}{" "}
                  ·{" "}
                  {group.members.filter((m) => m.role === "supporter").length === 1
                    ? "1 Moderator"
                    : `${group.members.filter((m) => m.role === "supporter").length} Moderators`}
                </span>
              </header>

              {group.members.length === 0 ? (
                <p className="p-5 text-sm text-navy/60">No staff accounts yet.</p>
              ) : view === "card" ? (
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {group.members.map((m) => (
                    <StaffCard
                      key={m.id}
                      member={m}
                      pending={toggle.isPending && toggle.variables === m.id}
                      onToggle={() => (m.active ? toggle.mutateAsync(m.id) : toggle.mutate(m.id))}
                      onViewActivation={() => regenerate.mutate(m.id)}
                      viewingActivation={regenerate.isPending && regenerate.variables === m.id}
                    />
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-navy/8 px-5">
                  {group.members.map((m) => (
                    <li
                      key={m.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"
                    >
                      <RoleIcon role={m.role} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{m.name}</span>
                        <span className="block truncate text-xs text-navy/55">
                          {m.email} · {m.role === "educator" ? "Admin" : "Moderator"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold">
                          {m.invitationPending
                            ? "Invite pending"
                            : m.active
                              ? "Active"
                              : "Disabled"}
                        </span>
                        {m.invitationPending ? (
                          <button
                            type="button"
                            onClick={() => regenerate.mutate(m.id)}
                            disabled={regenerate.isPending}
                            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-amber/55 px-3 text-[11px] font-bold disabled:opacity-50"
                          >
                            {regenerate.isPending && regenerate.variables === m.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <KeyRound className="h-3.5 w-3.5" aria-hidden />
                            )}
                            View activation link
                          </button>
                        ) : (
                          <ConfirmButton
                            confirmationTitle={`Disable ${m.name}?`}
                            confirmationMessage="This staff member will lose access. Their session history will remain saved."
                            confirmLabel="Disable account"
                            requireConfirmation={m.active}
                            type="button"
                            onClick={() =>
                              m.active ? toggle.mutateAsync(m.id) : toggle.mutate(m.id)
                            }
                            disabled={toggle.isPending}
                            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-navy/15 px-3 text-[11px] font-bold disabled:opacity-50"
                          >
                            <Power className="h-3.5 w-3.5" aria-hidden />
                            {m.active ? "Disable" : "Enable"}
                          </ConfirmButton>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </section>

      {regenerate.isError && (
        <p role="alert" className="mt-4 rounded-2xl bg-coral/10 p-3 text-sm text-coral">
          {regenerate.error instanceof Error
            ? regenerate.error.message
            : "Could not generate the activation link."}
        </p>
      )}

      {open && (
        <AddEducatorModal
          onClose={() => {
            setOpen(false);
            setCreatedAccess(null);
            setIsReplacementLink(false);
          }}
          name={name}
          email={email}
          orgId={orgId}
          errors={errors}
          orgs={orgs.data ?? []}
          pending={create.isPending}
          setName={setName}
          setEmail={setEmail}
          setOrgId={setOrgId}
          role={newRole}
          setRole={setNewRole}
          created={createdAccess}
          isReplacementLink={isReplacementLink}
          submitError={create.error instanceof Error ? create.error.message : ""}
          onSubmit={() => {
            const next: Record<string, string> = {};
            if (name.trim().length < 2) next["name"] = "Enter their name.";
            if (!/^\S+@\S+\.\S+$/.test(email)) next["email"] = "Enter a valid email address.";
            if (!orgId) next["orgId"] = "Choose an organisation.";
            setErrors(next);
            if (Object.keys(next).length === 0) create.mutate();
          }}
        />
      )}
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold tracking-[0.14em] text-amber uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Users;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-bold whitespace-nowrap transition-colors",
        active ? "bg-navy text-cream" : "bg-navy/6 text-navy/70 hover:bg-navy/12",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function RoleIcon({ role }: { role: StaffMember["role"] }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
        role === "educator" ? "bg-blue/12 text-blue" : "bg-coral/12 text-coral",
      )}
    >
      {role === "educator" ? (
        <GraduationCap className="h-5 w-5" aria-hidden />
      ) : (
        <HeartHandshake className="h-5 w-5" aria-hidden />
      )}
    </span>
  );
}

function StaffCard({
  member,
  pending,
  onToggle,
  onViewActivation,
  viewingActivation,
}: {
  member: StaffMember;
  pending: boolean;
  onToggle: () => void;
  onViewActivation: () => void;
  viewingActivation: boolean;
}) {
  return (
    <article className="rounded-2xl border border-navy/10 bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <RoleIcon role={member.role} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{member.name}</h3>
          <p className="truncate text-xs text-navy/55">{member.email}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold",
            member.role === "educator" ? "bg-blue/12 text-blue" : "bg-coral/12 text-coral",
          )}
        >
          {member.role === "educator" ? "Admin" : "Moderator"}
        </span>
        <span className="rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold">
          {member.childCount} children
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold",
            member.active ? "bg-amber/20 text-navy" : "bg-navy/8 text-navy/55",
          )}
        >
          {member.invitationPending ? "Invite pending" : member.active ? "Active" : "Disabled"}
        </span>
      </div>
      {member.invitationPending ? (
        <button
          type="button"
          onClick={onViewActivation}
          disabled={viewingActivation}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-amber/55 text-xs font-bold disabled:opacity-50"
        >
          {viewingActivation ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          View activation link
        </button>
      ) : (
        <ConfirmButton
          confirmationTitle={`Disable ${member.name}?`}
          confirmationMessage="This staff member will lose access. Their session history will remain saved."
          confirmLabel="Disable account"
          requireConfirmation={member.active}
          type="button"
          onClick={onToggle}
          disabled={pending}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-navy/15 text-xs font-bold disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Power className="h-4 w-4" aria-hidden />
          )}
          {member.active ? "Disable account" : "Enable account"}
        </ConfirmButton>
      )}
    </article>
  );
}

function AddEducatorModal({
  onClose,
  name,
  email,
  orgId,
  errors,
  orgs,
  pending,
  setName,
  setEmail,
  setOrgId,
  role,
  setRole,
  created,
  isReplacementLink,
  submitError,
  onSubmit,
}: {
  onClose: () => void;
  name: string;
  email: string;
  orgId: string;
  errors: Record<string, string>;
  orgs: Org[];
  pending: boolean;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setOrgId: (v: string) => void;
  role: "educator" | "supporter";
  setRole: (v: "educator" | "supporter") => void;
  created: StaffInvitationResult | null;
  isReplacementLink: boolean;
  submitError: string;
  onSubmit: () => void;
}) {
  const [copied, setCopied] = useState<"email" | "link" | "all" | null>(null);
  const activationLink = created?.credentials.acceptanceToken
    ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(created.credentials.acceptanceToken)}`
    : null;

  const copy = async (value: string, field: "email" | "link" | "all") => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-educator-title"
        onClick={onClose}
      >
        <div
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue/12 text-blue">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="add-educator-title" className="text-lg font-bold">
                  {created
                    ? isReplacementLink
                      ? "Activation link ready"
                      : "Credentials ready"
                    : `Add ${role === "supporter" ? "a Moderator" : "an Admin"}`}
                </h2>
                <p className="text-xs text-navy/55">
                  {created
                    ? `${created.member.name} can now activate their account. We’ve also emailed them the link.`
                    : role === "supporter"
                      ? "Moderators record check-ins for the members assigned to them."
                      : "Admins enrol members, invite members and log attempts."}
                </p>
              </div>
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

          {created ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-blue/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-blue">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {isReplacementLink
                    ? "New activation link generated"
                    : "Account invitation created"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-navy/65">
                  {isReplacementLink
                    ? "Share this fresh one-time link securely. Any previous activation link for this account no longer works."
                    : "Share this one-time activation link securely. The recipient will choose their own password, so Play Hub never displays or stores a readable password."}
                </p>
              </div>

              <CredentialRow
                label="Sign-in email"
                value={created.credentials.email}
                copied={copied === "email"}
                onCopy={() => copy(created.credentials.email, "email")}
              />
              {activationLink ? (
                <CredentialRow
                  label="One-time activation link"
                  value={activationLink}
                  copied={copied === "link"}
                  onCopy={() => copy(activationLink, "link")}
                />
              ) : (
                <div className="rounded-2xl border border-amber/40 bg-amber/10 p-4 text-xs text-navy/70">
                  The invitation was created, but this environment did not return an activation
                  link. Use the configured email delivery service.
                </div>
              )}

              <p className="text-xs text-navy/55">
                Link expires {fmtDateTime(created.credentials.expiresAt)} and can be used only once.
              </p>

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-12 rounded-full bg-navy/6 px-6 text-sm font-bold text-navy hover:bg-navy/12"
                >
                  Done
                </button>
                {activationLink && (
                  <button
                    type="button"
                    onClick={() =>
                      copy(
                        `Play Hub account\nEmail: ${created.credentials.email}\nActivate: ${activationLink}`,
                        "all",
                      )
                    }
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-white"
                  >
                    {copied === "all" ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <KeyRound className="h-4 w-4" aria-hidden />
                    )}
                    {copied === "all" ? "Copied" : "Copy credentials"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <fieldset>
                <legend className="text-sm font-bold">Role</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["educator", "Admin", GraduationCap],
                      ["supporter", "Moderator", HeartHandshake],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      aria-pressed={role === value}
                      className={cn(
                        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition-colors",
                        role === value
                          ? "border-blue bg-blue/10 text-blue"
                          : "border-navy/15 hover:border-navy/35",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden /> {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="edu-name" className="text-sm font-bold">
                  Full name
                </label>
                <input
                  id="edu-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
                />
                {errors["name"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["name"]}</p>
                )}
              </div>
              <div>
                <label htmlFor="edu-email" className="text-sm font-bold">
                  Email
                </label>
                <input
                  id="edu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
                />
                {errors["email"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["email"]}</p>
                )}
              </div>
              <div>
                <label htmlFor="edu-org" className="text-sm font-bold">
                  Organisation
                </label>
                <Select
                  id="edu-org"
                  value={orgId}
                  onChange={setOrgId}
                  options={orgs.map((o) => ({ value: o.id, label: o.name }))}
                  className="mt-2"
                />
                {errors["orgId"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["orgId"]}</p>
                )}
              </div>
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
                  disabled={pending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                  Add {role === "supporter" ? "Moderator" : "Admin"}
                </button>
              </div>
              {submitError && (
                <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral">
                  {submitError}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-navy/3 p-4">
      <p className="text-[10px] font-bold tracking-[0.14em] text-navy/50 uppercase">{label}</p>
      <div className="mt-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 font-mono text-xs leading-relaxed break-all text-navy">
          {value}
        </p>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-navy shadow-sm"
        >
          {copied ? (
            <Check className="h-4 w-4 text-blue" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
