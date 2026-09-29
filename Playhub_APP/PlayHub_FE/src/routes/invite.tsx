import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { inviteParent } from "@/api/org";
import { Protected } from "@/auth/guards";
import { useCapabilities } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { useActiveChild } from "@/lib/active-child";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite a Moderator — Play Hub" },
      {
        name: "description",
        content:
          "Invite a Moderator to log Play Doses for your child without sharing your own login.",
      },
      { property: "og:title", content: "Invite a Moderator — Play Hub" },
      {
        property: "og:description",
        content: "Invite a Moderator to log Play Doses for your child.",
      },
    ],
  }),
  component: () => (
    <Protected>
      <InvitePage />
    </Protected>
  ),
});

function InvitePage() {
  const { canInviteSupporter } = useCapabilities();
  const { activeChild } = useActiveChild();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const invite = useMutation({ mutationFn: () => inviteParent(activeChild!.id, email) });

  if (!canInviteSupporter) {
    return (
      <>
        <PageHeader eyebrow="Your circle" title="Invite a Moderator" />
        <div className="ph-card mx-auto max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-coral" aria-hidden />
          <p className="mt-3 text-lg font-bold">Subscribe first</p>
          <p className="mt-2 text-sm text-navy/70">
            Only the subscribed Admin of a child can invite a Moderator.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Your circle"
        title="Invite a Moderator"
        description="They get their own login, can log Attempts and read the Play Plan — they can't change billing."
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr] lg:items-start">
        <section className="ph-card p-5 sm:p-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\S+@\S+\.\S+$/.test(email)) {
                setError("Enter a valid email address.");
                return;
              }
              setError("");
              invite.mutate();
            }}
          >
            <div>
              <label htmlFor="invite-email" className="text-sm font-bold">
                Their email
              </label>
              <div className="relative mt-2">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-navy/40"
                  aria-hidden
                />
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="moderator@example.com"
                  className="min-h-13 w-full rounded-2xl border border-navy/15 bg-card pr-4 pl-11 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
                />
              </div>
              {error && <p className="mt-2 text-xs font-semibold text-coral">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={invite.isPending}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-white disabled:opacity-60"
            >
              {invite.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden />
              )}
              Send invite for {activeChild?.name}
            </button>

            {invite.isSuccess && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-2xl bg-blue/10 p-3 text-sm font-semibold text-blue"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Invite sent to {email}. They'll get a login link for {activeChild?.name}.
              </p>
            )}
          </form>
        </section>

        <section className="ph-card p-5 sm:p-6">
          <h2 className="text-lg font-bold">What a Moderator can do</h2>
          <ul className="mt-3 space-y-2 text-sm text-navy/75">
            {[
              ["Yes", "Open the Play Plan and every unlocked Play Dose"],
              ["Yes", "Log Attempts, including past sessions"],
              ["Yes", "Write the Parent win after a session"],
              ["No", "Change the subscription or payment details"],
              ["No", "Invite other people"],
            ].map(([allowed, line]) => (
              <li key={line} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    allowed === "Yes" ? "bg-blue/12 text-blue" : "bg-coral/12 text-coral"
                  }`}
                >
                  {allowed}
                </span>
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
