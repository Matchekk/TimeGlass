import type { DayOverride, DaySummary, DayType, PeriodSummary, Settings, TimeEntry } from "../types";
import { fromDateKey, toDateKey } from "./dateUtils";

export const defaultSettings: Settings = {
  standardTargetMinutes: 8 * 60,
  workdays: [1, 2, 3, 4, 5],
  trackingStartDate: "2026-05-18",
  startBalanceMinutes: 0,
  autoBreakEnabled: false,
  autoBreakThresholdMinutes: 6 * 60,
  autoBreakMinutes: 30,
  autostartEnabled: false,
  startMinimized: false,
  closeToTray: false,
  lowRamMode: true,
  reminderLongSessionEnabled: false,
  reminderLongSessionMinutes: 8 * 60,
  reminderClockOutEnabled: false,
  reminderClockOutTime: "17:00",
  reminderNoTimeTodayEnabled: false,
  reminderTargetReachedEnabled: false,
  unusualSessionMinutes: 10 * 60,
  notifyUnusualSession: false,
  roundingMode: "off",
  annualVacationDays: 30,
  vacationCarryoverDays: 0,
  vacationYear: new Date().getFullYear(),
  defaultPaidAbsenceBehavior: "target_zero",
  lastExportAt: null,
};

function clampMinutes(value: number): number {
  return Math.max(0, Math.round(value));
}

function overlapsDate(entry: TimeEntry, dateKey: string, now: Date): boolean {
  const dayStart = fromDateKey(dateKey).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const start = new Date(entry.start_time).getTime();
  const end = entry.end_time ? new Date(entry.end_time).getTime() : now.getTime();
  return start < dayEnd && end > dayStart;
}

function minutesWithinDay(entry: TimeEntry, dateKey: string, now: Date): number {
  const dayStart = fromDateKey(dateKey).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const start = Math.max(new Date(entry.start_time).getTime(), dayStart);
  const end = Math.min(entry.end_time ? new Date(entry.end_time).getTime() : now.getTime(), dayEnd);
  return clampMinutes((end - start) / 60_000);
}

export function roundMinutes(minutes: number, mode: Settings["roundingMode"]): number {
  if (mode === "off") return minutes;
  const step = Number(mode);
  return Math.round(minutes / step) * step;
}

export function getTargetMinutes(dateKey: string, override: DayOverride | undefined, settings: Settings): number {
  if (settings.trackingStartDate && dateKey < settings.trackingStartDate) return 0;
  if (override?.target_minutes != null) return override.target_minutes;
  const dayType = override?.day_type ?? "work";
  if (dayType === "sick" || dayType === "vacation" || dayType === "free") return 0;
  const weekday = fromDateKey(dateKey).getDay();
  return settings.workdays.includes(weekday) ? settings.standardTargetMinutes : 0;
}

export function getBreakMinutes(grossMinutes: number, override: DayOverride | undefined, settings: Settings): number {
  if (override?.manual_break_minutes != null) return Math.max(0, override.manual_break_minutes);
  if (settings.autoBreakEnabled && grossMinutes >= settings.autoBreakThresholdMinutes) {
    return Math.min(settings.autoBreakMinutes, grossMinutes);
  }
  return 0;
}

export function summarizeDay(
  dateKey: string,
  entries: TimeEntry[],
  override: DayOverride | undefined,
  settings: Settings,
  now = new Date(),
): DaySummary {
  const dayEntries = entries.filter((entry) => {
    if (settings.trackingStartDate && toDateKey(new Date(entry.start_time)) < settings.trackingStartDate) return false;
    return overlapsDate(entry, dateKey, now);
  });
  const starts = dayEntries.map((entry) => entry.start_time).sort();
  const ended = dayEntries.filter((entry) => entry.end_time).map((entry) => entry.end_time as string).sort();
  const grossMinutes = dayEntries.reduce((sum, entry) => sum + roundMinutes(minutesWithinDay(entry, dateKey, now), settings.roundingMode), 0);
  const breakMinutes = getBreakMinutes(grossMinutes, override, settings);
  const targetMinutes = getTargetMinutes(dateKey, override, settings);
  const dayType: DayType = override?.day_type ?? "work";
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);

  return {
    date: dateKey,
    firstStart: starts[0] ?? null,
    lastEnd: ended[ended.length - 1] ?? null,
    grossMinutes,
    breakMinutes,
    netMinutes,
    targetMinutes,
    differenceMinutes: netMinutes - targetMinutes,
    hasActiveSession: dayEntries.some((entry) => !entry.end_time),
    dayType,
    note: override?.note ?? null,
  };
}

export function summarizePeriod(summaries: DaySummary[]): PeriodSummary {
  return summaries.reduce(
    (total, day) => ({
      netMinutes: total.netMinutes + day.netMinutes,
      targetMinutes: total.targetMinutes + day.targetMinutes,
      differenceMinutes: total.differenceMinutes + day.differenceMinutes,
    }),
    { netMinutes: 0, targetMinutes: 0, differenceMinutes: 0 },
  );
}

export function calculateFlexBalance(summaries: DaySummary[], startBalanceMinutes: number): number {
  return startBalanceMinutes + summaries.reduce((sum, day) => sum + day.differenceMinutes, 0);
}

export function isEntryValid(startIso: string, endIso: string | null): boolean {
  if (!Number.isFinite(new Date(startIso).getTime())) return false;
  if (!endIso) return true;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Number.isFinite(end) && end > start;
}

export function isLongActiveSession(entry: TimeEntry | null, thresholdMinutes: number, now = new Date()): boolean {
  if (!entry || entry.end_time) return false;
  return (now.getTime() - new Date(entry.start_time).getTime()) / 60_000 >= thresholdMinutes;
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}
