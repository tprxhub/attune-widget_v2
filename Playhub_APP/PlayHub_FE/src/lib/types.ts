export type Role =
  "super_admin" | "ttp_employee" | "educator" | "supporter" | "parent" | "anonymous";

/** Pages a TTP employee can be allowed to use (their Overview is always available). */
export type PermissionKey =
  | "children"
  | "progress"
  | "audit"
  | "plans"
  | "homepage"
  | "organisations"
  | "team"
  | "billing"
  | "audit_activity"
  | "audit_accounts"
  | "audit_content"
  | "audit_billing"
  | "audit_organisations"
  | "audit_system";
export type AccountType = "b2c" | "b2b" | "platform" | "none";
export type Tier = "free" | "subscribed" | "org" | "none";

export type Level = "Rookie" | "Starter" | "Pro";
export const LEVELS: Level[] = ["Rookie", "Starter", "Pro"];

/** Mirrors the insight scenario of the latest completed Play Dose (Play Progress Logic Spec). */
export type StatusKey =
  "first_dose" | "progressing" | "holding_steady" | "needs_check_in" | "settling_in" | "no_data";
export type InsightScenario = "first" | "settling" | "consult" | "progressing" | "steady";
export type CompletionStatus = "finished" | "stopped_early";
export type HelpLevel = "hands_on" | "few_reminders" | "one_reminder" | "independent";
export type AvatarSticker =
  "bunny" | "bear" | "fox" | "owl" | "elephant" | "cat" | "turtle" | "duck";

export interface Session {
  personaId: string;
  personaLabel: string;
  userId: string;
  name: string;
  /** For individual child accounts: the parent/guardian who actually uses the account. */
  guardianName?: string | undefined;
  email: string;
  avatarUrl?: string | undefined;
  avatarSticker?: AvatarSticker | undefined;
  role: Role;
  accountType: AccountType;
  tier: Tier;
  orgId?: string | undefined;
  childIds: string[];
  homePath: string;
  /** For TTP employees: the pages they were given access to. */
  permissions?: PermissionKey[] | undefined;
}

export interface Goal {
  id: string;
  name: string;
  short: string;
  icon: string;
  color: "coral" | "blue" | "amber";
  kit: string;
  blurb: string;
  /** Full name of the person who created this Play Plan; absent for built-in plans. */
  createdBy?: string | undefined;
  publicationStatus?: "published" | "invisible" | "locked" | undefined;
}

export type EntryKind = "intro" | "dose" | "redo" | "levelup";

/** One activity inside a Play Dose, with at most one optional demo video. */
export interface PlanActivity {
  id: string;
  name: string;
  minutes: number;
  instructions: string[];
  /** The same steps with formatting from the admin editor (sanitised HTML from the API). */
  instructionsHtml?: string | undefined;
  /** Title shown on the video player for this activity. */
  videoLabel: string;
  /** Link to the demo video (MP4/YouTube/Vimeo). Empty until a video is uploaded. */
  videoUrl?: string | undefined;
  /** Browser-only file waiting to be uploaded when an admin saves the Play Dose. */
  videoFile?: File | undefined;
}

export interface PlanEntry {
  id: string;
  kind: EntryKind;
  day: number;
  label: string;
  title: string;
  activity: string;
  loggable: boolean;
  minutes: number;
  instructions: string[];
  /** Title shown on the video player for this Play Dose. */
  videoLabel: string;
  /** Link to the demo video (MP4/YouTube/Vimeo). Empty until a video is uploaded. */
  videoUrl?: string | undefined;
  /** Optional activity list; each Play Dose currently presents one focused activity. */
  activities?: PlanActivity[] | undefined;
  isRealLifeTry?: boolean | undefined;
}

export interface PlayPlan {
  id: string;
  goalId: string;
  level: Level;
  title: string;
  summary: string;
  kit: string;
  /** Suggested age range, e.g. "3+". */
  age?: string | undefined;
  /** Image shown on this Play Dose card. */
  thumbnailUrl?: string | undefined;
  safetyNote?: string | undefined;
  /** Full name of the person who created this Play Dose; absent for built-in content. */
  createdBy?: string | undefined;
  publicationStatus?: "published" | "invisible" | "locked" | undefined;
  entries: PlanEntry[];
}

export interface Child {
  id: string;
  name: string;
  age: number;
  ownerUserId: string;
  accountType: AccountType;
  orgId?: string | undefined;
  educatorId?: string | undefined;
  supporterId?: string | undefined;
  parentEmail?: string | undefined;
  currentPlanId: string;
  planStartedAt: string;
  colorToken: "coral" | "blue" | "amber";
  note?: string | undefined;
}

export interface Attempt {
  id: string;
  childId: string;
  planId: string;
  entryId: string;
  goalId: string;
  level: Level;
  activity: string;
  date: string;
  createdAt: string;
  completion: number;
  completionStatus: CompletionStatus;
  /** Only recorded when the child finished. */
  helpLevel: HelpLevel | null;
  /** Null when the child did not finish: the session has no score. */
  supportScore: 0 | 33 | 67 | 100 | null;
  isRealLifeTry: boolean;
  weekNumber: number;
  runNumber: number;
  mood: number;
  bigWin: string;
  consultNotes?: string | undefined;
  source: "play_dose" | "daily_check_in";
  loggedBy: string;
}

export type PlanDuration = "3m" | "6m" | "12m";

export interface Subscription {
  childId: string;
  status: "free" | "active" | "expired";
  duration: PlanDuration | null;
  startedAt: string | null;
  expiresAt: string | null;
  refundWindowEndsAt: string | null;
  priceLabel: string | null;
  /** True during the last days of a paid period, when the family can renew early. */
  renewalOpen: boolean;
}

export interface Org {
  id: string;
  name: string;
  kind: "School" | "Clinic";
  licenses: number;
  licensesUsed: number;
  username: string;
  password: string;
  active: boolean;
  createdAt: string;
  billingCycle: "Monthly" | "Annual";
  licensePrice: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Extract<Role, "educator" | "supporter">;
  orgId?: string | undefined;
  active: boolean;
  invitationPending?: boolean | undefined;
  createdAt: string;
  childCount: number;
}

export interface ProgressPoint {
  date: string;
  weekNumber: number;
  support: number | null;
  mood: number | null;
  level: Level;
  planId: string;
  doseId: string;
  finishedCount: number;
  kitSessionsLogged: number;
  realLifeTryPassed: boolean;
  passed: boolean;
  /** The Real-Life Try day is finished; until then the dose has no verdict. */
  complete: boolean;
  consultSuggested: boolean;
  /** Insight scenario, set by the API once the dose is complete. */
  scenario: InsightScenario | null;
  days: ProgressDay[];
}

/** One logged day inside a Play Dose: Day 1-5, or the Real-Life Try. */
export interface ProgressDay {
  day: number | null;
  isTry: boolean;
  date: string;
  finished: boolean;
  helpLevel: HelpLevel | null;
  score: number | null;
  mood: number | null;
  tryPassed: boolean | null;
}

export interface ProgressReport {
  childId: string;
  status: StatusKey;
  /** The Play Plan the child is working on now (their latest session's plan). */
  currentPlanId: string | null;
  headline: string;
  narrative: string;
  lastCheckIn: string | null;
  latestSessionDate: string | null;
  totalSessions: number;
  checkInCount: number;
  activitiesCompleted: number;
  supportScore: number | null;
  points: ProgressPoint[];
  averageCompletion: number;
  averageMood: number;
  fastTrackOffered: boolean;
  moveDownOffered: boolean;
  reminderDue: boolean;
}
