import type {
	DayOverride,
	DaySummary,
	DayType,
	PeriodKind,
	PeriodSummary,
	Settings,
	TimeEntry,
	WorkModelMode,
} from "../types";
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
	workModelMode: "fixed_daily",
	weeklyTargetMinutes: 40 * 60,
	weekdayTargets: [0, 0, 0, 0, 0, 0, 0],
	showOvertimeBalance: true,
	showDailyDelta: true,
	desiredBalanceMinutes: 30,
};

function clampMinutes(value: number): number {
	return Math.max(0, Math.round(value));
}

function overlapsDate(entry: TimeEntry, dateKey: string, now: Date): boolean {
	const dayStart = fromDateKey(dateKey).getTime();
	const dayEnd = dayStart + 24 * 60 * 60 * 1000;
	const start = new Date(entry.start_time).getTime();
	const end = entry.end_time
		? new Date(entry.end_time).getTime()
		: now.getTime();
	return start < dayEnd && end > dayStart;
}

function minutesWithinDay(
	entry: TimeEntry,
	dateKey: string,
	now: Date,
): number {
	const dayStart = fromDateKey(dateKey).getTime();
	const dayEnd = dayStart + 24 * 60 * 60 * 1000;
	const start = Math.max(new Date(entry.start_time).getTime(), dayStart);
	const end = Math.min(
		entry.end_time ? new Date(entry.end_time).getTime() : now.getTime(),
		dayEnd,
	);
	return clampMinutes((end - start) / 60_000);
}

export function roundMinutes(
	minutes: number,
	mode: Settings["roundingMode"],
): number {
	if (mode === "off") return minutes;
	const step = Number(mode);
	return Math.round(minutes / step) * step;
}

export function shouldShowDailyDelta(settings: Settings): boolean {
	if (!settings.showDailyDelta) return false;
	return (
		settings.workModelMode !== "variable_weekly_target" &&
		settings.workModelMode !== "no_target_tracking"
	);
}

export function shouldShowOvertimeBalance(settings: Settings): boolean {
	if (!settings.showOvertimeBalance) return false;
	return settings.workModelMode !== "no_target_tracking";
}

export function shouldShowPeriodTarget(settings: Settings): boolean {
	return settings.workModelMode !== "no_target_tracking";
}

export function getTargetMinutesForDate(
	dateKey: string,
	override: DayOverride | undefined,
	settings: Settings,
): number | null {
	if (settings.trackingStartDate && dateKey < settings.trackingStartDate)
		return null;
	if (override?.target_minutes != null)
		return Math.max(0, override.target_minutes);

	const dayType = override?.day_type ?? "work";
	const mode: WorkModelMode = settings.workModelMode;

	if (mode === "no_target_tracking") return null;
	if (dayType === "sick" || dayType === "vacation" || dayType === "free")
		return 0;
	if (mode === "variable_weekly_target") return null;

	const weekday = fromDateKey(dateKey).getDay();

	if (mode === "custom_weekday_targets") {
		const value = settings.weekdayTargets[weekday];
		return Math.max(0, Number.isFinite(value) ? Math.round(value) : 0);
	}

	if (mode === "fixed_weekly_distributed") {
		if (!settings.workdays.includes(weekday)) return 0;
		const activeCount = settings.workdays.length;
		if (activeCount === 0) return 0;
		return Math.round(Math.max(0, settings.weeklyTargetMinutes) / activeCount);
	}

	return settings.workdays.includes(weekday)
		? settings.standardTargetMinutes
		: 0;
}

export function getTargetMinutes(
	dateKey: string,
	override: DayOverride | undefined,
	settings: Settings,
): number {
	return getTargetMinutesForDate(dateKey, override, settings) ?? 0;
}

export function getBreakMinutes(
	grossMinutes: number,
	override: DayOverride | undefined,
	settings: Settings,
): number {
	if (override?.manual_break_minutes != null)
		return Math.max(0, override.manual_break_minutes);
	if (
		settings.autoBreakEnabled &&
		grossMinutes >= settings.autoBreakThresholdMinutes
	) {
		return Math.min(settings.autoBreakMinutes, grossMinutes);
	}
	return 0;
}

function differenceFor(
	netMinutes: number,
	targetMinutes: number | null,
): number | null {
	if (targetMinutes == null) return null;
	return netMinutes - targetMinutes;
}

export function summarizeDay(
	dateKey: string,
	entries: TimeEntry[],
	override: DayOverride | undefined,
	settings: Settings,
	now = new Date(),
): DaySummary {
	const dayEntries = entries.filter((entry) => {
		if (
			settings.trackingStartDate &&
			toDateKey(new Date(entry.start_time)) < settings.trackingStartDate
		)
			return false;
		return overlapsDate(entry, dateKey, now);
	});
	const starts = dayEntries.map((entry) => entry.start_time).sort();
	const ended = dayEntries
		.filter((entry) => entry.end_time)
		.map((entry) => entry.end_time as string)
		.sort();
	const grossMinutes = dayEntries.reduce(
		(sum, entry) =>
			sum +
			roundMinutes(
				minutesWithinDay(entry, dateKey, now),
				settings.roundingMode,
			),
		0,
	);
	const breakMinutes = getBreakMinutes(grossMinutes, override, settings);
	const targetMinutes = getTargetMinutesForDate(dateKey, override, settings);
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
		differenceMinutes: differenceFor(netMinutes, targetMinutes),
		hasActiveSession: dayEntries.some((entry) => !entry.end_time),
		dayType,
		note: override?.note ?? null,
	};
}

interface PeriodOptions {
	settings?: Settings;
	kind?: PeriodKind;
}

function applicableDayCount(
	summaries: DaySummary[],
	settings: Settings | undefined,
): number {
	if (!settings) return summaries.length;
	if (!settings.trackingStartDate) return summaries.length;
	return summaries.filter((day) => day.date >= settings.trackingStartDate!)
		.length;
}

function periodTargetForSummaries(
	summaries: DaySummary[],
	options?: PeriodOptions,
): number | null {
	const settings = options?.settings;
	if (settings && settings.workModelMode === "no_target_tracking") return null;

	if (settings && settings.workModelMode === "variable_weekly_target") {
		const kind = options?.kind ?? "week";
		if (kind === "week") return Math.max(0, settings.weeklyTargetMinutes);
		const dayCount = applicableDayCount(summaries, settings);
		if (dayCount === 0) return 0;
		return Math.round(
			(Math.max(0, settings.weeklyTargetMinutes) / 7) * dayCount,
		);
	}

	const definedTargets = summaries.filter((day) => day.targetMinutes != null);
	if (definedTargets.length === 0) return null;
	return definedTargets.reduce((sum, day) => sum + (day.targetMinutes ?? 0), 0);
}

export function summarizePeriod(
	summaries: DaySummary[],
	options?: PeriodOptions,
): PeriodSummary {
	const netMinutes = summaries.reduce((sum, day) => sum + day.netMinutes, 0);
	const targetMinutes = periodTargetForSummaries(summaries, options);
	const differenceMinutes =
		targetMinutes == null ? null : netMinutes - targetMinutes;
	return { netMinutes, targetMinutes, differenceMinutes };
}

export function calculateFlexBalance(
	summaries: DaySummary[],
	startBalanceMinutes: number,
	options?: PeriodOptions,
): number | null {
	const settings = options?.settings;
	if (settings && settings.workModelMode === "no_target_tracking") return null;
	// Der aktuell laufende Tag (aktive Session) wird NICHT ins Gleitzeitkonto
	// eingerechnet. Sonst zieht das volle Tagessoll das Konto sofort beim
	// Einstempeln ins Minus. Das Konto aktualisiert sich erst beim Ausstempeln,
	// wenn die tatsaechlich gearbeitete Tagesdifferenz feststeht.
	const closedDays = summaries.filter((day) => !day.hasActiveSession);
	if (settings && settings.workModelMode === "variable_weekly_target") {
		const total = summarizePeriod(closedDays, {
			settings,
			kind: options?.kind ?? "year",
		});
		if (total.differenceMinutes == null) return null;
		return startBalanceMinutes + total.differenceMinutes;
	}
	const diffSum = closedDays.reduce(
		(sum, day) => sum + (day.differenceMinutes ?? 0),
		0,
	);
	return startBalanceMinutes + diffSum;
}

export function calculateTotalTrackedTime(summaries: DaySummary[]): number {
	return summaries.reduce((sum, day) => sum + day.netMinutes, 0);
}

export interface LeaveTimeEstimate {
	targetReached: boolean;
	hasDailyTarget: boolean;
	leaveAtZero: Date | null;
	leaveAtDesiredPlus: Date | null;
	minutesUntilZero: number;
	minutesUntilDesiredPlus: number;
}

export interface TodayExitInput {
	todayNetMinutes: number;
	todayTargetMinutes: number | null;
	balanceBeforeTodayMinutes: number | null;
	desiredBalanceMinutes?: number;
	now?: Date;
	isCurrentlyTracking?: boolean;
}

export interface TodayExitOptions {
	remainingToDailyTargetMinutes: number | null;
	currentBalanceIncludingTodayMinutes: number | null;
	remainingToZeroBalanceMinutes: number | null;
	remainingToDesiredBalanceMinutes: number | null;
	dailyTargetReached: boolean | null;
	zeroBalanceReached: boolean | null;
	desiredBalanceReached: boolean | null;
	exitAtZeroBalance: Date | null;
	exitAtDesiredBalance: Date | null;
	coveredByFlexMinutes: number | null;
}

export function calculateTodayExitOptions(
	input: TodayExitInput,
): TodayExitOptions {
	const {
		todayNetMinutes,
		todayTargetMinutes,
		balanceBeforeTodayMinutes,
		desiredBalanceMinutes = 0,
		now = new Date(),
		isCurrentlyTracking = false,
	} = input;

	const hasDailyTarget = todayTargetMinutes != null;
	const hasFlexAccount = balanceBeforeTodayMinutes != null;

	const remainingToDailyTargetMinutes = hasDailyTarget
		? Math.max(0, todayTargetMinutes! - todayNetMinutes)
		: null;
	const dailyTargetReached = hasDailyTarget
		? todayTargetMinutes! === 0 || todayNetMinutes >= todayTargetMinutes!
		: null;

	const accountActive = hasDailyTarget && hasFlexAccount;
	const currentBalanceIncludingTodayMinutes = accountActive
		? balanceBeforeTodayMinutes! + todayNetMinutes - todayTargetMinutes!
		: null;

	const remainingToZeroBalanceMinutes =
		currentBalanceIncludingTodayMinutes == null
			? null
			: Math.max(0, 0 - currentBalanceIncludingTodayMinutes);

	const remainingToDesiredBalanceMinutes =
		currentBalanceIncludingTodayMinutes == null
			? null
			: Math.max(
					0,
					desiredBalanceMinutes - currentBalanceIncludingTodayMinutes,
				);

	const zeroBalanceReached =
		remainingToZeroBalanceMinutes == null
			? null
			: remainingToZeroBalanceMinutes === 0;
	const desiredBalanceReached =
		remainingToDesiredBalanceMinutes == null
			? null
			: remainingToDesiredBalanceMinutes === 0;

	const coveredByFlexMinutes =
		remainingToDailyTargetMinutes == null ||
		remainingToZeroBalanceMinutes == null
			? null
			: Math.max(
					0,
					remainingToDailyTargetMinutes - remainingToZeroBalanceMinutes,
				);

	const exitAtZeroBalance =
		isCurrentlyTracking && remainingToZeroBalanceMinutes != null
			? new Date(now.getTime() + remainingToZeroBalanceMinutes * 60_000)
			: null;
	const exitAtDesiredBalance =
		isCurrentlyTracking && remainingToDesiredBalanceMinutes != null
			? new Date(now.getTime() + remainingToDesiredBalanceMinutes * 60_000)
			: null;

	return {
		remainingToDailyTargetMinutes,
		currentBalanceIncludingTodayMinutes,
		remainingToZeroBalanceMinutes,
		remainingToDesiredBalanceMinutes,
		dailyTargetReached,
		zeroBalanceReached,
		desiredBalanceReached,
		exitAtZeroBalance,
		exitAtDesiredBalance,
		coveredByFlexMinutes,
	};
}

export function calculateLeaveTimeEstimate(
	today: DaySummary,
	activeEntry: TimeEntry | null,
	desiredPlusMinutes: number,
	now = new Date(),
): LeaveTimeEstimate {
	const hasDailyTarget = today.targetMinutes != null;
	const target = today.targetMinutes ?? 0;
	const remainingToZero = Math.max(0, target - today.netMinutes);
	const desiredNetMinutes = target + Math.max(0, desiredPlusMinutes);
	const remainingToDesiredPlus = Math.max(
		0,
		desiredNetMinutes - today.netMinutes,
	);
	const active = Boolean(activeEntry && !activeEntry.end_time);

	return {
		targetReached:
			hasDailyTarget && (target === 0 || today.netMinutes >= target),
		hasDailyTarget,
		leaveAtZero:
			active && hasDailyTarget
				? new Date(now.getTime() + remainingToZero * 60_000)
				: null,
		leaveAtDesiredPlus:
			active && hasDailyTarget
				? new Date(now.getTime() + remainingToDesiredPlus * 60_000)
				: null,
		minutesUntilZero: remainingToZero,
		minutesUntilDesiredPlus: remainingToDesiredPlus,
	};
}

export function isEntryValid(startIso: string, endIso: string | null): boolean {
	if (!Number.isFinite(new Date(startIso).getTime())) return false;
	if (!endIso) return true;
	const start = new Date(startIso).getTime();
	const end = new Date(endIso).getTime();
	return Number.isFinite(end) && end > start;
}

export function isLongActiveSession(
	entry: TimeEntry | null,
	thresholdMinutes: number,
	now = new Date(),
): boolean {
	if (!entry || entry.end_time) return false;
	return (
		(now.getTime() - new Date(entry.start_time).getTime()) / 60_000 >=
		thresholdMinutes
	);
}

export function todayKey(now = new Date()): string {
	return toDateKey(now);
}
