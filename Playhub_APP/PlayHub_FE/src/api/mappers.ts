import { planPriceLabel } from "@/lib/money";
import type {
  Attempt,
  PermissionKey,
  AvatarSticker,
  Child,
  Goal,
  Level,
  Org,
  PlanEntry,
  PlayPlan,
  Session,
  StaffMember,
  Subscription,
} from "@/lib/types";
import {
  apiAssetUrl,
  type ApiAttempt,
  type ApiChild,
  type ApiOrganisation,
  type ApiPlan,
  type ApiUser,
} from "./client";

const levelNames: Record<string, Level> = {
  rookie: "Rookie",
  starter: "Starter",
  pro: "Pro",
};

function ageFromDate(dateOfBirth: string | null) {
  if (!dateOfBirth) return 0;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return Math.max(0, age);
}

export function dateOfBirthForAge(age: number) {
  const today = new Date();
  return `${today.getFullYear() - age}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function mapSubscription(child: ApiChild): Subscription {
  const sub = child.subscription;
  const today = new Date().toISOString().slice(0, 10);
  const isActive = sub?.status === "active" && (!sub.ends_on || sub.ends_on >= today);
  const duration = sub?.plan_name?.match(/^(3m|6m|12m)$/)?.[1] as Subscription["duration"];
  return {
    childId: child.id,
    status: isActive
      ? "active"
      : sub?.status === "expired" || (sub?.status === "active" && !isActive)
        ? "expired"
        : "free",
    duration: duration ?? null,
    startedAt: sub?.started_on ?? null,
    expiresAt: sub?.ends_on ?? null,
    refundWindowEndsAt: sub?.refundable_until ?? null,
    renewalOpen: isActive && !!sub?.renewal_open,
    priceLabel: planPriceLabel(duration) ?? sub?.plan_name ?? null,
  };
}

export function mapChild(child: ApiChild): Child {
  const token = child.colour_token;
  return {
    id: child.id,
    name: child.name,
    age: ageFromDate(child.date_of_birth),
    ownerUserId: child.owner_id ?? child.admin_id ?? "",
    parentEmail: child.owner_email ?? undefined,
    accountType: child.account_scope === "organisation" ? "b2b" : "b2c",
    orgId: child.organisation_id ?? undefined,
    educatorId: child.admin_id ?? undefined,
    supporterId: child.moderator_id ?? undefined,
    currentPlanId: child.current_play_dose_id ?? "",
    freePlanGoalId: child.free_play_plan_id ?? undefined,
    planStartedAt: child.plan_started_at ?? new Date().toISOString().slice(0, 10),
    colorToken: token === "coral" || token === "amber" ? token : "blue",
    note: child.notes ?? undefined,
  };
}

export function mapGoal(plan: ApiPlan): Goal {
  const colour = plan.colour?.toLowerCase();
  return {
    id: plan.id,
    name: plan.name,
    short: plan.name,
    icon: plan.icon ?? "pinch",
    color: colour === "coral" || colour === "amber" ? colour : "blue",
    kit: "Fine Motor Play Kit",
    blurb: plan.short_description ?? plan.description ?? "",
    createdBy: plan.created_by_name ?? undefined,
    publicationStatus: plan.publication_status ?? "published",
    accessLocked: plan.access_locked ?? false,
  };
}

function entryLabel(kind: string, sequence: number) {
  if (kind === "introduction") return "Introduction";
  if (kind === "redo") return "Redo Day";
  if (kind === "level_up") return "Level Up";
  return `Activity #${sequence}`;
}

export function flattenPlans(plans: ApiPlan[]): PlayPlan[] {
  return plans.flatMap((parent) =>
    parent.play_doses.map((dose) => {
      const entries: PlanEntry[] = dose.activities.map((activity) => ({
        id: activity.id,
        kind:
          activity.kind === "introduction"
            ? "intro"
            : activity.kind === "level_up"
              ? "levelup"
              : activity.kind === "redo"
                ? "redo"
                : "dose",
        day: activity.day ?? 0,
        label: entryLabel(activity.kind, activity.sequence),
        title: activity.title,
        activity: activity.title,
        loggable: activity.is_loggable,
        minutes: activity.duration_minutes ?? 10,
        instructions: activity.instructions,
        videoLabel: activity.title,
        videoUrl: apiAssetUrl(activity.video_url),
        isRealLifeTry: activity.is_real_life_try,
        activities: [
          {
            id: activity.id,
            name: activity.title,
            minutes: activity.duration_minutes ?? 10,
            instructions: activity.instructions,
            instructionsHtml: activity.instructions_html ?? undefined,
            videoLabel: activity.title,
            videoUrl: apiAssetUrl(activity.video_url),
          },
        ],
      }));
      return {
        id: dose.id,
        goalId: parent.id,
        level: levelNames[dose.level] ?? "Starter",
        title: dose.title,
        summary: dose.summary ?? parent.short_description ?? "",
        kit: "Fine Motor Play Kit",
        age: dose.age_guidance ?? undefined,
        thumbnailUrl: apiAssetUrl(dose.thumbnail_url),
        safetyNote: dose.safety_note ?? undefined,
        createdBy: dose.created_by_name ?? undefined,
        publicationStatus: parent.publication_status ?? "published",
        entries,
      };
    }),
  );
}

export function mapAttempt(row: ApiAttempt, plans: PlayPlan[]): Attempt {
  const plan = plans.find((item) => item.id === row.play_dose_id);
  const entry = plan?.entries.find((item) => item.id === row.activity_id);
  return {
    id: row.id,
    childId: row.child_id,
    planId: row.play_dose_id,
    // Preserve a missing activity so corrections send null instead of a dose ID.
    entryId: row.activity_id ?? "",
    goalId: row.play_plan_id,
    level: plan?.level ?? "Starter",
    activity: entry?.activity ?? "Logged Attempt",
    date: row.occurred_on,
    createdAt: row.created_at,
    completion: row.completion_score,
    completionStatus: row.completion_status,
    helpLevel: row.help_level,
    supportScore: row.help_level
      ? ({ independent: 0, one_reminder: 33, few_reminders: 67, hands_on: 100 } as const)[
          row.help_level
        ]
      : null,
    isRealLifeTry: row.is_real_life_try,
    weekNumber: row.week_number,
    runNumber: row.run_number,
    mood: row.mood_score,
    bigWin: row.big_win ?? "",
    consultNotes: row.notes ?? undefined,
    source: row.source,
    loggedBy: row.logged_by_name,
  };
}

export function mapOrganisation(org: ApiOrganisation, licensesUsed = 0): Org {
  return {
    id: org.id,
    name: org.name,
    kind: org.kind.toLowerCase() === "clinic" ? "Clinic" : "School",
    licenses: org.seat_limit,
    licensesUsed,
    username: "Email-based sign in",
    password: "Managed by invitation",
    active: org.is_active,
    createdAt: org.created_at.slice(0, 10),
    billingCycle: org.billing_cycle?.toLowerCase() === "monthly" ? "Monthly" : "Annual",
    licensePrice: 0,
  };
}

export function mapStaff(user: ApiUser, children: ApiChild[]): StaffMember | null {
  if (user.role !== "admin" && user.role !== "moderator") return null;
  const role = user.role === "admin" ? "educator" : "supporter";
  const childCount = children.filter((child) =>
    role === "educator" ? child.admin_id === user.id : child.moderator_id === user.id,
  ).length;
  return {
    id: user.id,
    name: user.display_name,
    email: user.email,
    role,
    orgId: user.organisation_id ?? undefined,
    active: user.is_active,
    createdAt: user.created_at.slice(0, 10),
    childCount,
  };
}

export function sessionFromApi(user: ApiUser, children: ApiChild[]): Session {
  const mappedRole: Session["role"] =
    user.role === "super_admin"
      ? "super_admin"
      : user.role === "ttp_employee"
        ? "ttp_employee"
        : user.role === "moderator"
          ? "supporter"
          : user.role === "admin"
            ? user.account_scope === "organisation"
              ? "educator"
              : "parent"
            : "parent";
  const accountType: Session["accountType"] =
    user.account_scope === "platform"
      ? "platform"
      : user.account_scope === "organisation"
        ? "b2b"
        : "b2c";
  const isSubscribed = children.some((child) => mapSubscription(child).status === "active");
  return {
    personaId: user.id,
    personaLabel: user.display_name,
    userId: user.id,
    name: mappedRole === "parent" && children.length === 1 ? children[0]!.name : user.display_name,
    guardianName: mappedRole === "parent" && children.length === 1 ? user.display_name : undefined,
    email: user.email,
    avatarUrl: apiAssetUrl(user.avatar_url),
    avatarSticker: user.avatar_sticker as AvatarSticker | undefined,
    role: mappedRole,
    accountType,
    tier:
      accountType === "b2b"
        ? "org"
        : accountType === "b2c"
          ? isSubscribed
            ? "subscribed"
            : "free"
          : "none",
    orgId: user.organisation_id ?? undefined,
    childIds: children.map((child) => child.id),
    permissions:
      mappedRole === "ttp_employee"
        ? ((user.permissions as PermissionKey[] | undefined) ?? [])
        : undefined,
    homePath:
      mappedRole === "super_admin" || mappedRole === "ttp_employee"
        ? "/admin"
        : accountType === "b2b" && mappedRole !== "parent"
          ? "/org"
          : "/dashboard",
  };
}
