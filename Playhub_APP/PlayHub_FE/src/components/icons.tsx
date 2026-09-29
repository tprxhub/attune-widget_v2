import {
  Angry,
  Crosshair,
  Frown,
  Grip,
  Hand,
  Laugh,
  Meh,
  PenLine,
  Scissors,
  Search,
  Smile,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Mood 1–5, rendered as icons (never emoji). */
export const MOOD_ICONS: { icon: LucideIcon; label: string }[] = [
  { icon: Angry, label: "Really struggled" },
  { icon: Frown, label: "Not keen" },
  { icon: Meh, label: "Neutral" },
  { icon: Smile, label: "Happy" },
  { icon: Laugh, label: "Loved it" },
];

export function moodMeta(value: number) {
  return MOOD_ICONS[Math.min(5, Math.max(1, value)) - 1]!;
}

export function MoodIcon({ value, className }: { value: number; className?: string }) {
  const { icon: Icon, label } = moodMeta(value);
  return <Icon className={cn("h-5 w-5", className)} aria-label={`Mood: ${label}`} />;
}

const GOAL_ICONS: Record<string, LucideIcon> = {
  pinch: Hand,
  bilateral: Grip,
  visual: Crosshair,
  tool: Scissors,
  prewrite: PenLine,
  scanning: Search,
  letters: Type,
};

export function GoalIcon({ goalId, className }: { goalId: string; className?: string }) {
  const Icon = GOAL_ICONS[goalId] ?? Sparkles;
  return <Icon className={cn("h-5 w-5", className)} aria-hidden />;
}
