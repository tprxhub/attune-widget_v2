import { useEffect } from "react";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import { assessmentHydrated, type PlayPulseState } from "@/store/play-pulse-slice";

const STORAGE_KEY = "playhub:play-pulse:v1";

export function usePlayPulsePersistence() {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    let saved: Partial<PlayPulseState> | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      saved = raw ? (JSON.parse(raw) as Partial<PlayPulseState>) : null;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    dispatch(assessmentHydrated(saved));

    return store.subscribe(() => {
      const { hydrated: _hydrated, ...persisted } = store.getState().playPulse;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch {
        // The in-memory Redux state remains usable when storage is unavailable.
      }
    });
  }, [dispatch, store]);
}
