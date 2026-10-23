import { X } from "lucide-react";
import { Select } from "@/components/Select";

/**
 * The Moderators supporting a member: each one as a removable chip, and a list to add another.
 * A member can have several Moderators.
 */
export function ModeratorPicker({
  memberName,
  value,
  options,
  onChange,
  disabled = false,
}: {
  memberName: string;
  value: string[];
  options: { id: string; name: string }[];
  onChange: (moderatorIds: string[]) => void;
  disabled?: boolean;
}) {
  const nameOf = (id: string) => options.find((option) => option.id === id)?.name ?? "Moderator";
  const addable = options.filter((option) => !value.includes(option.id));
  return (
    <div className="mt-1.5 space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${memberName}'s Moderators`}>
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-navy/6 py-1 pr-1 pl-3 text-xs font-bold text-navy"
            >
              <span className="truncate">{nameOf(id)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((other) => other !== id))}
                aria-label={`Remove ${nameOf(id)}`}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-coral/15 hover:text-coral disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-navy/55">No Moderator yet.</p>
      )}
      {addable.length > 0 && (
        <Select
          aria-label={`Add a Moderator for ${memberName}`}
          value=""
          disabled={disabled}
          onChange={(id) => id && onChange([...value, id])}
          options={[
            { value: "", label: value.length ? "Add another Moderator" : "Add a Moderator" },
            ...addable.map((option) => ({ value: option.id, label: option.name })),
          ]}
          className="min-h-11 rounded-xl border-2 border-navy/12"
        />
      )}
    </div>
  );
}
