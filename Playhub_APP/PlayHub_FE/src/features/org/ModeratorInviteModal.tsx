import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, KeyRound, Loader2, UserPlus, X, Info } from "lucide-react";
import { createSupporter, editSupporterInvitation } from "@/api/org";
import type { StaffInvitationResult } from "@/api/admin";
import { ModalPortal } from "@/components/ModalPortal";
import { useSession } from "@/auth/session";
import { Select } from "@/components/Select";
import type { Child, StaffMember } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

function ModeratorInvitationResult({
  created,
  isReplacementLink,
  isEdited,
  kids,
  onUpdated,
  onClose,
}: {
  created: StaffInvitationResult;
  isReplacementLink: boolean;
  isEdited: boolean;
  kids: Child[];
  onUpdated: (result: StaffInvitationResult) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<"email" | "link" | "all" | null>(null);
  const activationLink = created.credentials.acceptanceToken
    ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(created.credentials.acceptanceToken)}`
    : null;
  const edit = useMutation({
    mutationFn: (input: { name: string; email: string; childId?: string }) =>
      editSupporterInvitation(created.member.id, input),
    onSuccess: (result) => {
      onUpdated(result);
      setEditing(false);
      setCopied(null);
      queryClient.invalidateQueries({ queryKey: ["supporters"] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
    },
  });
  const copy = async (value: string, field: "email" | "link" | "all") => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 1800);
  };

  if (editing) {
    return (
      <EditModeratorInvitationForm
        member={created.member}
        email={created.credentials.email}
        kids={kids}
        pending={edit.isPending}
        error={
          edit.isError
            ? edit.error instanceof Error
              ? edit.error.message
              : "Could not update and resend the Moderator invitation."
            : undefined
        }
        onCancel={() => {
          setEditing(false);
          edit.reset();
        }}
        onSubmit={(input) => edit.mutate(input)}
      />
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl bg-blue/10 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-blue">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {isEdited
            ? "Moderator details updated"
            : isReplacementLink
              ? "New activation link generated"
              : "Moderator invitation created"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-navy/65">
          {isEdited
            ? "The old link has expired. A fresh one-time link was emailed to the corrected address."
            : isReplacementLink
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

      <div className="grid gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <button
          type="button"
          onClick={() => {
            edit.reset();
            setEditing(true);
          }}
          className="min-h-12 whitespace-nowrap rounded-full border-2 border-amber/45 px-4 text-sm font-bold text-navy hover:border-amber"
        >
          Edit & resend
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 whitespace-nowrap rounded-full bg-navy/6 px-5 text-sm font-bold text-navy hover:bg-navy/12"
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
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-navy px-5 text-sm font-bold text-white"
          >
            {copied === "all" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {copied === "all" ? "Copied" : "Copy details"}
          </button>
        )}
      </div>
    </div>
  );
}

function EditModeratorInvitationForm({
  member,
  email: initialEmail,
  kids,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  member: StaffMember;
  email: string;
  kids: Child[];
  pending: boolean;
  error?: string | undefined;
  onCancel: () => void;
  onSubmit: (input: { name: string; email: string; childId?: string }) => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(initialEmail);
  const [childId, setChildId] = useState(member.childIds?.[0] ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (name.trim().length < 2) next["name"] = "Enter their name.";
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) next["email"] = "Enter a valid email address.";
        setErrors(next);
        if (!Object.keys(next).length) {
          onSubmit({ name: name.trim(), email: email.trim(), ...(childId ? { childId } : {}) });
        }
      }}
    >
      <div className="rounded-2xl border border-amber/50 bg-amber/10 p-4 text-sm text-navy/75">
        Saving these changes expires the old link, creates a fresh 7-day link, and emails it to the
        corrected address.
      </div>
      <div>
        <label htmlFor="sup-edit-name" className="text-sm font-bold">
          Full name
        </label>
        <input
          id="sup-edit-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
        />
        {errors["name"] && (
          <p className="mt-1.5 text-xs font-semibold text-coral">{errors["name"]}</p>
        )}
      </div>
      <div>
        <label htmlFor="sup-edit-email" className="text-sm font-bold">
          Email
        </label>
        <input
          id="sup-edit-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
        />
        {errors["email"] && (
          <p className="mt-1.5 text-xs font-semibold text-coral">{errors["email"]}</p>
        )}
      </div>
      <div>
        <label htmlFor="sup-edit-child" className="text-sm font-bold">
          Assign a member <span className="font-normal text-navy/50">(optional)</span>
        </label>
        <Select
          id="sup-edit-child"
          value={childId}
          onChange={setChildId}
          options={[
            { value: "", label: "No member for now" },
            ...kids.map((child) => ({
              value: child.id,
              label: `${child.name} · Age ${child.age}`,
            })),
          ]}
          className="mt-2"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-coral">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="min-h-12 rounded-full border-2 border-navy/15 px-6 text-sm font-bold text-navy hover:border-navy/40 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Updating & emailing…" : "Update & email new link"}
        </button>
      </div>
    </form>
  );
}

function PendingModeratorInvitationEdit({
  member,
  kids,
  onCancel,
  onUpdated,
}: {
  member: StaffMember;
  kids: Child[];
  onCancel: () => void;
  onUpdated: (result: StaffInvitationResult) => void;
}) {
  const queryClient = useQueryClient();
  const edit = useMutation({
    mutationFn: (input: { name: string; email: string; childId?: string }) =>
      editSupporterInvitation(member.id, input),
    onSuccess: (result) => {
      onUpdated(result);
      queryClient.invalidateQueries({ queryKey: ["supporters"] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
    },
  });

  return (
    <EditModeratorInvitationForm
      member={member}
      email={member.email}
      kids={kids}
      pending={edit.isPending}
      error={
        edit.isError
          ? edit.error instanceof Error
            ? edit.error.message
            : "Could not update and resend the Moderator invitation."
          : undefined
      }
      onCancel={onCancel}
      onSubmit={(input) => edit.mutate(input)}
    />
  );
}

/**
 * Add a Moderator (or correct a pending invitation): name, email and optionally the member they
 * support. Used on the Moderators page, and from a member's card when they have no Moderator.
 */
export function AddSupporterModal({
  kids,
  initialCredentials = null,
  initialMember = null,
  orgId,
  initialChildId = "",
  onClose,
}: {
  kids: Child[];
  initialCredentials?: StaffInvitationResult | null;
  initialMember?: StaffMember | null;
  /** The organisation the Moderator joins; the signed-in Admin's own when left out. */
  orgId?: string | undefined;
  /** A member to assign straight away. */
  initialChildId?: string;
  onClose: () => void;
}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [childId, setChildId] = useState(initialChildId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [updatedCredentials, setUpdatedCredentials] = useState<StaffInvitationResult | null>(null);

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
        orgId: orgId ?? session.orgId,
        childId: childId || undefined,
      });
      return member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supporters"] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
    },
  });

  const created = updatedCredentials ?? initialCredentials ?? create.data;
  const isReplacementLink = Boolean(initialCredentials || updatedCredentials);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 sm:place-items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-supporter-title"
          className="ph-card max-h-[92dvh] w-full overflow-y-auto p-5 sm:max-w-lg sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="add-supporter-title" className="text-xl font-bold">
                {created
                  ? isReplacementLink
                    ? "Activation link ready"
                    : "Moderator login ready"
                  : initialMember
                    ? "Edit Moderator invitation"
                    : "Add a Moderator"}
              </h2>
              <p className="mt-1 text-sm text-navy/65">
                {created
                  ? `We’ve emailed the activation link to ${created.credentials.email}. You can also share it yourself.`
                  : initialMember
                    ? `Correct ${initialMember.name}’s details and send a fresh activation link.`
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
            <ModeratorInvitationResult
              key={created.member.id}
              created={created}
              isReplacementLink={isReplacementLink}
              isEdited={Boolean(updatedCredentials)}
              kids={kids}
              onUpdated={setUpdatedCredentials}
              onClose={onClose}
            />
          ) : initialMember ? (
            <PendingModeratorInvitationEdit
              member={initialMember}
              kids={kids}
              onCancel={onClose}
              onUpdated={setUpdatedCredentials}
            />
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
                  Assign a member <span className="font-normal text-navy/50">(optional)</span>
                </label>
                <p className="text-xs text-navy/60">
                  You can also assign members later on the Members page.
                </p>
                <Select
                  id="sup-child"
                  value={childId}
                  onChange={setChildId}
                  options={[
                    { value: "", label: "No member for now" },
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
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy/45" aria-hidden />
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
