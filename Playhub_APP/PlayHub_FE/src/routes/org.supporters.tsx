import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  HeartHandshake,
  KeyRound,
  Loader2,
  Mail,
  Power,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  createSupporter,
  getOrg,
  listSupporters,
  regenerateSupporterActivation,
  toggleSupporterActive,
} from "@/api/org";
import type { StaffInvitationResult } from "@/api/admin";
import { ModalPortal } from "@/components/ModalPortal";
import { listChildrenForSession } from "@/api/children";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Child, StaffMember } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/org/supporters")({
  head: () => ({
    meta: [
      { title: "Moderators — Play Hub for schools & clinics" },
      {
        name: "description",
        content:
          "Admins add Moderators to their organisation so they can log sessions for assigned members.",
      },
      { property: "og:title", content: "Moderators — Play Hub for schools & clinics" },
      {
        property: "og:description",
        content: "Add, assign and disable Moderators in your organisation.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["educator"]} accountTypes={["b2b"]}>
      <OrgSupporters />
    </Protected>
  ),
});

function OrgSupporters() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reissuedCredentials, setReissuedCredentials] = useState<StaffInvitationResult | null>(
    null,
  );
  const [view, setView] = useViewMode("supporters");

  const supporters = useQuery({
    queryKey: ["supporters", session.orgId],
    queryFn: () => listSupporters(session.orgId),
  });
  const kids = useQuery({
    queryKey: ["children", session.personaId],
    queryFn: () => listChildrenForSession(session),
  });
  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });

  const list = supporters.data ?? [];
  const children = kids.data ?? [];
  const activeCount = list.filter((s) => s.active).length;
  const assignedChildren = children.filter((c) => c.supporterId).length;

  const toggle = useMutation({
    mutationFn: (id: string) => toggleSupporterActive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supporters"] }),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => regenerateSupporterActivation(id),
    onSuccess: (result) => {
      setReissuedCredentials(result);
      setOpen(true);
    },
  });

  const closeModal = () => {
    setOpen(false);
    setReissuedCredentials(null);
  };

  return (
    <>
      <PageHeader
        eyebrow={org.data ? `${org.data.name} · Team` : "Your team"}
        title="Moderators"
        description="Moderators log sessions and read Play Plans for the members you assign them — they can't enrol members or see billing."
        actions={
          <button
            type="button"
            onClick={() => {
              setReissuedCredentials(null);
              setOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" aria-hidden /> Add a Moderator
          </button>
        }
      />

      {list.length > 0 && (
        <div className="ph-card mt-1 grid gap-4 bg-navy p-5 text-cream sm:grid-cols-3">
          <Stat label="Moderators" value={list.length} />
          <Stat label="Active accounts" value={`${activeCount} / ${list.length}`} />
          <Stat
            label="Members with a Moderator"
            value={`${assignedChildren} / ${children.length}`}
          />
        </div>
      )}

      {supporters.isLoading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : list.length === 0 ? (
        <div className="ph-card mt-5 p-10 text-center">
          <HeartHandshake className="mx-auto h-9 w-9 text-navy/35" aria-hidden />
          <p className="mt-3 text-lg font-bold">No Moderators yet</p>
          <p className="mt-2 text-sm text-navy/65">
            Add your first Moderator to share the logging load.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
              {list.length} Moderator{list.length === 1 ? "" : "s"}
            </p>
            <ViewToggle mode={view} onChange={setView} />
          </div>

          {view === "card" ? (
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((s) => (
                <SupporterCard
                  key={s.id}
                  member={s}
                  assigned={children.filter((c) => c.supporterId === s.id)}
                  onToggle={() => toggle.mutate(s.id)}
                  busy={toggle.isPending && toggle.variables === s.id}
                  onGenerateLink={() => regenerate.mutate(s.id)}
                  generatingLink={regenerate.isPending && regenerate.variables === s.id}
                />
              ))}
            </div>
          ) : (
            <ul className="ph-card mt-3 divide-y divide-navy/8 p-0">
              {list.map((s) => {
                const assigned = children.filter((c) => c.supporterId === s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber/25 text-navy">
                      <HeartHandshake className="h-4.5 w-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-navy">{s.name}</span>
                      <span className="block truncate text-xs text-navy/55">{s.email}</span>
                    </span>
                    <span className="hidden min-w-0 flex-1 truncate text-xs text-navy/60 lg:block">
                      {assigned.length
                        ? assigned.map((c) => c.name).join(", ")
                        : "No children assigned"}
                    </span>
                    <span className="shrink-0 rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold text-navy/70">
                      {assigned.length} assigned
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        s.invitationPending
                          ? "bg-amber/25 text-navy"
                          : s.active
                            ? "bg-blue/12 text-blue"
                            : "bg-coral/12 text-coral",
                      )}
                    >
                      {s.invitationPending ? "Pending" : s.active ? "Active" : "Disabled"}
                    </span>
                    {s.invitationPending ? (
                      <button
                        type="button"
                        onClick={() => regenerate.mutate(s.id)}
                        disabled={regenerate.isPending}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-amber/45 px-4 text-xs font-bold text-navy hover:border-amber disabled:opacity-60"
                      >
                        {regenerate.isPending && regenerate.variables === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <KeyRound className="h-3.5 w-3.5" aria-hidden />
                        )}
                        View activation link
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle.mutate(s.id)}
                        disabled={toggle.isPending && toggle.variables === s.id}
                        className={cn(
                          "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-xs font-bold disabled:opacity-60",
                          s.active
                            ? "border-coral/30 text-coral hover:border-coral"
                            : "border-blue/30 text-blue hover:border-blue",
                        )}
                      >
                        {toggle.isPending && toggle.variables === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : s.active ? (
                          <Power className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {s.active ? "Disable" : "Enable"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {regenerate.isError && (
        <p role="alert" className="mt-4 rounded-2xl bg-coral/10 p-3 text-sm text-coral">
          {regenerate.error instanceof Error
            ? regenerate.error.message
            : "Could not generate a new login link."}
        </p>
      )}

      {open && (
        <AddSupporterModal
          kids={children}
          initialCredentials={reissuedCredentials}
          onClose={closeModal}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.14em] text-cream/60 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-amber">{value}</p>
    </div>
  );
}

function SupporterCard({
  member,
  assigned,
  onToggle,
  busy,
  onGenerateLink,
  generatingLink,
}: {
  member: StaffMember;
  assigned: Child[];
  onToggle: () => void;
  busy: boolean;
  onGenerateLink: () => void;
  generatingLink: boolean;
}) {
  return (
    <article
      className={cn("ph-card flex flex-col p-5 transition-opacity", !member.active && "opacity-70")}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber/25 text-navy">
          <HeartHandshake className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-navy">{member.name}</h2>
          <p className="flex items-center gap-1.5 truncate text-xs text-navy/55">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{member.email}</span>
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
            member.invitationPending
              ? "bg-amber/25 text-navy"
              : member.active
                ? "bg-blue/12 text-blue"
                : "bg-coral/12 text-coral",
          )}
        >
          {member.invitationPending ? "Pending" : member.active ? "Active" : "Disabled"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-navy/4 p-3">
          <dt className="font-bold tracking-wide text-navy/45 uppercase">Assigned</dt>
          <dd className="mt-0.5 text-2xl font-bold text-navy">{assigned.length}</dd>
        </div>
        <div className="rounded-2xl bg-navy/4 p-3">
          <dt className="font-bold tracking-wide text-navy/45 uppercase">Added</dt>
          <dd className="mt-0.5 text-sm font-bold text-navy">{fmtDate(member.createdAt)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-navy/60">
        {assigned.length ? (
          <>
            Children:{" "}
            <span className="font-bold text-navy">{assigned.map((c) => c.name).join(", ")}</span>
          </>
        ) : (
          "No children assigned yet — assign them on the Children page."
        )}
      </p>

      {member.invitationPending ? (
        <button
          type="button"
          onClick={onGenerateLink}
          disabled={generatingLink}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-amber/45 px-5 text-sm font-bold text-navy transition-colors hover:border-amber disabled:opacity-60"
        >
          {generatingLink ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          View activation link
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className={cn(
            "mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 px-5 text-sm font-bold transition-colors disabled:opacity-60",
            member.active
              ? "border-coral/30 text-coral hover:border-coral"
              : "border-blue/30 text-blue hover:border-blue",
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : member.active ? (
            <Power className="h-4 w-4" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
          {member.active ? "Disable account" : "Re-enable account"}
        </button>
      )}
    </article>
  );
}

function AddSupporterModal({
  kids,
  initialCredentials,
  onClose,
}: {
  kids: Child[];
  initialCredentials: StaffInvitationResult | null;
  onClose: () => void;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [childId, setChildId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<"email" | "link" | "all" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = useMutation({
    mutationFn: async () => {
      const member = await createSupporter({
        name: name.trim(),
        email: email.trim(),
        orgId: session.orgId,
        childId: childId || undefined,
      });
      return member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supporters"] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
    },
  });

  const created = initialCredentials ?? create.data;
  const isReplacementLink = Boolean(initialCredentials);
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
      <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 sm:place-items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-supporter-title"
          className="ph-card max-h-[92vh] w-full overflow-y-auto p-5 sm:max-w-lg sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="add-supporter-title" className="text-xl font-bold">
                {created
                  ? isReplacementLink
                    ? "Activation link ready"
                    : "Moderator login ready"
                  : "Add a Moderator"}
              </h2>
              <p className="mt-1 text-sm text-navy/65">
                {created
                  ? `${created.member.name} can activate their account with the link below.`
                  : "They can log sessions for the members you assign them."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/6 text-navy hover:bg-navy/12"
            >
              <X className="h-4.5 w-4.5" aria-hidden />
            </button>
          </div>

          {created ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-blue/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-blue">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {isReplacementLink
                    ? "New activation link generated"
                    : "Moderator invitation created"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-navy/65">
                  {isReplacementLink
                    ? "Share this fresh one-time link securely. Any previous activation link for this account no longer works."
                    : "Share this one-time activation link securely. The Moderator chooses their own password, and their account stays pending until they activate it."}
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
                <p className="rounded-2xl border border-amber/40 bg-amber/10 p-4 text-xs text-navy/70">
                  The invitation was saved, but this environment did not return an activation link.
                </p>
              )}

              <p className="text-xs text-navy/55">
                Link expires {fmtDateTime(created.credentials.expiresAt)} and can be used only once.
              </p>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
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
                        `Play Hub Moderator account\nEmail: ${created.credentials.email}\nActivate: ${activationLink}`,
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
                    {copied === "all" ? "Copied" : "Copy login details"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const next: Record<string, string> = {};
                if (name.trim().length < 2) next["name"] = "Enter their name.";
                if (!/^\S+@\S+\.\S+$/.test(email)) next["email"] = "Enter a valid email address.";
                setErrors(next);
                if (Object.keys(next).length === 0) create.mutate();
              }}
            >
              <div>
                <label htmlFor="sup-name" className="text-sm font-bold">
                  Full name
                </label>
                <input
                  id="sup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Raman"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
                />
                {errors["name"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["name"]}</p>
                )}
              </div>
              <div>
                <label htmlFor="sup-email" className="text-sm font-bold">
                  Email
                </label>
                <input
                  id="sup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="moderator@example.com"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
                />
                {errors["email"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["email"]}</p>
                )}
              </div>
              <div>
                <label htmlFor="sup-child" className="text-sm font-bold">
                  Assign a child <span className="font-normal text-navy/50">(optional)</span>
                </label>
                <p className="text-xs text-navy/60">
                  You can also assign children later on the Children page.
                </p>
                <Select
                  id="sup-child"
                  value={childId}
                  onChange={setChildId}
                  options={[
                    { value: "", label: "No child for now" },
                    ...kids.map((c) => ({ value: c.id, label: `${c.name} · Age ${c.age}` })),
                  ]}
                  className="mt-2"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={create.isPending || create.isSuccess}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
                >
                  {create.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="h-4 w-4" aria-hidden />
                  )}
                  Add Moderator
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-12 flex-1 rounded-full border-2 border-navy/15 px-6 text-sm font-bold text-navy hover:border-navy/40"
                >
                  Cancel
                </button>
              </div>

              {create.isError && (
                <p
                  role="alert"
                  className="rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-coral"
                >
                  {create.error instanceof Error
                    ? create.error.message
                    : "Could not create the Moderator invitation."}
                </p>
              )}
            </form>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-navy/4 p-3 text-xs text-navy/65">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-navy/45" aria-hidden />
            Moderators never see billing or enrolment. You can disable their account at any time
            from their card.
          </p>
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
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/7 text-navy hover:bg-navy/12"
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
