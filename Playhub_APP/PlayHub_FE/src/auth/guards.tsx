import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { roleLabel } from "@/lib/roles";
import { useCapabilities, useSession } from "./session";
import type { AccountType, Role } from "@/lib/types";

function Blocked({
  title,
  message,
  ctaTo,
  ctaLabel,
}: {
  title: string;
  message: string;
  ctaTo: string;
  ctaLabel: string;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-navy text-white">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-navy/70">{message}</p>
      <Link
        to={ctaTo}
        className="mt-6 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

/** Auth guard + Role guard + Account-type guard, rendered inside the app shell. */
export function Protected({
  children,
  roles,
  accountTypes,
}: {
  children: ReactNode;
  roles?: Role[];
  accountTypes?: AccountType[];
}) {
  const { session, hydrated } = useSession();
  const { isAnonymous } = useCapabilities();

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm font-semibold text-navy/60">
        Loading Play Hub…
      </div>
    );
  }

  if (isAnonymous) {
    return (
      <AppShellless>
        <Blocked
          title="Please sign in"
          message="This part of Play Hub is only available once you're signed in."
          ctaTo="/login"
          ctaLabel="Go to login"
        />
      </AppShellless>
    );
  }

  if (roles && !roles.includes(session.role)) {
    return (
      <AppShell>
        <Blocked
          title="Not available for your role"
          message={`Signed in as ${session.name} (${roleLabel(session.role, session.accountType)}). This area belongs to a different role.`}
          ctaTo={session.homePath}
          ctaLabel="Back to your home"
        />
      </AppShell>
    );
  }

  if (accountTypes && !accountTypes.includes(session.accountType)) {
    return (
      <AppShell>
        <Blocked
          title="Not part of this account type"
          message={
            session.accountType === "b2b"
              ? "Organisation accounts are billed by license — individual subscriptions don't apply."
              : "This area is for organisation accounts only."
          }
          ctaTo={session.homePath}
          ctaLabel="Back to your home"
        />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}

function AppShellless({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background px-4 py-10">{children}</div>;
}
