import type { LeaveEntry, LeaveType, Settings, VacationOverview } from "../types";
import { addDays, fromDateKey, toDateKey } from "./dateUtils";

export function eachDateInRange(startDate: string, endDate: string): string[] {
  const start = fromDateKey(startDate);
  const end = fromDateKey(endDate);
  const dates: string[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(toDateKey(current));
  }
  return dates;
}

export function leaveMinutesPerDay(entry: LeaveEntry, standardTargetMinutes: number): number {
  if (entry.amount === "half_day") return standardTargetMinutes / 2;
  if (entry.amount === "custom") return Math.max(0, entry.custom_minutes ?? 0);
  return standardTargetMinutes;
}

export function leaveDaysForEntry(entry: LeaveEntry, standardTargetMinutes = 8 * 60): number {
  const days = eachDateInRange(entry.start_date, entry.end_date).length;
  const minutes = leaveMinutesPerDay(entry, standardTargetMinutes);
  if (standardTargetMinutes <= 0) return entry.amount === "half_day" ? days * 0.5 : days;
  return (days * minutes) / standardTargetMinutes;
}

export function findLeaveForDate(entries: LeaveEntry[], dateKey: string): LeaveEntry | undefined {
  return entries.find((entry) => entry.start_date <= dateKey && entry.end_date >= dateKey);
}

export function leaveTypeLabel(type: LeaveType): string {
  const labels: Record<LeaveType, string> = {
    vacation: "Urlaub",
    sick: "Krank",
    public_holiday: "Feiertag",
    time_off: "Frei",
    other: "Abwesenheit",
  };
  return labels[type];
}

export function vacationOverview(entries: LeaveEntry[], settings: Settings, today = new Date()): VacationOverview {
  const todayKey = toDateKey(today);
  const vacationEntries = entries.filter((entry) => entry.type === "vacation");
  const takenDays = vacationEntries
    .filter((entry) => entry.end_date < todayKey)
    .reduce((sum, entry) => sum + leaveDaysForEntry(entry, settings.standardTargetMinutes), 0);
  const plannedDays = vacationEntries
    .filter((entry) => entry.end_date >= todayKey)
    .reduce((sum, entry) => sum + leaveDaysForEntry(entry, settings.standardTargetMinutes), 0);
  const total = settings.annualVacationDays + settings.vacationCarryoverDays;
  return {
    annualDays: settings.annualVacationDays,
    carryoverDays: settings.vacationCarryoverDays,
    takenDays,
    plannedDays,
    remainingDays: total - takenDays - plannedDays,
  };
}
