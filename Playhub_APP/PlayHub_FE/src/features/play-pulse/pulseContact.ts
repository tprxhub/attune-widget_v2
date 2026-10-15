import { useCallback, useEffect, useState } from "react";
import type { PulseContact } from "@/api/playPulse";

const CONTACT_KEY = "playhub:play-pulse:contact";
const SAVED_KEY = "playhub:play-pulse:saved";

/**
 * The details a guest gave in the Play Pulse form, kept on this device so later checks show the
 * result straight away. `null` until read from storage on the client.
 */
export function usePulseContact(): [
  PulseContact | null | undefined,
  (contact: PulseContact | null) => void,
] {
  const [contact, setContact] = useState<PulseContact | null | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONTACT_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<PulseContact>) : null;
      setContact(saved?.name && saved.email && saved.phone ? (saved as PulseContact) : null);
    } catch {
      setContact(null);
    }
  }, []);
  const update = useCallback((next: PulseContact | null) => {
    setContact(next);
    try {
      if (next) window.localStorage.setItem(CONTACT_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(CONTACT_KEY);
    } catch {
      // Without storage the details are simply asked for again next time.
    }
  }, []);
  return [contact, update];
}

/** Which finished check was last saved, so revisiting the result doesn't save it twice. */
export function lastSavedCheck(): string | null {
  try {
    return window.localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

export function markCheckSaved(fingerprint: string | null) {
  try {
    if (fingerprint) window.localStorage.setItem(SAVED_KEY, fingerprint);
    else window.localStorage.removeItem(SAVED_KEY);
  } catch {
    // Not fatal: at worst the same check is saved again.
  }
}

const PHONE = /^\+?[0-9][0-9 ()-]{5,22}[0-9]$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The same rules the server applies, so mistakes are shown before sending. */
export function contactErrors(contact: PulseContact): Partial<Record<keyof PulseContact, string>> {
  const errors: Partial<Record<keyof PulseContact, string>> = {};
  if (contact.name.trim().replace(/\s+/g, " ").length < 2) errors.name = "Please enter your name.";
  const digits = contact.phone.replace(/\D/g, "").length;
  if (!PHONE.test(contact.phone.trim()) || digits < 7 || digits > 15)
    errors.phone = "Please enter a valid phone number, e.g. +971 50 123 4567.";
  if (!EMAIL.test(contact.email.trim())) errors.email = "Please enter a valid email address.";
  return errors;
}
