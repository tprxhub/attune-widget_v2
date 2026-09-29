import type { Child, Org, ProgressReport } from "@/lib/types";
import { apiRequest, getApiChildren, type ApiProgress } from "./client";
import { mapChild } from "./mappers";
import { listOrgs } from "./admin";
import { listPlans } from "./plans";
import { reportFromApi } from "./progress";

export interface AdminProgressRow {
  child: Child;
  org: Org | null;
  planTitle: string;
  report: ProgressReport;
}

export interface AdminProgressGroup {
  /** An organisation, or null for individual (family) accounts. */
  org: Org | null;
  label: string;
  kind: "Organisation" | "Individual";
  rows: AdminProgressRow[];
  averageCompletion: number;
  averageSupportScore: number | null;
  totalSessions: number;
}

function summarise(org: Org | null, rows: AdminProgressRow[]): AdminProgressGroup {
  const totalSessions = rows.reduce((sum, r) => sum + r.report.totalSessions, 0);
  const scored = rows.filter((r) => r.report.totalSessions > 0);
  const averageCompletion = totalSessions
    ? Number(
        (
          scored.reduce(
            (sum, row) => sum + row.report.averageCompletion * row.report.totalSessions,
            0,
          ) / totalSessions
        ).toFixed(1),
      )
    : 0;
  const supportScores = scored.flatMap((row) =>
    row.report.supportScore === null ? [] : [row.report.supportScore],
  );
  return {
    org,
    label: org ? org.name : "Individual families",
    kind: org ? "Organisation" : "Individual",
    rows,
    averageCompletion,
    averageSupportScore: supportScores.length
      ? Math.round(supportScores.reduce((sum, score) => sum + score, 0) / supportScores.length)
      : null,
    totalSessions,
  };
}

/** Every child on the platform, grouped by organisation, with individuals last. */
export async function listPlatformProgress(): Promise<AdminProgressGroup[]> {
  const [rawChildren, orgs, plans, summaries] = await Promise.all([
    getApiChildren(),
    listOrgs(),
    listPlans(),
    apiRequest<ApiProgress[]>("/admin/progress"),
  ]);
  const children = rawChildren.map(mapChild);
  const rows = await Promise.all(
    children.map(async (child): Promise<AdminProgressRow> => ({
      child,
      org: child.orgId ? (orgs.find((org) => org.id === child.orgId) ?? null) : null,
      planTitle: plans.find((plan) => plan.id === child.currentPlanId)?.title ?? "No Play Plan",
      report: reportFromApi(
        summaries.find((summary) => summary.child_id === child.id) ?? {
          child_id: child.id,
          total_attempts: 0,
          average_completion_score: null,
          average_mood_score: null,
          check_in_count: 0,
          activities_completed: 0,
          support_score: null,
          last_check_in: null,
          trend: "insufficient_data",
          headline_status: "insufficient_data",
          fast_track_offered: false,
          move_down_offered: false,
          reminder_due: false,
          weekly_points: [],
          points: [],
        },
        plans,
      ),
    })),
  );
  const groups = orgs.map((org) =>
    summarise(
      org,
      rows.filter((row) => row.child.orgId === org.id),
    ),
  );
  const individuals = rows.filter((row) => !row.child.orgId);
  return [...groups, ...(individuals.length ? [summarise(null, individuals)] : [])];
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Flat CSV export of a group (or the whole platform when groups are combined). */
export function progressCsv(groups: AdminProgressGroup[]): string {
  const header = [
    "Account",
    "Account type",
    "Child",
    "Age",
    "Play Plan",
    "Status",
    "Sessions",
    "Activities Completed",
    "Support Score",
    "Avg Mood",
    "Last check-in",
  ];
  const lines = [header.join(",")];
  groups.forEach((group) => {
    group.rows.forEach(({ child, report, planTitle }) => {
      lines.push(
        [
          group.label,
          group.kind,
          child.name,
          child.age,
          planTitle,
          report.headline,
          report.totalSessions,
          report.activitiesCompleted,
          report.supportScore ?? "",
          report.totalSessions ? report.averageMood : "",
          report.lastCheckIn ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });
  return lines.join("\n");
}
