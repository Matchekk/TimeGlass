export type DayType = "work" | "free" | "sick" | "vacation" | "other";
export type LeaveType =
	| "vacation"
	| "sick"
	| "public_holiday"
	| "time_off"
	| "other";
export type LeaveAmount = "full_day" | "half_day" | "custom";
export type PaidAbsenceBehavior = "target_zero" | "counts_as_target";
export type RoundingMode = "off" | "5" | "10" | "15";
export type TrayLeftClickAction = "open" | "toggle_punch";
export type GermanRegion =
	| "none"
	| "BW"
	| "BY"
	| "BE"
	| "BB"
	| "HB"
	| "HH"
	| "HE"
	| "MV"
	| "NI"
	| "NW"
	| "RP"
	| "SL"
	| "SN"
	| "ST"
	| "SH"
	| "TH";

export type WorkModelMode =
	| "fixed_daily"
	| "fixed_weekly_distributed"
	| "custom_weekday_targets"
	| "variable_weekly_target"
	| "no_target_tracking";

export type PeriodKind = "day" | "week" | "month" | "year";
export type AppMode = "timeglass" | "plantglass";
export type PlantStatus =
	| "due_today"
	| "due_soon"
	| "ok"
	| "paused"
	| "snoozed_tomorrow";

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
	trackingStartDate: string | null;
	startBalanceMinutes: number;
	autoBreakEnabled: boolean;
	autoBreakThresholdMinutes: number;
	autoBreakMinutes: number;
	autostartEnabled: boolean;
	startMinimized: boolean;
	closeToTray: boolean;
	lowRamMode: boolean;
	reminderLongSessionEnabled: boolean;
	reminderLongSessionMinutes: number;
	reminderClockOutEnabled: boolean;
	reminderClockOutTime: string;
	reminderNoTimeTodayEnabled: boolean;
	reminderTargetReachedEnabled: boolean;
	unusualSessionMinutes: number;
	notifyUnusualSession: boolean;
	roundingMode: RoundingMode;
	annualVacationDays: number;
	vacationCarryoverDays: number;
	vacationYear: number;
	defaultPaidAbsenceBehavior: PaidAbsenceBehavior;
	lastExportAt: string | null;
	workModelMode: WorkModelMode;
	weeklyTargetMinutes: number;
	weekdayTargets: number[];
	showOvertimeBalance: boolean;
	showDailyDelta: boolean;
	desiredBalanceMinutes: number;
	globalShortcutEnabled: boolean;
	globalShortcutAccelerator: string;
	trayLeftClickAction: TrayLeftClickAction;
	autoBackupEnabled: boolean;
	autoBackupRetention: number;
	holidayRegion: GermanRegion;
	idleDetectionEnabled: boolean;
	idleThresholdMinutes: number;
}

export interface Plant {
	id: string;
	name: string;
	species: string | null;
	location: string;
	checkIntervalDays: number;
	nearHeater: boolean;
	heaterSensitive: boolean;
	lightNote: string | null;
	lastCheckedAt: string | null;
	lastWateredAt: string | null;
	snoozedUntil: string | null;
	notes: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface PlantGlassSettings {
	defaultCheckIntervalDays: number;
	defaultReminderTime: string;
	reminderEnabled: boolean;
	showInactivePlants: boolean;
}

export interface DaySummary {
	date: string;
	firstStart: string | null;
	lastEnd: string | null;
	grossMinutes: number;
	breakMinutes: number;
	netMinutes: number;
	targetMinutes: number | null;
	differenceMinutes: number | null;
	hasActiveSession: boolean;
	dayType: DayType;
	note: string | null;
}

export interface PeriodSummary {
	netMinutes: number;
	targetMinutes: number | null;
	differenceMinutes: number | null;
}

export interface ImportExportPayload {
	version: 1;
	exportedAt: string;
	settings: Record<string, string>;
	time_entries: TimeEntry[];
	day_overrides: DayOverride[];
	leave_entries?: LeaveEntry[];
}

export interface LeaveEntry {
	id: number;
	type: LeaveType;
	start_date: string;
	end_date: string;
	amount: LeaveAmount;
	custom_minutes: number | null;
	note: string | null;
	created_at: string;
	updated_at: string;
}

export interface VacationOverview {
	annualDays: number;
	carryoverDays: number;
	takenDays: number;
	plannedDays: number;
	remainingDays: number;
}

export interface Diagnostics {
	appVersion: string;
	tauriVersion: string;
	databasePath: string;
	timeEntryCount: number;
	leaveEntryCount: number;
	hasActiveSession: boolean;
	lastExportAt: string | null;
	autostartEnabled: boolean;
	notificationPermission: string;
	lowRamMode: boolean;
}
