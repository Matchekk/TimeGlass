import { defaultSettings } from "../lib/timeCalculations";
import type { Settings } from "../types";
import { getDb } from "./schema";

const keys = {
  standardTargetMinutes: "standard_target_minutes",
  workdays: "workdays",
  trackingStartDate: "tracking_start_date",
  startBalanceMinutes: "start_balance_minutes",
  autoBreakEnabled: "auto_break_enabled",
  autoBreakThresholdMinutes: "auto_break_threshold_minutes",
  autoBreakMinutes: "auto_break_minutes",
  autostartEnabled: "autostart_enabled",
  startMinimized: "start_minimized",
  closeToTray: "close_to_tray",
  lowRamMode: "low_ram_mode",
  reminderLongSessionEnabled: "reminder_long_session_enabled",
  reminderLongSessionMinutes: "reminder_long_session_minutes",
  reminderClockOutEnabled: "reminder_clock_out_enabled",
  reminderClockOutTime: "reminder_clock_out_time",
  reminderNoTimeTodayEnabled: "reminder_no_time_today_enabled",
  reminderTargetReachedEnabled: "reminder_target_reached_enabled",
  unusualSessionMinutes: "unusual_session_minutes",
  notifyUnusualSession: "notify_unusual_session",
  roundingMode: "rounding_mode",
  annualVacationDays: "annual_vacation_days",
  vacationCarryoverDays: "vacation_carryover_days",
  vacationYear: "vacation_year",
  defaultPaidAbsenceBehavior: "default_paid_absence_behavior",
  lastExportAt: "last_export_at",
} as const;

function boolValue(value: string | undefined, fallback: boolean): boolean {
  return value == null ? fallback : value === "true";
}

function numberValue(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<Array<{ key: string; value: string }>>("SELECT key, value FROM settings");
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    standardTargetMinutes: numberValue(values.get(keys.standardTargetMinutes), defaultSettings.standardTargetMinutes),
    workdays: JSON.parse(values.get(keys.workdays) ?? JSON.stringify(defaultSettings.workdays)) as number[],
    trackingStartDate: values.get(keys.trackingStartDate) || defaultSettings.trackingStartDate,
    startBalanceMinutes: numberValue(values.get(keys.startBalanceMinutes), defaultSettings.startBalanceMinutes),
    autoBreakEnabled: boolValue(values.get(keys.autoBreakEnabled), defaultSettings.autoBreakEnabled),
    autoBreakThresholdMinutes: numberValue(values.get(keys.autoBreakThresholdMinutes), defaultSettings.autoBreakThresholdMinutes),
    autoBreakMinutes: numberValue(values.get(keys.autoBreakMinutes), defaultSettings.autoBreakMinutes),
    autostartEnabled: boolValue(values.get(keys.autostartEnabled), defaultSettings.autostartEnabled),
    startMinimized: boolValue(values.get(keys.startMinimized), defaultSettings.startMinimized),
    closeToTray: boolValue(values.get(keys.closeToTray), defaultSettings.closeToTray),
    lowRamMode: boolValue(values.get(keys.lowRamMode), defaultSettings.lowRamMode),
    reminderLongSessionEnabled: boolValue(values.get(keys.reminderLongSessionEnabled), defaultSettings.reminderLongSessionEnabled),
    reminderLongSessionMinutes: numberValue(values.get(keys.reminderLongSessionMinutes), defaultSettings.reminderLongSessionMinutes),
    reminderClockOutEnabled: boolValue(values.get(keys.reminderClockOutEnabled), defaultSettings.reminderClockOutEnabled),
    reminderClockOutTime: values.get(keys.reminderClockOutTime) ?? defaultSettings.reminderClockOutTime,
    reminderNoTimeTodayEnabled: boolValue(values.get(keys.reminderNoTimeTodayEnabled), defaultSettings.reminderNoTimeTodayEnabled),
    reminderTargetReachedEnabled: boolValue(values.get(keys.reminderTargetReachedEnabled), defaultSettings.reminderTargetReachedEnabled),
    unusualSessionMinutes: numberValue(values.get(keys.unusualSessionMinutes), defaultSettings.unusualSessionMinutes),
    notifyUnusualSession: boolValue(values.get(keys.notifyUnusualSession), defaultSettings.notifyUnusualSession),
    roundingMode: (values.get(keys.roundingMode) ?? defaultSettings.roundingMode) as typeof defaultSettings.roundingMode,
    annualVacationDays: numberValue(values.get(keys.annualVacationDays), defaultSettings.annualVacationDays),
    vacationCarryoverDays: numberValue(values.get(keys.vacationCarryoverDays), defaultSettings.vacationCarryoverDays),
    vacationYear: numberValue(values.get(keys.vacationYear), defaultSettings.vacationYear),
    defaultPaidAbsenceBehavior: (values.get(keys.defaultPaidAbsenceBehavior) ?? defaultSettings.defaultPaidAbsenceBehavior) as typeof defaultSettings.defaultPaidAbsenceBehavior,
    lastExportAt: values.get(keys.lastExportAt) ?? defaultSettings.lastExportAt,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  const pairs: Array<[string, string]> = [
    [keys.standardTargetMinutes, String(settings.standardTargetMinutes)],
    [keys.workdays, JSON.stringify(settings.workdays)],
    [keys.trackingStartDate, settings.trackingStartDate ?? ""],
    [keys.startBalanceMinutes, String(settings.startBalanceMinutes)],
    [keys.autoBreakEnabled, String(settings.autoBreakEnabled)],
    [keys.autoBreakThresholdMinutes, String(settings.autoBreakThresholdMinutes)],
    [keys.autoBreakMinutes, String(settings.autoBreakMinutes)],
    [keys.autostartEnabled, String(settings.autostartEnabled)],
    [keys.startMinimized, String(settings.startMinimized)],
    [keys.closeToTray, String(settings.closeToTray)],
    [keys.lowRamMode, String(settings.lowRamMode)],
    [keys.reminderLongSessionEnabled, String(settings.reminderLongSessionEnabled)],
    [keys.reminderLongSessionMinutes, String(settings.reminderLongSessionMinutes)],
    [keys.reminderClockOutEnabled, String(settings.reminderClockOutEnabled)],
    [keys.reminderClockOutTime, settings.reminderClockOutTime],
    [keys.reminderNoTimeTodayEnabled, String(settings.reminderNoTimeTodayEnabled)],
    [keys.reminderTargetReachedEnabled, String(settings.reminderTargetReachedEnabled)],
    [keys.unusualSessionMinutes, String(settings.unusualSessionMinutes)],
    [keys.notifyUnusualSession, String(settings.notifyUnusualSession)],
    [keys.roundingMode, settings.roundingMode],
    [keys.annualVacationDays, String(settings.annualVacationDays)],
    [keys.vacationCarryoverDays, String(settings.vacationCarryoverDays)],
    [keys.vacationYear, String(settings.vacationYear)],
    [keys.defaultPaidAbsenceBehavior, settings.defaultPaidAbsenceBehavior],
    [keys.lastExportAt, settings.lastExportAt ?? ""],
  ];

  for (const [key, value] of pairs) {
    await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      key,
      value,
    ]);
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    key,
    value,
  ]);
}

export async function getRawSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<Array<{ key: string; value: string }>>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function replaceRawSettings(settings: Record<string, string>): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM settings");
  for (const [key, value] of Object.entries(settings)) {
    await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2)", [key, value]);
  }
}
