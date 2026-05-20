import { defaultSettings } from "../lib/timeCalculations";
import type { Settings } from "../types";
import { getDb } from "./schema";

const keys = {
  standardTargetMinutes: "standard_target_minutes",
  workdays: "workdays",
  startBalanceMinutes: "start_balance_minutes",
  autoBreakEnabled: "auto_break_enabled",
  autoBreakThresholdMinutes: "auto_break_threshold_minutes",
  autoBreakMinutes: "auto_break_minutes",
} as const;

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<Array<{ key: string; value: string }>>("SELECT key, value FROM settings");
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    standardTargetMinutes: Number(values.get(keys.standardTargetMinutes) ?? defaultSettings.standardTargetMinutes),
    workdays: JSON.parse(values.get(keys.workdays) ?? JSON.stringify(defaultSettings.workdays)) as number[],
    startBalanceMinutes: Number(values.get(keys.startBalanceMinutes) ?? defaultSettings.startBalanceMinutes),
    autoBreakEnabled: (values.get(keys.autoBreakEnabled) ?? "false") === "true",
    autoBreakThresholdMinutes: Number(values.get(keys.autoBreakThresholdMinutes) ?? defaultSettings.autoBreakThresholdMinutes),
    autoBreakMinutes: Number(values.get(keys.autoBreakMinutes) ?? defaultSettings.autoBreakMinutes),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  const pairs: Array<[string, string]> = [
    [keys.standardTargetMinutes, String(settings.standardTargetMinutes)],
    [keys.workdays, JSON.stringify(settings.workdays)],
    [keys.startBalanceMinutes, String(settings.startBalanceMinutes)],
    [keys.autoBreakEnabled, String(settings.autoBreakEnabled)],
    [keys.autoBreakThresholdMinutes, String(settings.autoBreakThresholdMinutes)],
    [keys.autoBreakMinutes, String(settings.autoBreakMinutes)],
  ];

  for (const [key, value] of pairs) {
    await db.execute("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      key,
      value,
    ]);
  }
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
