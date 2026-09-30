import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  HeartHandshake,
  Home,
  LayoutGrid,
  LayoutPanelTop,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrg } from "@/api/org";
import { useCapabilities, useSession } from "@/auth/session";
import { roleLabel } from "@/lib/roles";
import { GuideButton } from "@/features/guide/GuideDialog";
import { cn } from "@/lib/utils";
import { ChildSwitcherDropdown } from "@/lib/active-child";
import { OrgScopeDropdown } from "@/lib/org-scope";
import { Logo } from "./brand";
import { ProfileAvatar } from "./ProfileAvatar";

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof Home;
}

/**
 * Only ever returns destinations this persona is actually allowed to open.
 * Billing / Subscription is an individual-account concept — organisations never see it.
 */
function navFor(role: string, accountType: string): NavItem[] {
  const account: NavItem = { to: "/account", label: "Account", short: "Account", icon: UserRound };
  const plans: NavItem = { to: "/plans", label: "Play Plans", short: "Plans", icon: LayoutGrid };
  const progress: NavItem = {
    to: "/progress",
    label: "Progress",
    short: "Progress",
    icon: BarChart3,
  };
  const checkIn: NavItem = {
    to: "/check-in",
    label: "Daily Check-In",
    short: "Log",
    icon: CalendarCheck,
  };

  if (role === "super_admin") {
    return [
      { to: "/admin", label: "Overview", short: "Overview", icon: Home },
      { to: "/admin/children", label: "Children", short: "Children", icon: Users },
      checkIn,
      { to: "/admin/progress", label: "Progress", short: "Progress", icon: BarChart3 },
      { to: "/admin/audit", label: "Audit log", short: "Audit", icon: ShieldCheck },
      plans,
      { to: "/admin/plans", label: "Plans library", short: "Library", icon: ClipboardList },
      { to: "/admin/homepage", label: "Home page", short: "Home page", icon: LayoutPanelTop },
      { to: "/admin/orgs", label: "Organisations", short: "Orgs", icon: Building2 },
      { to: "/admin/educators", label: "Admins & Moderators", short: "Team", icon: HeartHandshake },
      account,
    ];
  }

  // Organisation staff — no billing or subscription anywhere.
  if (accountType === "b2b" && (role === "educator" || role === "supporter")) {
    return [
      { to: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
      plans,
      checkIn,
      progress,
      { to: "/org", label: "Members", short: "Members", icon: Users },
      ...(role === "educator"
        ? [
            {
              to: "/org/supporters",
              label: "Moderators",
              short: "Team",
              icon: HeartHandshake,
            } as NavItem,
          ]
        : []),
      account,
    ];
  }

  // Organisation parent — read-only, so no logging entry point either.
  if (accountType === "b2b") {
    return [
      { to: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
      plans,
      progress,
      account,
    ];
  }

  // Family accounts.
  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
    plans,
    checkIn,
    progress,
  ];
  if (role === "parent") {
    items.push({ to: "/subscription", label: "Subscription", short: "Billing", icon: CreditCard });
  }
  items.push(account);
  return items;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const { canInviteSupporter } = useCapabilities();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navFor(session.role, session.accountType);
  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });

  // Highlight exactly one item: the longest nav path that matches the current URL.
  const candidates = [...items.map((i) => i.to), "/invite"];
  const bestMatch = candidates
    .filter((to) => pathname === to || pathname.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (to: string) => bestMatch === to;

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-navy/10 bg-navy px-4 py-6 text-white lg:flex">
        <Link to="/" className="text-white">
          <Logo size="large" />
        </Link>
        <nav aria-label="Main" className="mt-6 flex-1 space-y-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                isActive(item.to)
                  ? "bg-amber text-navy"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
          {canInviteSupporter && (
            <Link
              to="/invite"
              activeOptions={{ exact: true }}
              aria-current={isActive("/invite") ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                isActive("/invite")
                  ? "bg-amber text-navy"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <UserPlus className="h-4.5 w-4.5 shrink-0" aria-hidden />
              Invite a moderator
            </Link>
          )}
        </nav>
        <div className="mt-4 rounded-2xl bg-white/8 p-3">
          <p className="text-[10px] font-bold tracking-[0.14em] text-amber uppercase">Signed in</p>
          <div className="mt-2 flex items-center gap-2.5">
            <ProfileAvatar
              name={session.name}
              photoUrl={session.avatarUrl}
              sticker={session.avatarSticker}
              className="h-10 w-10 rounded-xl ring-1 ring-white/15"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{session.name}</p>
              <p className="truncate text-xs text-white/60">
                {session.guardianName
                  ? `Run by ${session.guardianName}`
                  : roleLabel(session.role, session.accountType)}
              </p>
              {org.data && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-amber">
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{org.data.name}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              signOut();
              void navigate({ to: "/", replace: true });
            }}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/12 px-3 text-xs font-bold transition-colors hover:bg-white/20"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet top bar */}
        <header className="z-10 border-b border-navy/10 bg-navy text-white lg:border-transparent lg:bg-cream/80 lg:text-navy lg:backdrop-blur">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="lg:hidden">
                <Logo />
              </Link>
            </div>
            <div className="flex min-w-0 shrink items-center justify-end gap-2">
              {session.role === "super_admin" && !pathname.startsWith("/check-in") ? (
                <OrgScopeDropdown className="[&>button]:border-white/25 [&>button]:bg-white/10 [&>button]:text-white lg:[&>button]:border-navy/10 lg:[&>button]:bg-card/80 lg:[&>button]:text-navy" />
              ) : (
                <ChildSwitcherDropdown className="[&>button]:border-white/25 [&>button]:bg-white/10 [&>button]:text-white lg:[&>button]:border-navy/10 lg:[&>button]:bg-card/80 lg:[&>button]:text-navy" />
              )}
              {org.data && (
                <span className="hidden min-w-0 items-center gap-2 rounded-full border border-navy/10 bg-card/80 py-1.5 pr-4 pl-2 text-sm font-bold text-navy shadow-[0_1px_0_rgba(16,42,74,0.04)] lg:inline-flex">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue/12 text-blue">
                    <Building2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="truncate">{org.data.name}</span>
                </span>
              )}
              <span className="hidden max-w-[16rem] truncate text-xs font-semibold text-white/70 sm:inline lg:hidden">
                {session.name}
                {org.data ? ` · ${org.data.name}` : ""}
              </span>
              <span className="hidden lg:inline">
                <span className="[&_button]:min-h-10 [&_button]:border-navy/10 [&_button]:bg-card/80 [&_button]:text-navy [&_button]:shadow-[0_1px_0_rgba(16,42,74,0.04)] [&_button:hover]:border-coral/40 [&_button:hover]:text-coral">
                  <GuideButton />
                </span>
              </span>
              <span className="lg:hidden">
                <span className="[&_button]:border-white/25 [&_button]:text-white">
                  <GuideButton />
                </span>
              </span>
            </div>
          </div>

          {/* Tablet horizontal nav */}
          <nav
            aria-label="Sections"
            className="hidden overflow-x-auto border-t border-white/10 px-4 sm:block lg:hidden"
          >
            <ul className="mx-auto flex max-w-6xl gap-1 py-2">
              {items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: true }}
                    aria-current={isActive(item.to) ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
                      isActive(item.to) ? "bg-amber text-navy" : "text-white/70 hover:bg-white/10",
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 sm:pb-10 lg:px-8 lg:pt-8">
          {children}
        </main>

        {/* Mobile bottom tabs */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-card/95 backdrop-blur sm:hidden"
        >
          <ul className="flex">
            {(items.length > 5 ? [...items.slice(0, 4), items[items.length - 1]!] : items).map(
              (item) => (
                <li key={item.to} className="min-w-0 flex-1">
                  <Link
                    to={item.to}
                    activeOptions={{ exact: true }}
                    aria-current={isActive(item.to) ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold",
                      isActive(item.to) ? "text-coral" : "text-navy/55",
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="w-full truncate text-center">{item.short}</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string | undefined;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow text-blue">{eyebrow}</p>}
        <h1 className="mt-1 min-w-0 text-2xl leading-tight font-bold sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-navy/70 sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

export const AdminIcon = ShieldCheck;
