import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  BadgeCheck,
  HeartHandshake,
  HeartPulse,
  Home,
  FolderClosed,
  Rows3,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound,
  Plus,
  Grid2x2,
} from "lucide-react";
import { listRecentCheckIns } from "@/api/attempts";
import { listPlans } from "@/api/plans";
import { useCapabilities, useSession } from "@/auth/session";
import { Logo } from "@/components/brand";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { HubAppsMenu } from "@/features/hub/HubAppsMenu";
import { HubAccountMenu, HubCreateMenu } from "@/features/hub/HubHeaderMenus";
import { HubBackgroundPicker } from "@/features/hub/HubBackgroundPicker";
import { HubWallpaperPicker } from "@/features/hub/HubWallpaperPicker";
import { HubPopover } from "@/features/hub/HubPopover";
import { HubTilePicker } from "@/features/hub/HubTilePicker";
import { HubCardControls } from "@/features/hub/HubCardControls";
import { HubCardContent } from "@/features/hub/HubCardContent";
import { HubSimpleView } from "@/features/hub/HubSimpleView";
import { HubFooter } from "@/features/hub/HubFooter";
import {
  DEFAULT_HUB_CARDS,
  HUB_BACKGROUNDS,
  SIMPLE_TILE_ORDER,
  hubCardKind,
  hubCardOptionId,
  hubLaunchItemId,
  migrateHubTileId,
  isLegacyPlatformCard,
  hubTileOptions,
  type LaunchItem,
  type HubCardSetting,
  type CustomHubCard,
  type HubTileOption,
} from "@/features/hub/hubTiles";
import { useHubLayoutMotion } from "@/features/hub/useHubLayoutMotion";
import { useHubCardDrag } from "@/features/hub/useHubCardDrag";
import { moveHubCardToSlot, moveIdToSlot } from "@/features/hub/moveHubCardToSlot";
import "@/features/hub/hub.css";
import { roleLabel } from "@/lib/roles";
import { useActiveChild } from "@/lib/active-child";
import { CustomizeIcon } from "@/features/hub/CustomizeIcon";
import { useHomepageContent } from "@/features/homepage/useHomepageContent";
import type { PermissionKey, Session } from "@/lib/types";
import brandWallpaper from "@/assets/Icon_of_Service/Brand pattern.png";

function platformLaunchItems(session: Session): LaunchItem[] {
  const allowed = (key: PermissionKey) =>
    session.role === "super_admin" || session.permissions?.includes(key) === true;
  const items: LaunchItem[] = [
    {
      label: "Overview",
      detail: "Platform activity and follow-ups",
      to: "/admin",
      icon: Home,
      accent: "from-cyan-400 to-blue-500",
    },
  ];
  const optional: [PermissionKey, LaunchItem][] = [
    [
      "children",
      {
        label: "Members",
        detail: "Find and manage profiles",
        to: "/admin/members",
        icon: Users,
        accent: "from-amber-300 to-orange-400",
      },
    ],
    [
      "children",
      {
        label: "Ask Attune",
        detail: "Guidance for your next step",
        to: "/attune",
        icon: Sparkles,
        accent: "from-pink-300 to-rose-500",
      },
    ],
    [
      "progress",
      {
        label: "Progress",
        detail: "Trends and support insights",
        to: "/admin/progress",
        icon: BarChart3,
        accent: "from-emerald-300 to-teal-500",
      },
    ],
    [
      "plans",
      {
        label: "Play Plans",
        detail: "Browse and manage plans",
        to: "/plans",
        icon: FolderClosed,
        accent: "from-sky-300 to-blue-500",
      },
    ],
    [
      "audit",
      {
        label: "Audit log",
        detail: "Recent platform changes",
        to: "/admin/audit",
        icon: ShieldCheck,
        accent: "from-slate-300 to-slate-500",
      },
    ],
    [
      "plans",
      {
        label: "Plans library",
        detail: "Manage activities and levels",
        to: "/admin/plans",
        icon: ClipboardList,
        accent: "from-orange-300 to-amber-500",
      },
    ],
    [
      "organisations",
      {
        label: "Organisations",
        detail: "Schools and clinics",
        to: "/admin/orgs",
        icon: Building2,
        accent: "from-sky-300 to-blue-500",
      },
    ],
    [
      "team",
      {
        label: "Team",
        detail: "Admins and moderators",
        to: "/admin/educators",
        icon: HeartHandshake,
        accent: "from-rose-300 to-pink-500",
      },
    ],
    [
      "homepage",
      {
        label: "Home page",
        detail: "Edit public site content",
        to: "/admin/homepage",
        icon: BookOpen,
        accent: "from-yellow-300 to-amber-500",
      },
    ],
  ];
  for (const [permission, item] of optional) {
    if (allowed(permission)) items.push(item);
  }
  if (session.role === "super_admin") {
    items.push(
      {
        label: "Daily Check-In",
        detail: "Review logged sessions",
        to: "/check-in",
        icon: CalendarCheck,
        accent: "from-amber-300 to-orange-400",
      },
      {
        label: "Play Pulse leads",
        detail: "Review family enquiries",
        to: "/admin/play-pulse",
        icon: HeartPulse,
        accent: "from-red-300 to-rose-500",
      },
      {
        label: "TTP Employees",
        detail: "Manage platform access",
        to: "/admin/ttp",
        icon: BadgeCheck,
        accent: "from-indigo-300 to-violet-500",
      },
      {
        label: "Account",
        detail: "Profile and preferences",
        to: "/account",
        icon: UserRound,
        accent: "from-sky-300 to-cyan-500",
      },
    );
  }
  return items;
}

function accountLaunchItems(session: Session): LaunchItem[] {
  const orgStaff = session.accountType === "b2b";
  const items: LaunchItem[] = [
    {
      label: "Dashboard",
      detail: "Your next steps at a glance",
      to: "/dashboard",
      icon: Home,
      accent: "from-cyan-400 to-blue-500",
    },
    {
      label: "Play Plans",
      detail: "Choose a goal and start playing",
      to: "/plans",
      icon: FolderClosed,
      accent: "from-sky-300 to-blue-500",
    },
  ];
  if (!orgStaff || session.role === "educator" || session.role === "supporter") {
    items.push({
      label: "Daily Check-In",
      detail: "Log a play session",
      to: "/check-in",
      icon: CalendarCheck,
      accent: "from-amber-300 to-orange-400",
    });
  }
  items.push(
    {
      label: "Progress",
      detail: "See skills grow over time",
      to: "/progress",
      icon: BarChart3,
      accent: "from-emerald-300 to-teal-500",
    },
    {
      label: "Ask Attune",
      detail: "Get help with your next step",
      to: "/attune",
      icon: Sparkles,
      accent: "from-pink-300 to-rose-500",
    },
  );
  if (orgStaff) {
    items.push({
      label: "Members",
      detail: "View members in your setting",
      to: "/org",
      icon: Users,
      accent: "from-sky-300 to-blue-500",
    });
  }
  if (orgStaff && session.role === "educator") {
    items.push({
      label: "Moderators",
      detail: "Manage your support team",
      to: "/org/supporters",
      icon: HeartHandshake,
      accent: "from-rose-300 to-pink-500",
    });
  }
  if (!orgStaff) {
    items.push({
      label: "Subscription",
      detail: "Manage your family plan",
      to: "/subscription",
      icon: CreditCard,
      accent: "from-yellow-300 to-amber-500",
    });
  }
  items.push({
    label: "Account",
    detail: "Profile and preferences",
    to: "/account",
    icon: UserRound,
    accent: "from-sky-300 to-cyan-500",
  });
  return items;
}

function launchItems(session: Session): LaunchItem[] {
  return session.role === "super_admin" || session.role === "ttp_employee"
    ? platformLaunchItems(session)
    : accountLaunchItems(session);
}

export const Route = createFileRoute("/hub")({
  head: () => ({ meta: [{ title: "Play Hub — Your space" }] }),
  component: HubLaunch,
});

function useHubPreferences(personaId: string) {
  const [viewMode, setViewMode] = useState<"simple" | "detailed">("simple");
  const [simpleTileIds, setSimpleTileIds] = useState<string[] | null>(null);
  const [background, setBackground] = useState("blue");
  const [backgroundMode, setBackgroundMode] = useState<"wallpaper" | "color">("wallpaper");
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const [hiddenTiles, setHiddenTiles] = useState<string[]>([]);
  const [cardSettings, setCardSettings] = useState(DEFAULT_HUB_CARDS);
  const [customCards, setCustomCards] = useState<CustomHubCard[]>([]);
  const [ready, setReady] = useState(false);
  const key = `play-hub-launcher:${personaId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          viewMode?: "simple" | "detailed";
          simpleTileIds?: string[];
          background?: string;
          backgroundMode?: "wallpaper" | "color";
          customWallpaper?: string | null;
          profilePhoto?: string | null;
          hiddenTiles?: string[];
          cardSettings?: HubCardSetting[];
          customCards?: CustomHubCard[];
        };
        const legacyColors: Record<string, string> = {
          indigo: "purple",
          teal: "green",
          slate: "blue",
        };
        if (parsed.viewMode === "simple" || parsed.viewMode === "detailed") {
          setViewMode(parsed.viewMode);
        }
        if (Array.isArray(parsed.simpleTileIds)) {
          setSimpleTileIds(
            parsed.simpleTileIds
              .filter((id): id is string => typeof id === "string")
              .map(migrateHubTileId),
          );
        }
        const color = legacyColors[parsed.background ?? ""] ?? parsed.background;
        if (HUB_BACKGROUNDS.some((item) => item.id === color)) setBackground(color!);
        if (parsed.backgroundMode === "wallpaper" || parsed.backgroundMode === "color") {
          setBackgroundMode(parsed.backgroundMode);
        }
        if (
          typeof parsed.customWallpaper === "string" &&
          parsed.customWallpaper.startsWith("data:image/")
        ) {
          setCustomWallpaper(parsed.customWallpaper);
        }
        if (
          typeof parsed.profilePhoto === "string" &&
          parsed.profilePhoto.startsWith("data:image/")
        ) {
          setProfilePhoto(parsed.profilePhoto);
        }
        if (Array.isArray(parsed.hiddenTiles)) {
          setHiddenTiles(parsed.hiddenTiles.map(migrateHubTileId));
        }
        if (Array.isArray(parsed.cardSettings)) {
          setCardSettings(
            DEFAULT_HUB_CARDS.map((card) => ({
              ...card,
              ...(card.id === "profile"
                ? {}
                : parsed.cardSettings?.find((savedCard) => savedCard.id === card.id)),
            })),
          );
        }
        if (Array.isArray(parsed.customCards)) {
          setCustomCards(
            parsed.customCards.map((card) =>
              card.title === "Dashboard" && card.to === "/org"
                ? { ...card, to: "/dashboard" }
                : isLegacyPlatformCard(card)
                  ? {
                      ...card,
                      id: migrateHubTileId(card.id),
                      title: "Members",
                      to: "/admin/members",
                    }
                  : card,
            ),
          );
        }
      }
    } catch {
      // Ignore stale or unavailable browser preferences.
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          viewMode,
          simpleTileIds,
          background,
          backgroundMode,
          customWallpaper,
          profilePhoto,
          hiddenTiles,
          cardSettings,
          customCards,
        }),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Your changes could not be saved on this device. Try a smaller wallpaper or photo.",
      );
    }
  }, [
    viewMode,
    simpleTileIds,
    background,
    backgroundMode,
    customWallpaper,
    profilePhoto,
    hiddenTiles,
    cardSettings,
    customCards,
    key,
    ready,
  ]);

  return {
    viewMode,
    setViewMode,
    simpleTileIds,
    setSimpleTileIds,
    background,
    setBackground,
    backgroundMode,
    setBackgroundMode,
    customWallpaper,
    setCustomWallpaper,
    profilePhoto,
    setProfilePhoto,
    storageError,
    hiddenTiles,
    setHiddenTiles,
    cardSettings,
    setCardSettings,
    customCards,
    setCustomCards,
  };
}

function useHubCheckIns(
  personaId: string,
  canLog: boolean,
  children: ReturnType<typeof useActiveChild>["children"],
) {
  const childIds = children.map((child) => child.id);
  const query = useQuery({
    queryKey: ["hub-recent-checkins", personaId, childIds],
    queryFn: () => listRecentCheckIns(childIds, 3),
    enabled: canLog && childIds.length > 0,
  });
  const names = useMemo(() => new Map(children.map((child) => [child.id, child.name])), [children]);
  return { query, names };
}

function HubLaunch() {
  const { session, hydrated } = useSession();
  const { canLogAttempts } = useCapabilities();
  const { children, isLoading: childrenLoading } = useActiveChild();
  const home = useHomepageContent();
  const [customizing, setCustomizing] = useState(false);
  const [addTileOpen, setAddTileOpen] = useState(false);
  /** What the Add picker adds: a tile (toolbar, Create menu) or a shortcut (an empty shortcut slot). */
  const [addTarget, setAddTarget] = useState<"tile" | "shortcut">("tile");
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const addTileRef = useRef<HTMLButtonElement>(null);
  const [dragPreview, setDragPreview] = useState<HubCardSetting[] | null>(null);
  const {
    draggingCardId,
    dragOverCardId,
    dragOffset,
    dragOrigin,
    startCardDrag: beginCardDrag,
  } = useHubCardDrag();
  const { gridRef, animateLayout } = useHubLayoutMotion();
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardTo, setNewCardTo] = useState("");
  const {
    viewMode,
    setViewMode,
    simpleTileIds,
    setSimpleTileIds,
    background,
    setBackground,
    backgroundMode,
    setBackgroundMode,
    customWallpaper,
    setCustomWallpaper,
    profilePhoto,
    setProfilePhoto,
    storageError,
    hiddenTiles,
    setHiddenTiles,
    cardSettings,
    setCardSettings,
    customCards,
    setCustomCards,
  } = useHubPreferences(session.personaId);
  const { query: progressQuery, names: childNames } = useHubCheckIns(
    session.personaId,
    canLogAttempts,
    children,
  );
  const plansQuery = useQuery({ queryKey: ["hub-play-plans"], queryFn: () => listPlans() });
  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#061e52] text-sm font-semibold text-white/70">
        Opening your Play Hub…
      </div>
    );
  }
  if (session.role === "anonymous") return <Navigate to="/login" replace />;

  const items = launchItems(session);
  const visibleItems = items.filter(
    (item) => !hiddenTiles.includes(item.to) && !hiddenTiles.includes(hubLaunchItemId(item)),
  );
  const simpleCandidates = items.filter(
    (item) => item.label !== "Dashboard" && item.label !== "Overview",
  );
  const defaultSimpleItems = [...simpleCandidates]
    .sort((a, b) => {
      const aIndex = SIMPLE_TILE_ORDER.indexOf(a.label);
      const bIndex = SIMPLE_TILE_ORDER.indexOf(b.label);
      return (
        (aIndex < 0 ? SIMPLE_TILE_ORDER.length : aIndex) -
        (bIndex < 0 ? SIMPLE_TILE_ORDER.length : bIndex)
      );
    })
    .slice(0, 6);
  const defaultSimpleIds = defaultSimpleItems.map(hubLaunchItemId);
  const simpleItems = simpleTileIds
    ? simpleTileIds
        .map((id) => simpleCandidates.find((item) => hubLaunchItemId(item) === id))
        .filter((item): item is LaunchItem => Boolean(item))
    : defaultSimpleItems;
  const simpleTileOptions: HubTileOption[] = simpleCandidates
    .filter(
      (item) =>
        !simpleItems.some((selected) => hubLaunchItemId(selected) === hubLaunchItemId(item)),
    )
    .map((item) => ({
      ...item,
      id: hubLaunchItemId(item),
      title: item.label,
      kind: "shortcut",
      width: "narrow",
    }));
  const hiddenItems = items.filter(
    (item) => hiddenTiles.includes(item.to) || hiddenTiles.includes(hubLaunchItemId(item)),
  );
  const isPlatform = session.role === "super_admin" || session.role === "ttp_employee";
  const plansPath = isPlatform ? "/admin/plans" : "/plans";
  const progressPath = isPlatform ? "/admin/progress" : "/progress";
  const shortcutPath = newCardTo || plansPath;
  const tileOptions = hubTileOptions(items, {
    plans: plansPath,
    progress: progressPath,
    home: session.homePath,
  });
  const availableCards = dragPreview ?? [...cardSettings, ...customCards];
  const visibleCards = availableCards
    .filter((card) => !card.hidden)
    .sort((a, b) => a.order - b.order);
  // Only Super Admins and TTP employees can switch to the detailed cards; everyone else sees the simple view.
  const showDetailed = isPlatform && viewMode === "detailed";
  const simpleShortcuts = visibleCards.filter((card) => hubCardKind(card) === "shortcut");
  const shortcutOptions: HubTileOption[] = simpleCandidates
    .filter((item) => !simpleShortcuts.some((card) => card.to === item.to))
    .map((item) => ({
      ...item,
      id: hubLaunchItemId(item),
      title: item.label,
      kind: "shortcut",
      width: "narrow",
    }));
  const pickingShortcut = !showDetailed && addTarget === "shortcut";
  // Admins and Moderators get four shortcut places; Super Admins, TTP employees and Members two.
  const isAdminOrModerator =
    session.role === "educator" ||
    session.role === "supporter" ||
    (session.role === "parent" && session.accountType === "b2c");
  const shortcutSlots = isAdminOrModerator ? 4 : 2;
  const cardById = (id: string) => availableCards.find((card) => card.id === id)!;
  const cardWidth = (id: string) =>
    (id === "profile" ? "narrow" : cardById(id).width) === "wide"
      ? "col-span-1 sm:col-span-2"
      : "col-span-1";
  const cardOrder = (id: string) => (id === "profile" ? 0 : cardById(id).order);
  const updateCard = (id: string, update: Partial<HubCardSetting>) => {
    if (id === "profile") return;
    setCardSettings((current) =>
      current.map((card) => (card.id === id ? { ...card, ...update } : card)),
    );
    setCustomCards((current) =>
      current.map((card) => (card.id === id ? { ...card, ...update } : card)),
    );
  };
  const removeCard = (id: string) => animateLayout(() => updateCard(id, { hidden: true }));
  const reorderCard = (id: string, targetId: string) => {
    const layout = moveHubCardToSlot(availableCards, id, targetId);
    const positions = new Map(layout.map(({ id, order, width }) => [id, { order, width }]));
    animateLayout(() => {
      setCardSettings((current) =>
        current.map((card) =>
          positions.has(card.id) ? { ...card, ...positions.get(card.id)! } : card,
        ),
      );
      setCustomCards((current) =>
        current.map((card) =>
          positions.has(card.id) ? { ...card, ...positions.get(card.id)! } : card,
        ),
      );
      setDragPreview(null);
    });
  };
  const addCustomCard = () => {
    const title = newCardTitle.trim();
    if (!title) return;
    const destination = [
      ...items,
      { label: "Play Plans", to: plansPath, detail: "Browse activities" },
      { label: "Progress", to: progressPath, detail: "See progress" },
    ].find((item) => item.to === shortcutPath);
    const id = `custom-${Date.now()}`;
    setCustomCards((current) => [
      ...current,
      {
        id,
        title,
        width: "narrow",
        order: Math.max(-1, ...availableCards.map((card) => card.order)) + 1,
        to: shortcutPath,
        kind: "shortcut",
        detail: destination?.detail ?? "Open this Play Hub space",
      },
    ]);
    setNewCardTitle("");
    setAddTileOpen(false);
  };
  const startCustomizing = () => {
    setCustomizing(true);
    setAddTileOpen(false);
    setCardMenuId(null);
    setBackgroundPickerOpen(false);
    setWallpaperPickerOpen(false);
  };
  const replaceCard = (id: string, option: HubTileOption) => {
    animateLayout(() =>
      updateCard(id, {
        kind: option.kind,
        title: option.title,
        to: option.to,
        detail: option.detail,
      }),
    );
    setCardMenuId(null);
  };
  const addShortcut = (option: HubTileOption) => {
    setCustomCards((current) => [
      ...current,
      {
        id: "custom-" + crypto.randomUUID(),
        kind: "shortcut",
        title: option.title,
        width: "narrow",
        order: Math.max(-1, ...availableCards.map((card) => card.order)) + 1,
        to: option.to,
        detail: option.detail,
      },
    ]);
    setAddTileOpen(false);
  };
  const addTile = (option: HubTileOption) => {
    if (!showDetailed && addTarget === "shortcut") return addShortcut(option);
    if (!showDetailed) {
      setSimpleTileIds((current) => {
        const ids = current ?? defaultSimpleIds;
        return ids.includes(option.id) ? ids : [...ids, option.id];
      });
      setAddTileOpen(false);
      addTileRef.current?.focus({ preventScroll: true });
      return;
    }
    const hidden = availableCards.find(
      (card) => card.hidden && hubCardOptionId(card) === option.id,
    );
    const order = Math.max(-1, ...availableCards.map((card) => card.order)) + 1;
    animateLayout(() => {
      if (hidden) updateCard(hidden.id, { hidden: false, order });
      else
        setCustomCards((current) => [
          ...current,
          {
            id: "custom-" + crypto.randomUUID(),
            kind: option.kind,
            title: option.title,
            width: option.width,
            order,
            to: option.to,
            detail: option.detail,
          },
        ]);
    });
    setAddTileOpen(false);
    addTileRef.current?.focus({ preventScroll: true });
  };
  const editControls = (id: string) => {
    if (!customizing || id === "profile") return null;
    const card = cardById(id);
    return (
      <HubCardControls
        card={card}
        options={tileOptions}
        open={cardMenuId === id}
        onToggle={() => {
          setCardMenuId((value) => (value === id ? null : id));
          setAddTileOpen(false);
          setBackgroundPickerOpen(false);
        }}
        onClose={() => setCardMenuId(null)}
        onRemove={() => removeCard(id)}
        onUpdate={(update) =>
          update.width ? animateLayout(() => updateCard(id, update)) : updateCard(id, update)
        }
        onReplace={(option) => replaceCard(id, option)}
      />
    );
  };
  const cardDragProps = (id: string) => ({
    "data-hub-card-id": id,
    "data-card-width": cardById(id).width,
    "data-card-kind": id === "profile" ? "profile" : hubCardKind(cardById(id)),
    "data-drag-over": dragOverCardId === id,
    "data-dragging": draggingCardId === id,
    "data-menu-open": cardMenuId === id,
    ...(customizing && id !== "profile"
      ? {
          "aria-roledescription": "draggable card",
          onDragStart: (event: React.DragEvent<HTMLElement>) => event.preventDefault(),
          onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
            if ((event.target as HTMLElement).closest("a")) event.preventDefault();
          },
          tabIndex: 0,
          onPointerDown: (event: PointerEvent<HTMLElement>) =>
            beginCardDrag(id, event, {
              onPreview: (sourceId, targetId) =>
                animateLayout(
                  () => setDragPreview(moveHubCardToSlot(availableCards, sourceId, targetId)),
                  sourceId,
                ),
              onDrop: reorderCard,
              onCancel: () => animateLayout(() => setDragPreview(null)),
            }),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            event.preventDefault();
            const index = visibleCards.findIndex((card) => card.id === id);
            const target = visibleCards[index + (event.key === "ArrowUp" ? -1 : 1)];
            if (target) reorderCard(id, target.id);
          },
        }
      : {}),
  });
  const cardStyle = (id: string, style: CSSProperties = {}) => ({
    ...style,
    ...(customizing && id !== "profile"
      ? { cursor: draggingCardId === id ? "grabbing" : "grab", touchAction: "none" as const }
      : {}),
    ...(draggingCardId === id && dragOrigin
      ? {
          position: "absolute" as const,
          left: dragOrigin.left,
          top: dragOrigin.top,
          width: dragOrigin.width,
          height: dragOrigin.height,
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.03) rotate(.6deg)`,
          zIndex: 80,
          transition: "none",
          pointerEvents: "none" as const,
          boxShadow: "0 32px 70px rgba(0, 6, 28, .62)",
        }
      : {}),
  });

  return (
    <main
      data-customizing={customizing}
      data-view-mode={showDetailed ? "detailed" : "simple"}
      data-theme={backgroundMode === "color" ? background : "blue"}
      data-background-mode={backgroundMode}
      className="hub-launcher relative isolate min-h-dvh overflow-x-clip bg-[#06285b] text-white"
    >
      <div aria-hidden className="hub-wallpaper">
        {backgroundMode === "wallpaper" ? (
          <img className="hub-wallpaper-image" src={customWallpaper ?? brandWallpaper} alt="" />
        ) : (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1976 1115"
            preserveAspectRatio="xMidYMin slice"
            fill="none"
          >
            <defs>
              <linearGradient id="hub-sky" x1="0" y1="0" x2="1" y2=".4">
                <stop stopColor="var(--hub-sky-1)" />
                <stop offset=".55" stopColor="var(--hub-sky-2)" />
                <stop offset="1" stopColor="var(--hub-sky-3)" />
              </linearGradient>
            </defs>
            <path fill="url(#hub-sky)" d="M0 0h1976v1115H0z" />
            <path
              fill="var(--hub-wave-1)"
              fillOpacity=".8"
              d="M550 0c300 230 395 615 550 1115h876V0Z"
            />
            <path
              fill="var(--hub-wave-2)"
              fillOpacity=".9"
              d="M1030 0c305 280 490 695 680 1115h266V0Z"
            />
            <path
              fill="var(--hub-wave-3)"
              fillOpacity=".8"
              d="M0 60c390 120 690 370 875 700 95 180 115 280 185 355H0Z"
            />
            <path
              fill="var(--hub-wave-4)"
              fillOpacity=".85"
              d="M0 580c430 170 690 380 850 535H0Z"
            />
          </svg>
        )}
      </div>

      {!customizing && (
        <header className="hub-main-header sticky inset-x-0 top-0 z-50 w-full">
          <div className="hub-main-bar flex min-h-16 w-full items-center justify-between gap-4 px-6 py-2 sm:px-8 lg:px-10">
            <Link
              to="/"
              aria-label="Play Hub home"
              className="hub-home-logo flex shrink-0 items-center rounded-xl px-2 [&_span]:text-white"
            >
              <Logo className="[&_img]:h-11 [&_img]:translate-y-0" />
            </Link>
            <div className="hub-header-actions flex items-center gap-2">
              {isPlatform && (
                <div className="hub-view-switch" role="group" aria-label="Hub view">
                  <button
                    type="button"
                    aria-label="Simple view"
                    aria-pressed={viewMode === "simple"}
                    title="Simple view"
                    onClick={() => setViewMode("simple")}
                  >
                    <Grid2x2 aria-hidden />
                    <span>Simple</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Detailed view"
                    aria-pressed={viewMode === "detailed"}
                    title="Detailed view"
                    onClick={() => setViewMode("detailed")}
                  >
                    <Rows3 aria-hidden />
                    <span>Detailed</span>
                  </button>
                </div>
              )}
              <HubCreateMenu
                items={items}
                onAddTile={() => {
                  startCustomizing();
                  setAddTarget("tile");
                  setAddTileOpen(true);
                }}
              />
              <HubAppsMenu
                items={items}
                paths={{ plans: plansPath, progress: progressPath }}
                onCustomize={startCustomizing}
              />
              <HubAccountMenu onCustomize={startCustomizing} />
            </div>
          </div>
        </header>
      )}

      {customizing && (
        <header className="hub-customize-toolbar sticky top-0 z-50 w-full">
          <div className="mx-auto flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="hub-done hover:brightness-110"
              onClick={() => {
                setCustomizing(false);
                setCardMenuId(null);
                setAddTileOpen(false);
                setBackgroundPickerOpen(false);
                setWallpaperPickerOpen(false);
              }}
            >
              Done
            </button>
            <div className="hub-toolbar-controls">
              <HubBackgroundPicker
                value={background}
                open={backgroundPickerOpen}
                onToggle={() => {
                  setBackgroundPickerOpen((value) => !value);
                  setWallpaperPickerOpen(false);
                  setAddTileOpen(false);
                  setCardMenuId(null);
                }}
                onClose={() => setBackgroundPickerOpen(false)}
                onChange={(value) => {
                  setBackground(value);
                  setBackgroundMode("color");
                }}
              />
              <HubWallpaperPicker
                open={wallpaperPickerOpen}
                mode={backgroundMode}
                customWallpaper={customWallpaper}
                onToggle={() => {
                  setWallpaperPickerOpen((value) => !value);
                  setBackgroundPickerOpen(false);
                  setAddTileOpen(false);
                  setCardMenuId(null);
                }}
                onClose={() => setWallpaperPickerOpen(false)}
                onDefault={() => {
                  setCustomWallpaper(null);
                  setBackgroundMode("wallpaper");
                }}
                onCustom={(value) => {
                  setCustomWallpaper(value);
                  setBackgroundMode("wallpaper");
                }}
                onColor={() => setBackgroundMode("color")}
              />
              <button
                ref={addTileRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={addTileOpen}
                className="hub-toolbar-trigger"
                onClick={() => {
                  setAddTarget("tile");
                  setAddTileOpen((value) => !value || pickingShortcut);
                  setBackgroundPickerOpen(false);
                  setWallpaperPickerOpen(false);
                  setCardMenuId(null);
                }}
              >
                Add Tile{" "}
                <span className="hub-add-symbol">
                  <Plus aria-hidden />
                </span>
              </button>
              <HubPopover
                open={addTileOpen}
                onClose={() => setAddTileOpen(false)}
                anchorRef={addTileRef}
                label={pickingShortcut ? "Add shortcut" : "Add Tile"}
              >
                <HubTilePicker
                  title={
                    pickingShortcut
                      ? "Which shortcut do you want to add?"
                      : "Which tile do you want to add?"
                  }
                  options={
                    showDetailed
                      ? tileOptions
                      : pickingShortcut
                        ? shortcutOptions
                        : simpleTileOptions
                  }
                  onPick={addTile}
                >
                  <details className="hub-tile-settings">
                    <summary>Custom shortcut</summary>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        addCustomCard();
                      }}
                    >
                      <label htmlFor="new-hub-card-title">New card title</label>
                      <input
                        id="new-hub-card-title"
                        value={newCardTitle}
                        onChange={(event) => setNewCardTitle(event.target.value)}
                        placeholder="e.g. My Check-Ins"
                      />
                      <select
                        aria-label="Shortcut destination"
                        value={shortcutPath}
                        onChange={(event) => setNewCardTo(event.target.value)}
                      >
                        {tileOptions
                          .filter((option) => option.kind !== "apps")
                          .map((option) => (
                            <option key={option.id} value={option.to}>
                              {option.title}
                            </option>
                          ))}
                      </select>
                      <button type="submit" disabled={!newCardTitle.trim()}>
                        Add card
                      </button>
                    </form>
                  </details>
                  {showDetailed &&
                    (availableCards.some((card) => card.hidden) || hiddenItems.length > 0) && (
                      <div className="hub-restore-tiles">
                        {availableCards
                          .filter((card) => card.hidden && card.id !== "profile")
                          .map((card) => (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => {
                                animateLayout(() =>
                                  updateCard(card.id, {
                                    hidden: false,
                                    order:
                                      Math.max(...availableCards.map((item) => item.order)) + 1,
                                  }),
                                );
                                setAddTileOpen(false);
                              }}
                            >
                              Restore {card.title}
                            </button>
                          ))}
                        {hiddenItems.map((item) => (
                          <button
                            key={hubLaunchItemId(item)}
                            type="button"
                            onClick={() => {
                              setHiddenTiles((current) =>
                                current.filter(
                                  (to) => to !== item.to && to !== hubLaunchItemId(item),
                                ),
                              );
                              setAddTileOpen(false);
                            }}
                          >
                            Restore {item.label} app
                          </button>
                        ))}
                      </div>
                    )}
                </HubTilePicker>
              </HubPopover>
            </div>
          </div>
        </header>
      )}
      {storageError && (
        <p role="alert" className="hub-storage-error">
          {storageError}
        </p>
      )}

      {!showDetailed ? (
        <HubSimpleView
          session={session}
          home={items.find((item) => item.label === "Dashboard" || item.label === "Overview")}
          items={simpleItems}
          shortcuts={simpleShortcuts}
          shortcutSlots={shortcutSlots}
          profilePhoto={profilePhoto}
          onProfilePhoto={setProfilePhoto}
          customizing={customizing}
          onRemoveTile={(item) =>
            setSimpleTileIds((current) =>
              (current ?? defaultSimpleIds).filter((id) => id !== hubLaunchItemId(item)),
            )
          }
          onRemoveShortcut={(id) => updateCard(id, { hidden: true })}
          onReorderTile={(sourceId, targetId) =>
            setSimpleTileIds((current) =>
              moveIdToSlot(current ?? defaultSimpleIds, sourceId, targetId),
            )
          }
          onReorderShortcut={reorderCard}
          onAddShortcut={() => {
            startCustomizing();
            setAddTarget("shortcut");
            setAddTileOpen(true);
          }}
        />
      ) : (
        <section
          ref={gridRef}
          aria-label="Play Hub launchpad"
          className="hub-grid relative z-10 mx-auto grid max-w-[1115px] grid-cols-1 gap-6 px-6 pb-8 pt-12 sm:grid-cols-3 sm:gap-[30px] sm:px-10 sm:pb-10 sm:pt-16 lg:pb-12 lg:pt-16"
        >
          {draggingCardId && dragOrigin && (
            <div
              aria-hidden
              className={"hub-drag-placeholder " + cardWidth(draggingCardId)}
              style={{ order: cardOrder(draggingCardId), minHeight: dragOrigin.height }}
            />
          )}
          <article
            {...cardDragProps("profile")}
            style={cardStyle("profile", { order: cardOrder("profile") })}
            className={`hub-card hub-profile ${cardWidth("profile")}`}
          >
            <svg
              aria-hidden
              className="hub-profile-cloud"
              viewBox="0 0 210 185"
              fill="currentColor"
            >
              <defs>
                <filter
                  id="hub-cloud-inset"
                  x="-15%"
                  y="-15%"
                  width="130%"
                  height="130%"
                  colorInterpolationFilters="sRGB"
                >
                  <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                  <feOffset dx="-2" dy="5" result="shifted" />
                  <feComposite in="SourceAlpha" in2="shifted" operator="out" result="inner-edge" />
                  <feFlood floodColor="#000714" floodOpacity="0.95" />
                  <feComposite in2="inner-edge" operator="in" result="inner-shadow" />
                  <feMerge>
                    <feMergeNode in="SourceGraphic" />
                    <feMergeNode in="inner-shadow" />
                  </feMerge>
                </filter>
              </defs>
              <path
                filter="url(#hub-cloud-inset)"
                d="M-10 64c12-13 25-17 43-12C43 19 68 4 98 5c39 1 66 30 67 71 22 8 34 28 34 48 0 31-23 54-56 54H-10Z"
              />
            </svg>
            <ProfileAvatar
              name={session.name}
              photoUrl={session.avatarUrl}
              sticker={session.avatarSticker}
              className="hub-profile-avatar"
            />
            <h1 id="hub-welcome">{session.name.split(" ")[0]}</h1>
            <p className="hub-profile-role">{roleLabel(session.role, session.accountType)}</p>
          </article>

          {visibleCards
            .filter((card) => card.id !== "profile")
            .map((card) => (
              <article
                key={card.id}
                {...cardDragProps(card.id)}
                style={cardStyle(card.id, { order: card.order })}
                className={
                  "hub-card " +
                  (hubCardKind(card) === "apps" ? "hub-apps " : "") +
                  cardWidth(card.id)
                }
              >
                {editControls(card.id)}
                <HubCardContent
                  card={card}
                  context={{
                    apps: visibleItems,
                    customizing,
                    plans: {
                      items: plansQuery.data ?? [],
                      loading: plansQuery.isLoading,
                      to: plansPath,
                    },
                    checkIns: {
                      items: progressQuery.data ?? [],
                      loading: progressQuery.isLoading,
                      names: childNames,
                      canLog: canLogAttempts,
                    },
                    progressPath,
                    options: tileOptions,
                    session,
                    children,
                    childrenLoading,
                  }}
                  onHideApp={(to) => setHiddenTiles((current) => [...current, to])}
                />
              </article>
            ))}
        </section>
      )}

      {!customizing && (
        <div className="hub-customize-bottom relative z-10">
          <button
            type="button"
            onClick={startCustomizing}
            className="focus-visible:outline-offset-4"
          >
            <CustomizeIcon className="h-[18px] w-[18px]" aria-hidden />
            Customize
          </button>
        </div>
      )}

      <HubFooter footer={home.footer} />
    </main>
  );
}
