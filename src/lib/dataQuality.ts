import type { DaySummary, Settings, TimeEntry } from "../types";

export type DataQualityIssueType =
  | "open_session_too_long"
  | "zero_net_on_workday"
  | "net_over_limit"
  | "end_before_start"
  | "missing_break";

export interface DataQualityIssue {
  type: DataQualityIssueType;
  date: string;
  message: string;
  severity: "info" | "warning";
}

export function findSuspiciousDays(
  days: DaySummary[],
  entries: TimeEntry[],
  settings: Settings,
  now = new Date(),
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const entry of entries) {
    const start = new Date(entry.start_time);
    const end = entry.end_time ? new Date(entry.end_time) : null;
    const date = entry.start_time.slice(0, 10);

    if (entry.end_time == null && now.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
      issues.push({
        type: "open_session_too_long",
        date,
        message: "Offene Session laeuft seit mehr als 12 Stunden.",
        severity: "warning",
      });
    }

    if (end && end <= start) {
      issues.push({
        type: "end_before_start",
        date,
        message: "Eine Endzeit liegt vor oder auf der Startzeit.",
        severity: "warning",
      });
    }
  }

  for (const day of days) {
    if (day.targetMinutes > 0 && day.netMinutes === 0 && !day.hasActiveSession) {
      issues.push({
        type: "zero_net_on_workday",
        date: day.date,
        message: "Arbeitstag ohne Nettozeit.",
        severity: "info",
      });
    }

    if (day.netMinutes > 10 * 60) {
      issues.push({
        type: "net_over_limit",
        date: day.date,
        message: "Nettozeit liegt ueber 10 Stunden.",
        severity: "warning",
      });
    }

    if (settings.autoBreakEnabled && day.grossMinutes >= settings.autoBreakThresholdMinutes && day.breakMinutes === 0) {
      issues.push({
        type: "missing_break",
        date: day.date,
        message: "Pausenregel aktiv, aber keine Pause abgezogen.",
        severity: "info",
      });
    }
  }

  return issues;
}
