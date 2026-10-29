import { useState } from "react";
import { EditStaffDialog } from "@/components/EditStaffDialog";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HeartHandshake,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Power,
  Trash2,
  UserPlus,
  CircleCheck,
} from "lucide-react";
import {
  deleteSupporterInvitation,
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
import { LicenceLimitModal, OrgLicenseNote } from "@/components/OrgLicenseNote";
import { licencesFull } from "@/lib/licences";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Child, StaffMember } from "@/lib/types";
import { AddSupporterModal } from "@/features/org/ModeratorInviteModal";

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
  const [disabling, setDisabling] = useState<StaffMember | null>(null);
  const [deletingInvitation, setDeletingInvitation] = useState<StaffMember | null>(null);
  const [reissuedCredentials, setReissuedCredentials] = useState<StaffInvitationResult | null>(
    null,
  );
  const [editingInvitation, setEditingInvitation] = useState<StaffMember | null>(null);
  const [editingModerator, setEditingModerator] = useState<StaffMember | null>(null);
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
  const assignedChildren = children.filter((c) => c.supporterIds.length).length;

  const toggle = useMutation({
    mutationFn: (id: string) => toggleSupporterActive(id),
    onSuccess: () => {
      setDisabling(null);
      return queryClient.invalidateQueries({ queryKey: ["supporters"] });
    },
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => regenerateSupporterActivation(id),
    onSuccess: (result) => {
      setReissuedCredentials(result);
      setOpen(true);
    },
  });

  const removeInvitation = useMutation({
    mutationFn: (id: string) => deleteSupporterInvitation(id),
    onSuccess: async () => {
      setDeletingInvitation(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supporters"] }),
        queryClient.invalidateQueries({ queryKey: ["org"] }),
      ]);
    },
  });

  const [limitOpen, setLimitOpen] = useState(false);

  const closeModal = () => {
    setOpen(false);
    setReissuedCredentials(null);
    setEditingInvitation(null);
  };

  return (
    <>
      {deletingInvitation && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 grid place-items-center bg-navy/45 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-invitation-title"
              className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral/10 text-coral">
                  <Trash2 className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 id="delete-invitation-title" className="text-xl font-bold text-navy">
                    Delete pending invitation?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-navy/70">
                    This permanently removes {deletingInvitation.name}’s unactivated invitation and
                    invalidates its link. You can invite them again later.
                  </p>
                </div>
              </div>
              {removeInvitation.isError && (
                <p role="alert" className="mt-4 rounded-2xl bg-coral/10 p-3 text-sm text-coral">
                  {removeInvitation.error instanceof Error
                    ? removeInvitation.error.message
                    : "Could not delete this invitation."}
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={removeInvitation.isPending}
                  onClick={() => {
                    setDeletingInvitation(null);
                    removeInvitation.reset();
                  }}
                  className="min-h-11 rounded-full bg-navy/6 px-5 text-sm font-bold text-navy hover:bg-navy/12 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={removeInvitation.isPending}
                  onClick={() => removeInvitation.mutate(deletingInvitation.id)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white hover:bg-coral/90 disabled:opacity-60"
                >
                  {removeInvitation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  {removeInvitation.isPending ? "Deleting…" : "Delete invitation"}
                </button>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
      {disabling && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 grid place-items-center bg-navy/45 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="disable-moderator-title"
              className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-card p-6 shadow-xl"
            >
              <h2 id="disable-moderator-title" className="text-xl font-bold">
                Disable {disabling.name}?
              </h2>
              <p className="mt-3 text-sm text-navy/70">
                They will lose access to Play Hub and their assigned members. Their session history
                will remain. You can re-enable the account later.
              </p>
              {toggle.isError && (
                <p role="alert" className="mt-3 text-sm text-coral">
                  {toggle.error instanceof Error
                    ? toggle.error.message
                    : "Could not disable this account."}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => {
                    setDisabling(null);
                    toggle.reset();
                  }}
                  className="rounded-full border border-navy/20 px-4 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(disabling.id)}
                  className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white"
                >
                  {toggle.isPending ? "Disabling…" : "Disable account"}
                </button>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
      <PageHeader
        eyebrow={org.data ? `${org.data.name} · Team` : "Your team"}
        title="Moderators"
        description="Moderators log sessions and read Play Plans for the members you assign them — they can't enrol members or see billing."
        actions={
          <button
            type="button"
            onClick={() => {
              if (licencesFull(org.data, "moderators")) {
                setLimitOpen(true);
                return;
              }
              setReissuedCredentials(null);
              setEditingInvitation(null);
              setOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-4 w-4" aria-hidden /> Add a Moderator
          </button>
        }
      />
      <OrgLicenseNote org={org.data} kind="moderators" />
      <p className="mt-3 text-sm text-navy/65">
        You can add up to 2 Moderators per active member. Active accounts and pending invitations
        count towards this limit.
      </p>
      {limitOpen && org.data && (
        <LicenceLimitModal org={org.data} kind="moderators" onClose={() => setLimitOpen(false)} />
      )}

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
                  assigned={children.filter((c) => c.supporterIds.includes(s.id))}
                  onToggle={() => (s.active ? setDisabling(s) : toggle.mutate(s.id))}
                  busy={toggle.isPending && toggle.variables === s.id}
                  onGenerateLink={() => regenerate.mutate(s.id)}
                  generatingLink={regenerate.isPending && regenerate.variables === s.id}
                  onEditInvitation={() => {
                    setReissuedCredentials(null);
                    setEditingInvitation(s);
                    setOpen(true);
                  }}
                  onDeleteInvitation={() => setDeletingInvitation(s)}
                  onEdit={() => setEditingModerator(s)}
                />
              ))}
            </div>
          ) : (
            <ul className="ph-card mt-3 divide-y divide-navy/8 p-0">
              {list.map((s) => {
                const assigned = children.filter((c) => c.supporterIds.includes(s.id));
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
                        : "No members assigned"}
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
                      <>
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
                          Resend activation link
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingInvitation(s)}
                          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-coral/25 px-4 text-xs font-bold text-coral hover:border-coral"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Delete invite
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingModerator(s)}
                          aria-label={`Edit ${s.name}`}
                          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 px-2 text-xs font-bold text-blue hover:underline"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => (s.active ? setDisabling(s) : toggle.mutate(s.id))}
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
                            <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {s.active ? "Disable" : "Enable"}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {editingModerator && (
        <EditStaffDialog
          member={editingModerator}
          roleLabel="Moderator"
          onClose={() => setEditingModerator(null)}
          onSaved={() => {
            setEditingModerator(null);
            void queryClient.invalidateQueries({ queryKey: ["supporters"] });
            void queryClient.invalidateQueries({ queryKey: ["children"] });
          }}
        />
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
          initialMember={editingInvitation}
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
  onEditInvitation,
  onDeleteInvitation,
  onEdit,
}: {
  member: StaffMember;
  assigned: Child[];
  onToggle: () => void;
  busy: boolean;
  onGenerateLink: () => void;
  generatingLink: boolean;
  onEditInvitation: () => void;
  onDeleteInvitation: () => void;
  onEdit: () => void;
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
          {!member.invitationPending && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${member.name}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue hover:underline"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          )}
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
            Members:{" "}
            <span className="font-bold text-navy">{assigned.map((c) => c.name).join(", ")}</span>
          </>
        ) : (
          "No members assigned yet — assign them on the Members page."
        )}
      </p>

      {member.invitationPending ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onEditInvitation}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-amber/45 px-4 text-sm font-bold text-navy transition-colors hover:border-amber"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit & resend
          </button>
          <button
            type="button"
            onClick={onGenerateLink}
            disabled={generatingLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-navy px-4 text-sm font-bold text-white transition-colors hover:bg-blue disabled:opacity-60"
          >
            {generatingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            Resend link
          </button>
          <button
            type="button"
            onClick={onDeleteInvitation}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-coral/25 px-4 text-sm font-semibold text-coral transition-colors hover:border-coral hover:bg-coral/5 sm:col-span-2"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete pending invitation
          </button>
        </div>
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
            <CircleCheck className="h-4 w-4" aria-hidden />
          )}
          {member.active ? "Disable account" : "Re-enable account"}
        </button>
      )}
    </article>
  );
}
