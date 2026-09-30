import { useState, type FormEvent } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { MOOD_ICONS } from "@/components/icons";
import type { CompletionStatus, HelpLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ReflectionValues {
  date: string;
  completion: number;
  completionStatus: CompletionStatus;
  helpLevel: HelpLevel;
  mood: number;
  bigWin: string;
  consultNotes: string;
}

interface ReflectionFormProps {
  onSubmit: (values: ReflectionValues) => Promise<void> | void;
  showDate?: boolean;
  showConsultNotes?: boolean;
  submitLabel?: string;
  pending?: boolean;
  disabled?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ReflectionForm({
  onSubmit,
  showDate = false,
  showConsultNotes = false,
  submitLabel = "Log this Session",
  pending = false,
  disabled = false,
}: ReflectionFormProps) {
  const [date, setDate] = useState(today());
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);
  const [helpLevel, setHelpLevel] = useState<HelpLevel | null>(null);
  const [mood, setMood] = useState(0);
  const [bigWin, setBigWin] = useState("");
  const [consultNotes, setConsultNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notesOpen, setNotesOpen] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (showDate) {
      if (!date) next["date"] = "Choose the date this Play Dose happened.";
      else if (date > today()) next["date"] = "The date can't be in the future.";
    }
    if (!completionStatus) next["completion"] = "Choose how much of the activity was finished.";
    if (!helpLevel) next["help"] = "Choose how much help was needed.";
    if (!mood) next["mood"] = "Pick a Mood.";
    if (bigWin.trim().length < 3) next["bigWin"] = "Add a short note about the Parent win.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await onSubmit({
        date,
        completion:
          completionStatus === "finished"
            ? helpLevel === "independent"
              ? 5
              : helpLevel === "one_reminder"
                ? 4
                : 3
            : completionStatus === "partly"
              ? 3
              : 1,
        completionStatus: completionStatus!,
        helpLevel: helpLevel!,
        mood,
        bigWin: bigWin.trim(),
        consultNotes: consultNotes.trim(),
      });
    } catch {
      // The parent mutation owns the user-facing API error; keep the entered values for retry.
      return;
    }
    setCompletionStatus(null);
    setHelpLevel(null);
    setMood(0);
    setBigWin("");
    setConsultNotes("");
  };

  return (
    <form onSubmit={handle} noValidate className="space-y-6">
      {showDate && (
        <div>
          <label htmlFor="attempt-date" className="text-sm font-bold">
            Date of the session
          </label>
          <p className="text-xs text-navy/60">You can log a past session — no future dates.</p>
          <input
            id="attempt-date"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors["date"])}
            className="mt-2 min-h-11 w-full rounded-xl border border-navy/18 bg-card px-3 text-sm font-semibold sm:max-w-xs"
          />
          {errors["date"] && (
            <p className="mt-1 text-xs font-semibold text-coral">{errors["date"]}</p>
          )}
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-bold">Did they finish the activity?</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["stopped_early", "Stopped early"],
              ["partly", "Partly"],
              ["finished", "Finished"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCompletionStatus(value)}
              aria-pressed={completionStatus === value}
              className={cn(
                "flex min-h-14 w-full items-center justify-center rounded-2xl border px-3 text-center text-sm leading-snug font-bold transition-all active:scale-95",
                completionStatus === value
                  ? "border-blue bg-blue text-white shadow-[var(--shadow-card)]"
                  : "border-navy/15 bg-card hover:border-navy/35",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {errors["completion"] && (
          <p className="mt-2 text-xs font-semibold text-coral">{errors["completion"]}</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">How much help did they need?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["hands_on", "Hands-on help"],
              ["few_reminders", "A few reminders"],
              ["one_reminder", "One reminder"],
              ["independent", "On their own"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setHelpLevel(value)}
              aria-pressed={helpLevel === value}
              className={cn(
                "flex min-h-14 w-full items-center justify-center rounded-2xl border px-2 text-center text-sm leading-snug font-bold transition-all active:scale-95",
                helpLevel === value
                  ? "border-blue bg-blue text-white shadow-[var(--shadow-card)]"
                  : "border-navy/15 bg-card hover:border-navy/35",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {errors["help"] && (
          <p className="mt-2 text-xs font-semibold text-coral">{errors["help"]}</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">Mood</legend>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {MOOD_ICONS.map(({ icon: Icon, label }, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setMood(i + 1)}
              aria-pressed={mood === i + 1}
              aria-label={label}
              title={label}
              className={cn(
                "flex min-h-14 w-full items-center justify-center rounded-2xl border transition-all active:scale-95",
                mood === i + 1
                  ? "border-amber bg-amber/40 text-navy shadow-[var(--shadow-card)]"
                  : "border-navy/15 bg-card text-navy/55 hover:border-navy/35 hover:text-navy",
              )}
            >
              <Icon className="h-6 w-6" aria-hidden />
            </button>
          ))}
        </div>
        <p className="mt-2 min-h-5 text-xs font-semibold text-navy/70">
          {mood ? MOOD_ICONS[mood - 1]!.label : ""}
        </p>

        {errors["mood"] && (
          <p className="mt-2 text-xs font-semibold text-coral">{errors["mood"]}</p>
        )}
      </fieldset>

      <div>
        <label htmlFor="big-win" className="text-sm font-bold">
          Parent win
        </label>
        <p className="text-xs text-navy/60">What was your parent win during this activity?</p>
        <textarea
          id="big-win"
          rows={3}
          value={bigWin}
          onChange={(e) => setBigWin(e.target.value)}
          aria-invalid={Boolean(errors["bigWin"])}
          placeholder="They stayed on task, tried again or needed less help — or I waited and helped less…"
          className="mt-2 w-full rounded-2xl border border-navy/18 bg-card p-3 text-sm"
        />
        {errors["bigWin"] && (
          <p className="mt-1 text-xs font-semibold text-coral">{errors["bigWin"]}</p>
        )}
      </div>

      {showConsultNotes && (
        <div className="rounded-2xl border border-navy/8 bg-navy/[0.02] p-4">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            aria-expanded={notesOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-sm font-bold">Play Consult Notes</span>
              <span className="text-xs text-navy/60">Clinical / consultation notes. Optional.</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-navy/50 transition-transform duration-200",
                notesOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {notesOpen && (
            <textarea
              id="consult-notes"
              rows={3}
              value={consultNotes}
              onChange={(e) => setConsultNotes(e.target.value)}
              placeholder="Grip slipping into a fisted hold under fatigue…"
              className="mt-3 w-full rounded-2xl border border-navy/18 bg-card p-3 text-sm"
            />
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || disabled}
        className="sticky bottom-3 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 text-base font-bold text-white shadow-[var(--shadow-lift)] transition-transform active:scale-[0.98] disabled:opacity-50 lg:static lg:w-auto"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-5 w-5" aria-hidden />
        )}
        {submitLabel}
      </button>
    </form>
  );
}
