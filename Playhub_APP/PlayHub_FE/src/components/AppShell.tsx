import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { isPlatformRole } from "@/lib/roles";
import type { PermissionKey } from "@/lib/types";
import {
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  HeartHandshake,
  Home,
  LayoutGrid,
  LayoutPanelTop,
  Sparkles,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrg } from "@/api/org";
import { useCapabilities, useSession } from "@/auth/session";
import { roleLabel } from "@/lib/roles";
import { GuideButton } from "@/features/guide/GuideDialog";
import { cn } from "@/lib/utils";
import { ChildSwitcherDropdown } from "@/lib/active-child";
import { OrgScopeDropdown } from "@/lib/org-scope";
import { Logo } from "./brand";
import { RenewalNotice } from "./RenewalNotice";
import { ProfileAvatar } from "./ProfileAvatar";
import { ModalPortal } from "./ModalPortal";
import { QueryStatusBoundary } from "./QueryStatusBoundary";
import { useNavigationPreferences } from "@/lib/navigation-preferences";
import { NavigationTour } from "@/features/guide/NavigationTour";

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
function navFor(role: string, accountType: string, permissions: PermissionKey[] = []): NavItem[] {
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
  const attune: NavItem = { to: "/attune", label: "Ask Attune", short: "Attune", icon: Sparkles };

  if (role === "super_admin" || role === "ttp_employee") {
    // A TTP employee sees only the pages that were ticked for them.
    const allowed = (key: PermissionKey) => role === "super_admin" || permissions.includes(key);
    const items: (NavItem | false)[] = [
      { to: "/admin", label: "Overview", short: "Overview", icon: Home },
      allowed("children") && {
        to: "/admin/children",
        label: "Children",
        short: "Children",
        icon: Users,
      },
      role === "super_admin" && checkIn,
      allowed("children") && attune,
      allowed("progress") && {
        to: "/admin/progress",
        label: "Progress",
        short: "Progress",
        icon: BarChart3,
      },
      allowed("audit") && {
        to: "/admin/audit",
        label: "Audit log",
        short: "Audit",
        icon: ShieldCheck,
      },
      allowed("plans") && plans,
      allowed("plans") && {
        to: "/admin/plans",
        label: "Plans library",
        short: "Library",
        icon: ClipboardList,
      },
      allowed("homepage") && {
        to: "/admin/homepage",
        label: "Home page",
        short: "Home page",
        icon: LayoutPanelTop,
      },
      allowed("organisations") && {
        to: "/admin/orgs",
        label: "Organisations",
        short: "Orgs",
        icon: Building2,
      },
      allowed("team") && {
        to: "/admin/educators",
        label: "Admins & Moderators",
        short: "Team",
        icon: HeartHandshake,
      },
      role === "super_admin" && {
        to: "/admin/ttp",
        label: "TTP Employees",
        short: "TTP",
        icon: BadgeCheck,
      },
      account,
    ];
    return items.filter((item): item is NavItem => item !== false);
  }

  // Organisation staff — no billing or subscription anywhere.
  if (accountType === "b2b" && (role === "educator" || role === "supporter")) {
    return [
      { to: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
      plans,
      checkIn,
      progress,
      attune,
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
      attune,
      account,
    ];
  }

  // Family accounts.
  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
    plans,
    checkIn,
    progress,
    attune,
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
  const { isVisible: isNavigationVisible } = useNavigationPreferences(session.personaId);
  const items = useMemo(() => {
    const baseItems = navFor(session.role, session.accountType, session.permissions);
    return session.accountType === "b2b" && session.role === "educator"
      ? baseItems.filter((item) => item.to === "/account" || isNavigationVisible(item.to))
      : baseItems;
  }, [isNavigationVisible, session.accountType, session.permissions, session.role]);
  const tourItems = useMemo(() => {
    const navigationItems = items.map(({ to, label }) => ({ to, label }));
    if (session.role !== "educator") return navigationItems;

    const childSteps = [
      {
        to: "/dashboard",
        label: "Switch child view",
        target: "child-switcher",
        description:
          "Use this selector to move between children—or choose All children for an organisation-wide dashboard. Your Dashboard and Progress views update for the child you select.",
      },
      {
        to: "/dashboard",
        label: "Add a child",
        target: "add-child",
        description:
          "Open the child selector and choose Add a Member whenever you need to enrol another child. The guide has opened the menu so you can see exactly where it lives.",
      },
    ];

    return navigationItems.length > 0
      ? [navigationItems[0]!, ...childSteps, ...navigationItems.slice(1)]
      : childSteps;
  }, [items, session.role]);
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
  // Ask Attune is a full-screen chat: it fills the whole content area and carries the top-bar
  // controls in its own header on large screens.
  const fullBleed = pathname.startsWith("/attune");
  const mobileItems = canInviteSupporter
    ? [...items, { to: "/invite", label: "Invite a moderator", short: "Invite", icon: UserPlus }]
    : items;

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-navy/10 bg-navy px-4 py-6 text-white lg:flex">
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
              data-tour-path={item.to}
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

      <div className={cn("flex min-w-0 flex-1 flex-col", fullBleed && "h-dvh overflow-hidden")}>
        {/* Mobile / tablet top bar */}
        <header
          className={cn(
            "sticky top-0 z-30 border-b border-navy/10 bg-navy text-white lg:border-transparent lg:bg-cream/80 lg:text-navy lg:backdrop-blur",
            fullBleed && "lg:hidden",
          )}
        >
          <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3 sm:px-6 lg:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/"
                className="shrink-0 lg:hidden [&_img]:h-11 [&_img]:w-auto sm:[&_img]:h-14"
              >
                <Logo />
              </Link>
            </div>
            <span className="col-start-3 row-start-1 sm:hidden [&_button]:h-11 [&_button]:w-11 [&_button]:justify-center [&_button]:rounded-xl [&_button]:border-white/15 [&_button]:bg-white/5 [&_button]:px-0 [&_button]:text-white [&_button>span]:hidden">
              <GuideButton tour />
            </span>
            <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 sm:flex-wrap">
              {/* The child and organisation pickers change nothing on the Account page. */}
              {pathname.startsWith("/account") ? null : isPlatformRole(session.role) &&
                !pathname.startsWith("/check-in") &&
                !pathname.startsWith("/attune") ? (
                <OrgScopeDropdown className="min-w-0 max-w-full [&>button]:max-w-full [&>button]:rounded-xl [&>button]:border-white/15 [&>button]:bg-white/10 [&>button]:text-white lg:[&>button]:border-navy/10 lg:[&>button]:bg-card/80 lg:[&>button]:text-navy" />
              ) : (
                <ChildSwitcherDropdown className="min-w-0 max-w-full [&>button]:max-w-full [&>button]:rounded-xl [&>button]:border-white/15 [&>button]:bg-white/10 [&>button]:text-white lg:[&>button]:border-navy/10 lg:[&>button]:bg-card/80 lg:[&>button]:text-navy" />
              )}
              {org.data && (
                <span className="hidden max-w-[14rem] min-w-0 items-center gap-2 rounded-full border border-navy/10 bg-card/80 py-1.5 pr-4 pl-2 text-sm font-bold text-navy shadow-[0_1px_0_rgba(16,42,74,0.04)] lg:inline-flex">
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
                  <GuideButton tour />
                </span>
              </span>
              <span className="hidden sm:inline lg:hidden">
                <span className="[&_button]:border-white/25 [&_button]:text-white">
                  <GuideButton tour />
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
              {mobileItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: true }}
                    aria-current={isActive(item.to) ? "page" : undefined}
                    data-tour-path={item.to}
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

        <main
          className={cn(
            fullBleed
              ? "flex min-h-0 w-full min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0"
              : "mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-10 lg:px-8 lg:pt-8",
          )}
        >
          <RenewalNotice />
          <QueryStatusBoundary>{children}</QueryStatusBoundary>
        </main>

        {/* Mobile bottom tabs */}
        <MobileNavigation items={mobileItems} activePath={bestMatch} pathname={pathname} />
        <NavigationTour items={tourItems} />
      </div>
    </div>
  );
}

/**
 * The top bar's controls (child picker, organisation, Start guide) for pages that hide the top
 * bar and show them in their own header, like Ask Attune.
 */
export function AppHeaderControls({ className }: { className?: string }) {
  const { session } = useSession();
  const org = useQuery({
    queryKey: ["org", session.orgId],
    queryFn: () => getOrg(session.orgId!),
    enabled: !!session.orgId,
  });
  return (
    <div className={cn("flex min-w-0 items-center justify-end gap-2", className)}>
      <ChildSwitcherDropdown className="min-w-0 max-w-full [&>button]:max-w-full [&>button]:rounded-xl [&>button]:border-navy/10 [&>button]:bg-card [&>button]:text-navy" />
      {org.data && (
        <span className="hidden max-w-[14rem] min-w-0 items-center gap-2 rounded-full border border-navy/10 bg-card py-1.5 pr-4 pl-2 text-sm font-bold text-navy xl:inline-flex">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue/12 text-blue">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
          <span className="truncate">{org.data.name}</span>
        </span>
      )}
      <span className="[&_button]:min-h-10 [&_button]:border-navy/10 [&_button]:bg-card [&_button]:text-navy [&_button:hover]:border-coral/40 [&_button:hover]:text-coral">
        <GuideButton tour />
      </span>
    </div>
  );
}

function MobileNavigation({
  items,
  activePath,
  pathname,
}: {
  items: NavItem[];
  activePath: string | undefined;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const visible = items.length > 5 ? items.slice(0, 4) : items;
  const hasMore = items.length > 5;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => trigger?.focus();
  }, [open]);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="flex">
          {visible.map((item) => (
            <li key={item.to} className="min-w-0 flex-1">
              <Link
                to={item.to}
                activeOptions={{ exact: true }}
                aria-current={activePath === item.to ? "page" : undefined}
                data-tour-path={item.to}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold",
                  activePath === item.to ? "text-coral" : "text-navy/55",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="w-full truncate text-center">{item.short}</span>
              </Link>
            </li>
          ))}
          {hasMore && (
            <li className="min-w-0 flex-1">
              <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className={cn(
                  "flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-bold",
                  items.slice(4).some((item) => item.to === activePath)
                    ? "text-coral"
                    : "text-navy/55",
                )}
              >
                <Menu className="h-5 w-5" aria-hidden />
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[1050] flex items-end bg-navy/45"
            onClick={(event) => event.target === event.currentTarget && setOpen(false)}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-navigation-title"
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (event.key !== "Tab") return;
                const controls =
                  dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
                const first = controls?.[0];
                const last = controls?.[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="mobile-navigation-title" className="text-xl font-bold">
                  Your workspace
                </h2>
                <button
                  autoFocus
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-xl bg-navy/5"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <nav aria-label="All sections" className="grid gap-1">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    aria-current={item.to === activePath ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold",
                      item.to === activePath
                        ? "bg-amber text-navy"
                        : "text-navy/75 hover:bg-navy/5",
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
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
