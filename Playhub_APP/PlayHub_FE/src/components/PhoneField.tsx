import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  COUNTRIES,
  PINNED_COUNTRIES,
  flagOf,
  joinPhone,
  splitPhone,
  type Country,
} from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * A phone number with a country-code picker: flag and dialling code on the left (searchable list),
 * the number on the right. `onChange` gets the full number, e.g. "+971 50 123 4567". Pasting a
 * number that starts with "+" picks its country.
 */
export function PhoneField({
  id,
  label,
  value,
  onChange,
  error,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  required?: boolean;
}) {
  const [country, setCountry] = useState<Country>(() => splitPhone(value).country);
  const [national, setNational] = useState(() => splitPhone(value).national);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const update = (nextCountry: Country, nextNational: string) => {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(joinPhone(nextCountry, nextNational));
  };

  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}{" "}
        {required && (
          <span className="text-coral" aria-hidden>
            *
          </span>
        )}
      </label>
      <div
        className={cn(
          "relative mt-1.5 flex min-h-13 rounded-2xl border-2 bg-white transition focus-within:border-amber",
          error ? "border-coral/60 focus-within:border-coral" : "border-navy/10",
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country code: ${country.name} +${country.dial}`}
          className="flex shrink-0 items-center gap-1.5 rounded-l-2xl border-r-2 border-navy/8 pr-2.5 pl-3.5 text-base font-semibold text-navy transition hover:bg-navy/[0.03] focus:outline-none focus-visible:bg-navy/5"
        >
          <span className="text-xl leading-none" aria-hidden>
            {flagOf(country.code)}
          </span>
          <span>+{country.dial}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-navy/45 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={national}
          maxLength={24}
          placeholder={country.code === "AE" ? "50 123 4567" : "Phone number"}
          onChange={(event) => {
            const typed = event.target.value;
            if (typed.trim().startsWith("+")) {
              const split = splitPhone(typed, country);
              update(split.country, split.national);
            } else update(country, typed);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-3.5 text-base font-semibold focus:outline-none"
        />
        {open && (
          <CountryList
            selected={country}
            onPick={(picked) => {
              setOpen(false);
              update(picked, national);
              inputRef.current?.focus();
            }}
            onClose={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            triggerRef={triggerRef}
          />
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

function CountryList({
  selected,
  onPick,
  onClose,
  triggerRef,
}: {
  selected: Country;
  onPick: (country: Country) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) {
      const pinned = new Set(PINNED_COUNTRIES.map((c) => c.code));
      return [...PINNED_COUNTRIES, ...COUNTRIES.filter((c) => !pinned.has(c.code))];
    }
    // Names that start with the search come first, then a word inside the name, then the rest.
    const rank = (c: (typeof COUNTRIES)[number]) => {
      const name = c.name.toLowerCase();
      if (c.dial === q || c.code.toLowerCase() === q || name.startsWith(q)) return 0;
      if (name.split(/[\s(-]+/).some((word) => word.startsWith(q))) return 1;
      if (c.dial.startsWith(q)) return 2;
      return name.includes(q) ? 3 : -1;
    };
    return COUNTRIES.map((c) => ({ c, r: rank(c) }))
      .filter(({ r }) => r >= 0)
      .sort((a, b) => a.r - b.r)
      .map(({ c }) => c);
  }, [query]);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((c) => c.code === selected.code),
    ),
  );

  useEffect(() => {
    searchRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) onClose();
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [onClose, triggerRef]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = options[active];
      if (country) onPick(country);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      ref={panelRef}
      className="ph-rise absolute top-[calc(100%+0.4rem)] left-0 z-40 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-[0_24px_60px_-20px_rgba(0,42,100,.45)]"
    >
      <div className="relative border-b border-navy/8 p-2">
        <Search
          className="pointer-events-none absolute top-1/2 left-5 h-4 w-4 -translate-y-1/2 text-navy/40"
          aria-hidden
        />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options[active] ? `${listId}-${options[active].code}` : undefined}
          aria-label="Search countries"
          placeholder="Search country or code"
          className="min-h-11 w-full rounded-xl bg-navy/[0.04] pr-3 pl-9 text-sm font-semibold text-navy focus:outline-none"
        />
      </div>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Countries"
        className="max-h-64 overflow-y-auto p-1.5"
      >
        {options.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-navy/55">No countries match.</li>
        )}
        {options.map((country, index) => {
          const isSelected = country.code === selected.code;
          return (
            <li
              key={country.code}
              id={`${listId}-${country.code}`}
              data-index={index}
              role="option"
              aria-selected={isSelected}
              onPointerMove={() => setActive(index)}
              onClick={() => onPick(country)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-navy",
                index === active && "bg-amber/15",
                !query && index === PINNED_COUNTRIES.length - 1 && "mb-1.5 border-b border-navy/8",
              )}
            >
              <span className="text-lg leading-none" aria-hidden>
                {flagOf(country.code)}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{country.name}</span>
              <span className="shrink-0 text-navy/55">+{country.dial}</span>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-blue" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
