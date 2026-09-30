export type Role = "super_admin" | "educator" | "supporter" | "parent" | "anonymous";
export type AccountType = "b2c" | "b2b" | "platform" | "none";
export type Tier = "free" | "subscribed" | "org" | "none";

export type Level = "Rookie" | "Starter" | "Pro";
export const LEVELS: Level[] = ["Rookie", "Starter", "Pro"];

export type StatusKey =
  "progressing" | "holding_steady" | "needs_check_in" | "settling_in" | "no_data";
export type CompletionStatus = "finished" | "partly" | "stopped_early";
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
}

export interface Goal {
  id: string;
  name: string;
  short: string;
  icon: string;
  color: "coral" | "blue" | "amber";
  kit: string;
  blurb: string;
}

export type EntryKind = "intro" | "dose" | "redo" | "levelup";

/** One activity inside a Play Dose, with at most one optional demo video. */
export interface PlanActivity {
  id: string;
  name: string;
  minutes: number;
  instructions: string[];
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
  helpLevel: HelpLevel;
  supportScore: 0 | 33 | 67 | 100;
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
  consultSuggested: boolean;
}

export interface ProgressReport {
  childId: string;
  status: StatusKey;
  headline: string;
  narrative: string;
  lastCheckIn: string | null;
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
