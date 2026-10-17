import {
  BarChart3,
  CalendarCheck,
  Layers,
  FolderClosed,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface LaunchItem {
  label: string;
  detail: string;
  to: string;
  icon: LucideIcon;
  accent: string;
}

export function hubLaunchItemId(item: Pick<LaunchItem, "to" | "label">) {
  return `${item.to}|${item.label}`;
}

export type HubTileKind = "plans" | "apps" | "check-ins" | "progress" | "attune" | "shortcut";

export interface HubCardSetting {
  id: string;
  title: string;
  width: "narrow" | "wide";
  order: number;
  hidden?: boolean;
  kind?: HubTileKind;
  to?: string;
  detail?: string;
}

export interface CustomHubCard extends HubCardSetting {
  to: string;
  detail: string;
}

export interface HubTileOption {
  id: string;
  kind: HubTileKind;
  title: string;
  detail: string;
  to: string;
  icon: LucideIcon;
  accent: string;
  width: HubCardSetting["width"];
}

export const HUB_BACKGROUNDS = [
  { id: "blue", color: "#009fff" },
  { id: "purple", color: "#bf5af2" },
  { id: "green", color: "#30d158" },
  { id: "red", color: "#ff375f" },
  { id: "orange", color: "#ff9f0a" },
  { id: "yellow", color: "#ffd60a" },
] as const;

export const DEFAULT_HUB_CARDS: HubCardSetting[] = [
  { id: "profile", title: "Profile", width: "narrow", order: 0 },
  { id: "plans", title: "Play Plans", width: "wide", order: 1 },
  { id: "apps", title: "Apps", width: "wide", order: 2 },
  { id: "check-ins", title: "Daily Check-In", width: "narrow", order: 4 },
  { id: "progress", title: "Progress", width: "narrow", order: 3 },
  { id: "attune", title: "Ask Attune", width: "wide", order: 5 },
];

export function hubCardKind(card: HubCardSetting): HubTileKind {
  if (card.kind) return card.kind;
  return DEFAULT_HUB_CARDS.some((item) => item.id === card.id && item.id !== "profile")
    ? (card.id as HubTileKind)
    : "shortcut";
}

export function hubTileOptions(
  items: LaunchItem[],
  paths: { plans: string; progress: string; home: string },
): HubTileOption[] {
  const cards: HubTileOption[] = [
    {
      id: "plans",
      kind: "plans",
      title: "Play Plans",
      detail: "Activities",
      to: paths.plans,
      icon: FolderClosed,
      accent: "from-sky-300 to-blue-500",
      width: "wide",
    },
    {
      id: "check-ins",
      kind: "check-ins",
      title: "Daily Check-In",
      detail: "Recent check-ins",
      to: "/check-in",
      icon: CalendarCheck,
      accent: "from-amber-300 to-orange-400",
      width: "narrow",
    },
    {
      id: "progress",
      kind: "progress",
      title: "Progress",
      detail: "Recent activity",
      to: paths.progress,
      icon: BarChart3,
      accent: "from-emerald-300 to-teal-500",
      width: "narrow",
    },
    {
      id: "attune",
      kind: "attune",
      title: "Ask Attune",
      detail: "Your next step",
      to: "/attune",
      icon: Sparkles,
      accent: "from-pink-300 to-rose-500",
      width: "wide",
    },
  ];
  const shortcuts: HubTileOption[] = items
    .filter((item) => !cards.some((card) => card.title === item.label))
    .map((item) => ({
      ...item,
      id: hubLaunchItemId(item),
      title: item.label,
      kind: "shortcut",
      width: "narrow",
    }));
  return [
    ...cards,
    ...shortcuts,
    {
      id: "apps",
      kind: "apps",
      title: "Apps",
      detail: "Your Play Hub spaces",
      to: paths.home,
      icon: Layers,
      accent: "from-slate-300 to-slate-500",
      width: "wide",
    },
  ];
}

export function hubCardOptionId(card: HubCardSetting) {
  const kind = hubCardKind(card);
  return kind === "shortcut"
    ? hubLaunchItemId({ to: card.to ?? "shortcut", label: card.title })
    : kind;
}
