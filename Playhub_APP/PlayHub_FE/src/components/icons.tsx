import {
  Angry,
  Frown,
  Laugh,
  Meh,
  PenLine,
  Search,
  Smile,
  Target,
  type LucideIcon,
} from "lucide-react";
import {
  BilateralIcon,
  PinchGripIcon,
  PreWritingIcon,
  ToolUseIcon,
  VisualMotorIcon,
} from "./brandIcons";
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

/** The brand set has icons for five skill areas; the other two keep a Lucide icon. */
const GOAL_ICONS: Record<string, LucideIcon> = {
  pinch: PinchGripIcon,
  bilateral: BilateralIcon,
  visual: VisualMotorIcon,
  tool: ToolUseIcon,
  prewrite: PenLine,
  scanning: Search,
  letters: PreWritingIcon,
};

/** Matched against a plan's skill area (category) name, then its own name. */
const GOAL_NAME_ICONS: [RegExp, LucideIcon][] = [
  [/bilateral|midline/i, BilateralIcon],
  [/scanning|tracking|matching/i, Search],
  [/visual.motor|eye.hand/i, VisualMotorIcon],
  [/tool use|functional grasp|scissor/i, ToolUseIcon],
  [/letter|pre.writing shapes/i, PreWritingIcon],
  [/handwriting|line mastery/i, PenLine],
  [/pinch|grip|dexterity/i, PinchGripIcon],
];

/** A skill area's icon, found by its built-in id, else its skill-area name, else the plan's name. */
export function GoalIcon({
  goalId,
  goalName = "",
  categoryName = "",
  className,
}: {
  goalId: string;
  goalName?: string | undefined;
  categoryName?: string | null | undefined;
  className?: string;
}) {
  const byName = (name: string | null | undefined) =>
    name ? GOAL_NAME_ICONS.find(([pattern]) => pattern.test(name))?.[1] : undefined;
  const Icon = GOAL_ICONS[goalId] ?? byName(categoryName) ?? byName(goalName) ?? Target;
  return <Icon className={cn("h-5 w-5", className)} aria-hidden />;
}
