import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { isPlatformRole } from "@/lib/roles";
import type { PermissionKey, Session } from "@/lib/types";
import {
  BadgeCheck,
  BarChart3,
  HeartPulse,
  Building2,
  CalendarCheck,
  ClipboardList,
  HeartHandshake,
  Home,
  LayoutGrid,
  LayoutPanelTop,
  Sparkles,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  Menu,
  Search,
  CornerDownLeft,
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
import { SignOutButton } from "./SignOutButton";
import { useNavigationPreferences } from "@/lib/navigation-preferences";

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof Home;
}

function SignedInIdentity({ session }: { session: Session }) {
  return (
    <span
      title={`${session.name} · ${roleLabel(session.role, session.accountType)}`}
      className="flex min-w-0 items-center gap-3 text-sm font-semibold"
    >
      <ProfileAvatar
        name={session.name}
        photoUrl={session.avatarUrl}
        sticker={session.avatarSticker}
        className="h-12 w-12 shrink-0 rounded-xl"
      />
      <span className="min-w-0 truncate leading-tight">
        <span className="block truncate">{session.name}</span>
        <span className="block truncate text-[11px] font-medium text-current/60">
          {roleLabel(session.role, session.accountType)}
        </span>
      </span>
    </span>
  );
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
      role === "super_admin" && {
        to: "/admin/play-pulse",
        label: "Play Pulse leads",
        short: "Pulse",
        icon: HeartPulse,
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
  items.push(account);
  return items;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session } = useSession();
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
  const searchItems = useMemo(() => {
    const searchableItems = canInviteSupporter
      ? [...items, { to: "/invite", label: "Invite a moderator", short: "Invite", icon: UserPlus }]
      : items;
    return searchableItems.map((item) => ({
      ...item,
      keywords:
        `${item.label} ${item.short} ${item.to.replaceAll("/", " ").replaceAll("-", " ")}`.toLocaleLowerCase(),
    }));
  }, [canInviteSupporter, items]);

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-navy/10 bg-navy px-4 py-6 text-white [@media(max-height:820px)]:px-3 [@media(max-height:820px)]:py-3 lg:flex">
        <Link to="/" className="shrink-0 text-white">
          <Logo size="large" />
        </Link>
        <nav
          aria-label="Main"
          className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain [@media(max-height:820px)]:mt-3 [@media(max-height:820px)]:space-y-0.5"
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors [@media(max-height:820px)]:min-h-9",
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
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors [@media(max-height:820px)]:min-h-9",
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
        <div className="mt-auto shrink-0 border-t border-white/12 pt-4 [@media(max-height:820px)]:pt-2">
          <SignedInIdentity session={session} />
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
              <GuideButton />
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
              <span className="hidden max-w-[16rem] min-w-0 truncate text-xs font-semibold text-white/70 sm:inline lg:hidden">
                {session.name} · {roleLabel(session.role, session.accountType)}
                {org.data ? ` · ${org.data.name}` : ""}
              </span>
              <span className="hidden lg:inline">
                <span className="[&_button]:min-h-10 [&_button]:border-navy/10 [&_button]:bg-card/80 [&_button]:text-navy [&_button]:shadow-[0_1px_0_rgba(16,42,74,0.04)] [&_button:hover]:border-coral/40 [&_button:hover]:text-coral">
                  <GuideButton />
                </span>
              </span>
              <span className="hidden sm:inline lg:hidden">
                <span className="[&_button]:border-white/25 [&_button]:text-white">
                  <GuideButton />
                </span>
              </span>
              <SignOutButton className="hidden border-navy/10 bg-white text-navy shadow-sm hover:border-coral/35 hover:bg-white hover:text-coral lg:inline-flex" />
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
        <FloatingNavigator items={searchItems} activePath={bestMatch} />
      </div>
    </div>
  );
}

function FloatingNavigator({
  items,
  activePath,
}: {
  items: Array<NavItem & { keywords: string }>;
  activePath: string | undefined;
}) {
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    return () => trigger?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search and navigate"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-navy px-4 text-sm font-bold text-white shadow-[0_12px_32px_rgba(7,42,91,0.26)] transition-all hover:-translate-y-0.5 hover:bg-blue focus-visible:ring-4 focus-visible:ring-amber/50 focus-visible:outline-none sm:right-6 sm:bottom-6 lg:right-8"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Search pages</span>
        <kbd className="hidden rounded-md bg-white/12 px-1.5 py-0.5 text-[10px] text-white/75 sm:inline">
          ⌘ K
        </kbd>
      </button>
      {open && (
        <FloatingNavigatorDialog
          items={items}
          activePath={activePath}
          onClose={() => setOpen(false)}
          onNavigate={(item) => {
            setOpen(false);
            void navigate({ to: item.to as never });
          }}
        />
      )}
    </>
  );
}

function FloatingNavigatorDialog({
  items,
  activePath,
  onClose,
  onNavigate,
}: {
  items: Array<NavItem & { keywords: string }>;
  activePath: string | undefined;
  onClose: () => void;
  onNavigate: (item: NavItem & { keywords: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? items.filter((item) => item.keywords.includes(term)) : items;
  }, [items, query]);

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => {
    if (results.length) {
      document
        .getElementById(`navigator-result-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, results.length]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      onNavigate(results[activeIndex]!);
    } else if (event.key === "Tab") {
      trapDialogFocus(event, dialogRef.current);
    }
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[1100] flex items-start justify-center bg-navy/45 px-3 pt-[10vh] pb-4 backdrop-blur-[3px] sm:px-6 sm:pt-[14vh]"
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="navigator-title"
          onKeyDown={handleKeyDown}
          className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-card shadow-[0_30px_100px_rgba(7,42,91,0.3)]"
        >
          <NavigatorDialogHeader onClose={onClose} />

          <div className="p-3 sm:p-4">
            <NavigatorSearchBox
              inputRef={inputRef}
              query={query}
              onQueryChange={setQuery}
              activeResultId={results[activeIndex] ? `navigator-result-${activeIndex}` : undefined}
            />

            <div className="mt-3 flex items-center justify-between px-2 text-[11px] font-semibold tracking-wide text-navy/45 uppercase">
              <span>{query ? "Matching pages" : "Quick navigation"}</span>
              <span>
                {results.length} {results.length === 1 ? "page" : "pages"}
              </span>
            </div>
            <NavigatorResults
              results={results}
              activePath={activePath}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              onNavigate={onNavigate}
            />
            <p className="mt-3 border-t border-navy/8 px-2 pt-3 text-center text-[11px] font-medium text-navy/45">
              <kbd className="rounded border border-navy/10 px-1 py-0.5">↑</kbd>{" "}
              <kbd className="rounded border border-navy/10 px-1 py-0.5">↓</kbd> to navigate
              <span className="mx-1">·</span>
              <kbd className="rounded border border-navy/10 px-1 py-0.5">Enter</kbd> to open
              <span className="mx-1">·</span>
              <kbd className="rounded border border-navy/10 px-1 py-0.5">Ctrl/⌘ K</kbd> search
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function NavigatorDialogHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-gradient-to-r from-navy to-blue px-5 pt-5 pb-4 text-white sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/65 uppercase">
            Play Hub Navigator
          </p>
          <h2 id="navigator-title" className="mt-1 text-xl font-bold sm:text-2xl">
            Where would you like to go?
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12 text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-amber focus-visible:outline-none"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function NavigatorSearchBox({
  inputRef,
  query,
  onQueryChange,
  activeResultId,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  activeResultId: string | undefined;
}) {
  return (
    <label className="flex min-h-13 items-center gap-3 rounded-2xl border border-navy/12 bg-white px-4 shadow-[0_4px_18px_rgba(7,42,91,0.06)] focus-within:border-blue/50 focus-within:ring-4 focus-within:ring-blue/10">
      <Search className="h-5 w-5 shrink-0 text-blue" aria-hidden />
      <input
        ref={inputRef}
        autoFocus
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search pages, plans, progress…"
        aria-label="Search application pages"
        aria-controls="navigator-results"
        aria-activedescendant={activeResultId}
        className="min-w-0 flex-1 bg-transparent py-3 text-base text-navy outline-none placeholder:text-navy/40"
      />
      <kbd className="hidden rounded-lg border border-navy/10 bg-cream px-2 py-1 text-xs font-semibold text-navy/50 sm:inline">
        ESC
      </kbd>
    </label>
  );
}

function NavigatorResults({
  results,
  activePath,
  activeIndex,
  onHover,
  onNavigate,
}: {
  results: Array<NavItem & { keywords: string }>;
  activePath: string | undefined;
  activeIndex: number;
  onHover: (index: number) => void;
  onNavigate: (item: NavItem & { keywords: string }) => void;
}) {
  return (
    <div
      id="navigator-results"
      role="listbox"
      aria-label="Navigation results"
      className="mt-2 max-h-[min(52dvh,26rem)] space-y-1 overflow-y-auto overscroll-contain"
    >
      {results.length ? (
        results.map((item, index) => (
          <NavigatorResult
            key={item.to}
            item={item}
            index={index}
            active={index === activeIndex}
            current={item.to === activePath}
            onHover={onHover}
            onNavigate={onNavigate}
          />
        ))
      ) : (
        <NavigatorEmptyState />
      )}
    </div>
  );
}

function NavigatorResult({
  item,
  index,
  active,
  current,
  onHover,
  onNavigate,
}: {
  item: NavItem & { keywords: string };
  index: number;
  active: boolean;
  current: boolean;
  onHover: (index: number) => void;
  onNavigate: (item: NavItem & { keywords: string }) => void;
}) {
  return (
    <button
      id={`navigator-result-${index}`}
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={() => onHover(index)}
      onClick={() => onNavigate(item)}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors sm:px-4",
        active ? "bg-amber/20 text-navy" : "text-navy hover:bg-navy/5",
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          active ? "bg-amber text-navy" : "bg-blue/8 text-blue",
        )}
      >
        <item.icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{item.label}</span>
        <span className="block truncate text-xs text-navy/45">{item.to}</span>
      </span>
      {current ? (
        <span className="rounded-full bg-blue/10 px-2.5 py-1 text-[10px] font-bold text-blue">
          Current
        </span>
      ) : active ? (
        <CornerDownLeft className="h-4 w-4 shrink-0 text-navy/45" aria-hidden />
      ) : null}
    </button>
  );
}

function NavigatorEmptyState() {
  return (
    <div className="rounded-2xl bg-cream px-4 py-8 text-center">
      <Search className="mx-auto h-6 w-6 text-navy/30" aria-hidden />
      <p className="mt-2 text-sm font-bold text-navy">No pages found</p>
      <p className="mt-1 text-xs text-navy/55">Try a different name or keyword.</p>
    </div>
  );
}

function trapDialogFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
  dialog: HTMLDivElement | null,
) {
  const controls = dialog?.querySelectorAll<HTMLElement>(
    'input, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  );
  const first = controls?.[0];
  const last = controls?.[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
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
        <GuideButton />
      </span>
      <SignOutButton className="hidden border-navy/10 bg-white text-navy shadow-sm hover:border-coral/35 hover:bg-white hover:text-coral lg:inline-flex" />
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
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const visible = items.length > 4 ? items.slice(0, 4) : items;
  const hasMore = items.length > 4;

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
              <div className="mt-4 flex items-center gap-3 border-t border-navy/10 pt-4">
                <ProfileAvatar
                  name={session.name}
                  photoUrl={session.avatarUrl}
                  sticker={session.avatarSticker}
                  className="h-10 w-10 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy">{session.name}</p>
                  <p className="truncate text-xs text-navy/55">
                    {session.guardianName
                      ? `Run by ${session.guardianName}`
                      : roleLabel(session.role, session.accountType)}
                  </p>
                </div>
                <SignOutButton className="shrink-0 bg-navy text-white hover:bg-navy/90 hover:bg-current/5" />
              </div>
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
