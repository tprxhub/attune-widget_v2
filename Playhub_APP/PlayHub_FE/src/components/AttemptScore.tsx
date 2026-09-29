import { MoodIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { CompletionStatus, HelpLevel } from "@/lib/types";

const COMPLETION = { finished: "Finished", partly: "Partly", stopped_early: "Stopped early" };
const HELP = {
  hands_on: "Hands-on help",
  few_reminders: "A few reminders",
  one_reminder: "One reminder",
  independent: "On their own",
};

/** Keeps completion and mood together wherever a logged attempt is shown. */
export function AttemptScore({
  completion,
  mood,
  className,
  completionStatus,
  helpLevel,
}: {
  completion: number;
  mood: number;
  className?: string;
  completionStatus?: CompletionStatus;
  helpLevel?: HelpLevel;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue/12 px-2.5 py-1 text-[11px] font-bold text-blue",
        className,
      )}
      aria-label={`${completionStatus ? COMPLETION[completionStatus] : `Completion score ${completion} out of 5`}; ${helpLevel ? HELP[helpLevel] : "help not recorded"}; mood ${mood} out of 5`}
    >
      <span>{completionStatus ? COMPLETION[completionStatus] : `${completion}/5`}</span>
      {helpLevel && <span className="hidden sm:inline">· {HELP[helpLevel]}</span>}
      <span className="h-3 w-px bg-blue/25" aria-hidden />
      <MoodIcon value={mood} className="h-3.5 w-3.5" />
    </span>
  );
}
