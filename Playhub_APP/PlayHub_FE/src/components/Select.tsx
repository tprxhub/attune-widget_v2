import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Custom-styled stand-in for a native <select>. Browsers render a native
 * select's option list with unstyleable OS chrome, so this owns the full
 * open/closed listbox to keep dropdowns visually consistent with the rest
 * of the app.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const target = optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0];
      target?.focus();
    }
  }, [open, selectedIndex]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveFocus(delta: number) {
    if (options.length === 0) return;
    const current = optionRefs.current.findIndex((el) => el === document.activeElement);
    const base = current === -1 ? selectedIndex : current;
    const next = (base + delta + options.length) % options.length;
    optionRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border bg-card px-4 text-left text-sm font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
          open
            ? "border-blue ring-2 ring-blue/25"
            : "border-navy/15 hover:border-blue/40 focus-visible:border-blue focus-visible:ring-2 focus-visible:ring-blue/25",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "font-normal text-navy/45")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-navy/50 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              optionRefs.current[0]?.focus();
            } else if (event.key === "End") {
              event.preventDefault();
              optionRefs.current[options.length - 1]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          className="ph-rise absolute top-full left-0 z-30 mt-2 max-h-72 w-full min-w-[14rem] overflow-y-auto rounded-2xl border border-navy/10 bg-card p-1.5 shadow-[var(--shadow-lift)]"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-navy/50">No options available</p>
          ) : (
            options.map((option, index) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition",
                    active
                      ? "bg-blue/10 font-bold text-navy"
                      : "font-semibold text-navy/80 hover:bg-navy/4 focus-visible:bg-navy/4",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block truncate text-[11px] font-normal text-navy/50">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-blue" aria-hidden />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
