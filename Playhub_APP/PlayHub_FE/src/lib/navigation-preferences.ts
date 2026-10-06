import { useCallback, useEffect, useMemo, useState } from "react";

export const ADMIN_NAVIGATION_OPTIONS = [
  { path: "/dashboard", label: "Dashboard", description: "Today’s overview and quick actions" },
  { path: "/plans", label: "Play Plans", description: "Browse and start Play Doses" },
  { path: "/check-in", label: "Daily Check-In", description: "Log a child’s session" },
  { path: "/progress", label: "Progress", description: "Charts, trends and next steps" },
  { path: "/org", label: "Members", description: "Children and member accounts" },
  { path: "/org/supporters", label: "Moderators", description: "Your organisation’s support team" },
] as const;

const EVENT = "playhub:navigation-preferences";

function key(personaId: string) {
  return `playhub:navigation:${personaId}`;
}

function read(personaId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key(personaId)) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function write(personaId: string, hidden: string[]) {
  window.localStorage.setItem(key(personaId), JSON.stringify(hidden));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { personaId, hidden } }));
}

/** Per-account navigation choices. Storing only hidden paths keeps every current option visible by default. */
export function useNavigationPreferences(personaId: string) {
  const [hidden, setHidden] = useState<string[]>(() => read(personaId));

  useEffect(() => {
    setHidden(read(personaId));
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ personaId: string; hidden: string[] }>).detail;
      if (detail?.personaId === personaId) setHidden(detail.hidden);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === key(personaId)) setHidden(read(personaId));
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, [personaId]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const isVisible = useCallback((path: string) => !hiddenSet.has(path), [hiddenSet]);
  const setVisible = useCallback(
    (path: string, visible: boolean) => {
      const next = visible
        ? hidden.filter((item) => item !== path)
        : [...new Set([...hidden, path])];
      setHidden(next);
      write(personaId, next);
    },
    [hidden, personaId],
  );
  const reset = useCallback(() => {
    setHidden([]);
    write(personaId, []);
  }, [personaId]);

  return { hidden, isVisible, setVisible, reset };
}
