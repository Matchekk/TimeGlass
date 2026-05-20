export type DayType = "work" | "free" | "sick" | "vacation" | "other";

export interface TimeEntry {
  id: number;
  start_time: string;
  end_time: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayOverride {
  date: string;
  manual_break_minutes: number | null;
  target_minutes: number | null;
  day_type: DayType | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  standardTargetMinutes: number;
  workdays: number[];
  startBalanceMinutes: number;
  autoBreakEnabled: boolean;
  autoBreakThresholdMinutes: number;
  autoBreakMinutes: number;
}

export interface DaySummary {
  date: string;
  firstStart: string | null;
  lastEnd: string | null;
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  targetMinutes: number;
  differenceMinutes: number;
  hasActiveSession: boolean;
  dayType: DayType;
  note: string | null;
}

export interface PeriodSummary {
  netMinutes: number;
  targetMinutes: number;
  differenceMinutes: number;
}

export interface ImportExportPayload {
  version: 1;
  exportedAt: string;
  settings: Record<string, string>;
  time_entries: TimeEntry[];
  day_overrides: DayOverride[];
}
