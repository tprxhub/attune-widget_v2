import type { Attempt, Child, ProgressReport } from "@/lib/types";

import { fmtDate } from "@/lib/format";

export function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Progress export for a single child: summary block + one row per Attempt. */
export function childProgressCsv(child: Child, report: ProgressReport, attempts: Attempt[]) {
  const summary: (string | number)[][] = [
    ["Play Hub progress export"],
    ["Child", child.name],
    ["Exported", fmtDate(new Date().toISOString().slice(0, 10))],
    ["Status", report.status],
    ["Headline", report.headline],
    ["Sessions", report.totalSessions],
    ["Activities Completed", report.activitiesCompleted],
    ["Support Score", report.supportScore ?? ""],
    ["Last check-in", report.lastCheckIn ? fmtDate(report.lastCheckIn) : ""],
    [],
    [
      "Date",
      "Activity",
      "Level",
      "Finish status",
      "Help level",
      "Support Score",
      "Mood",
      "Parent win",
      "Source",
      "Logged by",
    ],
  ];
  const rows = [...attempts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => [
      fmtDate(a.date),
      a.activity,
      a.level,
      a.completionStatus,
      a.helpLevel,
      a.supportScore,
      a.mood,
      a.bigWin,
      a.source === "play_dose" ? "In activity" : "Daily Check-In",
      a.loggedBy,
    ]);
  return toCsv([...summary, ...rows]);
}
