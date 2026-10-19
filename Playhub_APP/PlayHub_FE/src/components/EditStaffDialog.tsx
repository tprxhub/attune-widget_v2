import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { updateAccountDetails } from "@/api/admin";
import { useSession } from "@/auth/session";
import { ModalPortal } from "@/components/ModalPortal";

const editInput =
  "mt-1.5 min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25";

/**
 * Correct a staff member's name, and (Super Admin only) their sign-in email. Used for Admins and
 * Moderators on the Super Admin's staff page and for Moderators on an organisation's Team page.
 */
export function EditStaffDialog({
  member,
  roleLabel,
  onClose,
  onSaved,
}: {
  member: { id: string; name: string; email: string };
  roleLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useSession();
  // Only a Super Admin may change a sign-in email; everyone else can correct the name.
  const canChangeEmail = session.role === "super_admin";
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () =>
      updateAccountDetails(member.id, {
        name: name.trim(),
        email: canChangeEmail ? email.trim() : member.email,
      }),
    onSuccess: onSaved,
    onError: (reason: Error) => setError(reason.message),
  });
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${roleLabel}`}
          className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Edit {roleLabel}</h2>
              <p className="truncate text-xs text-navy/55">{member.email}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/6 hover:bg-navy/12"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <form
            className="mt-4 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2) return setError("Enter their full name.");
              if (!/^\S+@\S+\.\S+$/.test(email.trim()))
                return setError("Enter a valid email address.");
              setError("");
              save.mutate();
            }}
          >
            <label className="block text-sm font-bold">
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} className={editInput} />
            </label>
            <label className="block text-sm font-bold">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={editInput}
                disabled={!canChangeEmail}
              />
              <span className="mt-1 block text-xs font-normal text-navy/55">
                {canChangeEmail
                  ? "They sign in with this email."
                  : "Only a Super Admin can change a sign-in email."}
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-coral">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Save changes
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
        </div>
      </div>
    </ModalPortal>
  );
}
