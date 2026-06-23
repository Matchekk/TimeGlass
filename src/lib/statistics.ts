import type { DaySummary } from "../types";

export interface WorkStatistics {
	workedDays: number;
	averageNetMinutes: number | null;
	/** Durchschnittlicher Arbeitsbeginn in Minuten seit Mitternacht (lokal). */
	averageStartMinutes: number | null;
	longestDay: { date: string; netMinutes: number } | null;
	shortestDay: { date: string; netMinutes: number } | null;
	overtimeDays: number;
	undertimeDays: number;
	onTargetDays: number;
}

function startMinutesOfDay(iso: string): number {
	const date = new Date(iso);
	return date.getHours() * 60 + date.getMinutes();
}

export function computeStatistics(days: DaySummary[]): WorkStatistics {
	const workedDays = days.filter((day) => day.netMinutes > 0);

	const averageNetMinutes = workedDays.length
		? Math.round(
				workedDays.reduce((sum, day) => sum + day.netMinutes, 0) /
					workedDays.length,
			)
		: null;

	const starts = workedDays
		.filter((day) => day.firstStart)
		.map((day) => startMinutesOfDay(day.firstStart as string));
	const averageStartMinutes = starts.length
		? Math.round(starts.reduce((sum, value) => sum + value, 0) / starts.length)
		: null;

	let longestDay: WorkStatistics["longestDay"] = null;
	let shortestDay: WorkStatistics["shortestDay"] = null;
	for (const day of workedDays) {
		if (!longestDay || day.netMinutes > longestDay.netMinutes) {
			longestDay = { date: day.date, netMinutes: day.netMinutes };
		}
		if (!shortestDay || day.netMinutes < shortestDay.netMinutes) {
			shortestDay = { date: day.date, netMinutes: day.netMinutes };
		}
	}

	// Über-/Unterstunden nur für echte Soll-Tage (Sollzeit > 0).
	const targetDays = days.filter(
		(day) =>
			day.targetMinutes != null &&
			day.targetMinutes > 0 &&
			day.differenceMinutes != null,
	);
	let overtimeDays = 0;
	let undertimeDays = 0;
	let onTargetDays = 0;
	for (const day of targetDays) {
		const diff = day.differenceMinutes as number;
		if (diff > 0) overtimeDays += 1;
		else if (diff < 0) undertimeDays += 1;
		else onTargetDays += 1;
	}

	return {
		workedDays: workedDays.length,
		averageNetMinutes,
		averageStartMinutes,
		longestDay,
		shortestDay,
		overtimeDays,
		undertimeDays,
		onTargetDays,
	};
}

export function formatStartMinutes(minutes: number | null): string {
	if (minutes == null) return "—";
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
