import { Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import brandPattern from "@/assets/Icon_of_Service/Brand pattern.png";
import { Logo } from "@/components/brand";
import { DailyCheckInIcon, PlayPlansIcon, ProgressBrandIcon } from "@/components/brandIcons";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { hasPermission, roleLabel } from "@/lib/roles";
import { useCapabilities, useSession } from "./session";
import type { AccountType, PermissionKey, Role } from "@/lib/types";

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

const INSIDE = [
  { label: "Play Plans", icon: PlayPlansIcon },
  { label: "Daily Check-In", icon: DailyCheckInIcon },
  { label: "Progress", icon: ProgressBrandIcon },
];

/**
 * What a signed-out visitor sees on a members-only page: the brand pattern behind a cream card
 * with log in and sign up, and a glimpse of what's inside.
 */
function SignInRequired() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-navy">
      <img
        src={brandPattern}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-60"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-navy/40 via-navy/70 to-navy"
        aria-hidden
      />

      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link to="/" aria-label="Play Hub home" className="text-cream">
          <Logo />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to homepage
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-4 pb-16">
        <section
          aria-labelledby="sign-in-required-title"
          className="w-full max-w-[440px] rounded-[28px] bg-cream p-7 text-center text-navy shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] sm:p-10"
        >
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber text-navy shadow-[0_10px_24px_-12px_rgb(0_0_0/0.45)]">
            <Lock className="h-7 w-7" aria-hidden />
          </span>
          <h1
            id="sign-in-required-title"
            className="ph-display mt-6 text-3xl leading-tight sm:text-[2rem]"
          >
            Please sign in
          </h1>

          <div className="mt-8 grid gap-3">
            <Link
              to="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-navy px-6 text-sm font-bold text-cream transition-colors hover:bg-navy/90"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-navy/20 bg-white px-6 text-sm font-bold text-navy transition-colors hover:bg-navy/5"
            >
              Create a free account
            </Link>
          </div>

          <div className="mt-8 border-t border-navy/10 pt-6">
            <p className="text-[11px] font-bold tracking-[0.18em] text-navy/45 uppercase">
              Inside Play Hub
            </p>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {INSIDE.map(({ label, icon: Icon }) => (
                <li key={label} className="flex flex-col items-center gap-2">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy/[0.06] text-blue">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-xs font-semibold text-navy/75">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * For the log in and sign up pages: someone already signed in goes straight to the Play Hub
 * launcher instead of seeing the form again.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, hydrated } = useSession();
  if (hydrated && session.role !== "anonymous") {
    // Signing in always lands on the Play Hub launcher.
    return <Navigate to="/hub" replace />;
  }
  return <>{children}</>;
}

/** Auth guard + Role guard + Account-type guard, rendered inside the app shell. */
export function Protected({
  children,
  roles,
  accountTypes,
  permission,
}: {
  children: ReactNode;
  roles?: Role[];
  accountTypes?: AccountType[];
  /** TTP employees also need this page ticked for them; a Super Admin always passes. */
  permission?: PermissionKey;
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
    return <SignInRequired />;
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

  if (permission && !hasPermission(session, permission) && session.role === "ttp_employee") {
    return (
      <AppShell>
        <Blocked
          title="You don't have access to this page"
          message="A Super Admin chooses which pages each TTP employee can use. Ask them to tick this one for you."
          ctaTo={session.homePath}
          ctaLabel="Back to Overview"
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
