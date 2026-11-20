import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Eye, EyeOff, Loader2, PowerOff, X } from "lucide-react";
import { deactivateMyAccount } from "@/api/account";
import { useSession } from "@/auth/session";
import { ModalPortal } from "@/components/ModalPortal";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full min-h-12 rounded-xl border border-navy/15 bg-card px-4 text-sm text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25";

const WHAT_HAPPENS = [
  "You're signed out everywhere, and your Moderators can't open your child's profile.",
  "Nothing is deleted: Play Plans, Sessions and progress are all kept.",
  "We stop sending you emails.",
  "A subscription keeps counting down while the account is off.",
  "To come back, just log in and choose Reactivate.",
];

/**
 * "Deactivate account" on the Account page: switch the account off without deleting anything.
 * Confirmed with the password; an account that signs in with Google, Apple or Microsoft ticks a box.
 */
export function DeactivateAccount() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [noPassword, setNoPassword] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setPassword("");
    setNoPassword(false);
    setReason("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noPassword && !password) return setError("Enter your password to confirm.");
    setPending(true);
    setError(null);
    try {
      await deactivateMyAccount({
        password: noPassword ? undefined : password,
        confirm: noPassword,
        reason,
      });
      signOut();
      await navigate({ to: "/login", search: { deactivated: true } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your account couldn't be deactivated.");
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-w-0 items-center gap-3 rounded-2xl border border-navy/12 bg-card p-3.5 text-left transition hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-[var(--shadow-card)]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/6 text-navy/70">
          <PowerOff className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">Deactivate account</span>
          <span className="block truncate text-xs text-navy/60">
            Take a break; nothing is deleted
          </span>
        </span>
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy/45 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
            onClick={(event) => event.target === event.currentTarget && close()}
          >
            <form
              onSubmit={(event) => void submit(event)}
              noValidate
              className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md min-w-0 space-y-4 overflow-y-auto rounded-3xl bg-card p-5 shadow-[0_28px_70px_-20px_rgba(15,42,74,0.5)] sm:p-6"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy/8 text-navy">
                  <PowerOff className="h-4.5 w-4.5" aria-hidden />
                </span>
                <h2
                  id="deactivate-title"
                  className="min-w-0 flex-1 text-lg leading-tight font-bold"
                >
                  Deactivate your account?
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-navy/55 transition hover:bg-navy/6 hover:text-navy"
                >
                  <X className="h-4.5 w-4.5" aria-hidden />
                </button>
              </div>

              <ul className="grid gap-2 rounded-2xl bg-navy/[0.04] p-4">
                {WHAT_HAPPENS.map((line) => (
                  <li key={line} className="flex gap-2 text-sm leading-relaxed text-navy/80">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-blue" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>

              {!noPassword && (
                <div>
                  <label htmlFor="deactivate-password" className="text-sm font-bold">
                    Your password
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="deactivate-password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={cn(inputCls, "pr-12")}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((value) => !value)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-navy/55 hover:bg-navy/6 hover:text-navy"
                    >
                      {show ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              )}
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-navy/75">
                <input
                  type="checkbox"
                  checked={noPassword}
                  onChange={(event) => setNoPassword(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-navy"
                />
                I sign in with Google, Apple or Microsoft, so I don&apos;t have a password
              </label>

              <div>
                <label htmlFor="deactivate-reason" className="text-sm font-bold">
                  Why are you leaving? <span className="font-normal text-navy/50">(optional)</span>
                </label>
                <textarea
                  id="deactivate-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={cn(inputCls, "mt-2 py-3")}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
                >
                  {error}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="min-h-12 rounded-full border border-navy/15 px-5 text-sm font-bold text-navy hover:bg-navy/5"
                >
                  Keep my account
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Deactivate
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
