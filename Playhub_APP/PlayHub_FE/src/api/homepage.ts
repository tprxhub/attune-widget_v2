import { apiRequest } from "./client";
import { LEVEL_GUIDANCE } from "./domain";

/**
 * Editable copy for the public home page. The shape matches the API (`HomepageContent` in
 * PlayHub_BE/app/schemas.py) and is fixed because the page layout depends on it: three journey
 * steps, four week steps, four stats, three level descriptions, one to six stories.
 */
export interface HomeHero {
  eyebrow: string;
  title: string;
  title_highlight: string;
  description: string;
  primary_cta: string;
  secondary_cta: string;
  footnote: string;
  image_url: string;
}

export interface HomeJourneyStep {
  title: string;
  body: string;
  image_url: string;
}

export interface HomeWeekStep {
  when: string;
  title: string;
  body: string;
}

export interface HomeStat {
  value: string;
  label: string;
}

export interface HomeQuote {
  quote: string;
  name: string;
  role: string;
}

export interface HomeAudience {
  title: string;
  body: string;
  button_label: string;
}

export interface HomepageContent {
  hero: HomeHero;
  journey: { eyebrow: string; title: string; steps: HomeJourneyStep[] };
  skills: { title: string; description: string; button_label: string; all_plans_label: string };
  week: {
    eyebrow: string;
    title: string;
    title_highlight: string;
    description: string;
    button_label: string;
    image_url: string;
    steps: HomeWeekStep[];
    stats: HomeStat[];
  };
  levels: { eyebrow: string; title: string; descriptions: string[] };
  stories: { title: string; subtitle: string; quotes: HomeQuote[] };
  families: HomeAudience;
  schools: HomeAudience;
  footer: {
    title: string;
    description: string;
    button_label: string;
    blurb: string;
    copyright: string;
  };
}

/** What the page says until a Super Admin saves something else. */
export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  hero: {
    eyebrow: "The Toy Pharmacy",
    title: "Small doses of play,",
    title_highlight: "real skill change",
    description:
      "Play Hub turns one child-development goal into a one-week Play Plan: nine short entries, five Play Doses and two Redo Days — each one logged, scored and tracked.",
    primary_cta: "For families",
    secondary_cta: "For schools & clinics",
    footnote:
      "Families start free. Organisations are set up by The Toy Pharmacy with issued credentials.",
    image_url: "",
  },
  journey: {
    eyebrow: "How it works",
    title: "Your play journey",
    steps: [
      {
        title: "Pick a Play Plan",
        body: "Choose a skill area and a level. Rookie, Starter or Pro — Starter suits most children.",
        image_url: "",
      },
      {
        title: "Run a Play Dose",
        body: "Guided play each day, with the Activity written out step by step.",
        image_url: "",
      },
      {
        title: "Log the Session",
        body: "Record finish, help, Mood and a Parent win. Nothing is ever overwritten.",
        image_url: "",
      },
    ],
  },
  skills: {
    title: "Seven skill areas, one Play Kit",
    description:
      "Choose a skill area, then find the right Rookie, Starter or Pro plan for your child. Every plan uses the same Fine Motor Play Kit.",
    button_label: "Browse Play Plans",
    all_plans_label: "View all Play Plans",
  },
  week: {
    eyebrow: "The Play Plan week",
    title: "A week that",
    title_highlight: "builds over time",
    description:
      "Nine entries, fixed order, no guesswork. Sessions done offline can be logged later with a past date.",
    button_label: "Daily Check-In",
    image_url: "",
    steps: [
      {
        when: "Day 0",
        title: "Introduction",
        body: "Watch the short intro, then run the first Play Dose the same day.",
      },
      {
        when: "Days 1–2",
        title: "Finding the rhythm",
        body: "Two more Play Doses, scored as you go.",
      },
      {
        when: "Days 3–5",
        title: "Redo Day",
        body: "The same Activity comes back so the skill sticks, then two fresh Play Doses.",
      },
      {
        when: "Week end",
        title: "Level-Up Prompt",
        body: "The Final Redo Day closes the week and Play Hub suggests the next level.",
      },
    ],
    stats: [
      { value: "9", label: "entries in every Play Plan week" },
      { value: "7", label: "loggable sessions, scored 1–5" },
      { value: "3", label: "levels for every skill area" },
      { value: "1", label: "Fine Motor Play Kit throughout" },
    ],
  },
  levels: {
    eyebrow: "Levels",
    title: LEVEL_GUIDANCE,
    descriptions: [
      "Simple — the gentlest version of every Activity.",
      "Medium and the default. Start here for most children.",
      "Complex — step up when the week feels easy.",
    ],
  },
  stories: {
    title: "Real Play Hub stories",
    subtitle: "Families, schools and clinics run the same week, side by side.",
    quotes: [
      {
        quote:
          "A short routine after breakfast is the one we have managed to keep. Seeing the Support Score fall as less help was needed kept us going.",
        name: "Amira's mum",
        role: "Family account",
      },
      {
        quote:
          "I run the same Play Plan across six children and log every Session in the clinic. The Progress narrative writes my notes for me.",
        name: "Esther M.",
        role: "Paediatric therapist",
      },
      {
        quote:
          "The Redo Day is what changed things for us. Repeating the same Activity made my son far more confident by the weekend.",
        name: "Daniel O.",
        role: "Family account",
      },
    ],
  },
  families: {
    title: "Families",
    body: "Sign up free with email or Google and browse every Play Plan. The Introduction and the Day 0 Play Dose are unlocked. Subscribe per child for 3, 6 or 12 months to unlock the full week, log Sessions and invite your nanny.",
    button_label: "Create a free account",
  },
  schools: {
    title: "Schools & clinics",
    body: "Organisation accounts are created by The Toy Pharmacy — no self-serve sign-up. Organisation Admins enrol members, assign Moderators, log sessions and give parents a read-only view. Billed by license.",
    button_label: "Log in with issued credentials",
  },
  footer: {
    title: "Start this week's Play Plan",
    description: "A little play each day, nine entries, one clear picture of progress.",
    button_label: "Get started free",
    blurb: "Play Plans, Play Doses and honest progress tracking for children's fine motor skills.",
    copyright: "The Toy Pharmacy · Play Hub",
  },
};

/** Limits enforced by the API; the editor shows them as it goes. */
export const HOMEPAGE_LIMITS = { label: 80, heading: 160, paragraph: 600, quote: 700, stat: 12 };
export const MAX_QUOTES = 6;

/**
 * Lays saved copy over the defaults so anything missing or blank falls back to the built-in
 * text. The API validates on save, but the page should never break on an older or partial copy.
 */
export function mergeHomepageContent(stored: unknown): HomepageContent {
  const content = merge(DEFAULT_HOMEPAGE_CONTENT, stored);
  content.schools.body = content.schools.body
    .replace(/\bSeats\b/g, "Licenses")
    .replace(/\bseats\b/g, "licenses")
    .replace(/\bSeat\b/g, "License")
    .replace(/\bseat\b/g, "license");
  return content;
}

function merge<T>(defaults: T, stored: unknown): T {
  if (Array.isArray(defaults)) {
    if (!Array.isArray(stored) || stored.length === 0) return defaults;
    const fallback = defaults.at(-1);
    return stored.map((item, index) => merge(defaults[index] ?? fallback, item)) as T;
  }
  if (defaults && typeof defaults === "object") {
    const source =
      stored && typeof stored === "object" && !Array.isArray(stored)
        ? (stored as Record<string, unknown>)
        : {};
    return Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [key, merge(value, source[key])]),
    ) as T;
  }
  if (typeof defaults === "string") {
    if (typeof stored !== "string") return defaults;
    // Image URLs are optional and blank means "use the built-in picture".
    return stored.trim() !== "" || defaults === "" ? (stored as T) : defaults;
  }
  return defaults;
}

interface SiteContentResponse {
  content: unknown;
  updated_at: string | null;
}

export interface HomepageState {
  content: HomepageContent;
  /** True once a Super Admin has saved copy; false while the built-in text is showing. */
  customised: boolean;
  updatedAt: string | null;
}

export const HOMEPAGE_QUERY_KEY = ["homepage-content"] as const;

const ENDPOINT = "/site-content/homepage";

const toState = (response: SiteContentResponse): HomepageState => ({
  content: mergeHomepageContent(response.content),
  customised: response.content != null,
  updatedAt: response.updated_at,
});

/** Public: no sign-in needed, so it works for visitors on the landing page. */
export async function loadHomepage(): Promise<HomepageState> {
  return toState(await apiRequest<SiteContentResponse>(ENDPOINT, { authenticated: false }));
}

export async function saveHomepage(content: HomepageContent): Promise<HomepageState> {
  return toState(
    await apiRequest<SiteContentResponse>(ENDPOINT, {
      method: "PUT",
      body: JSON.stringify(content),
    }),
  );
}

export async function resetHomepage(): Promise<void> {
  await apiRequest<void>(ENDPOINT, { method: "DELETE" });
}
