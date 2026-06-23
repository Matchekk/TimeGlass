import { describe, expect, it } from "vitest";
import { computeStatistics, formatStartMinutes } from "./statistics";
import type { DaySummary } from "../types";

function day(partial: Partial<DaySummary> & { date: string }): DaySummary {
	return {
		date: partial.date,
		firstStart: partial.firstStart ?? null,
		lastEnd: partial.lastEnd ?? null,
		grossMinutes: partial.grossMinutes ?? 0,
		breakMinutes: partial.breakMinutes ?? 0,
		netMinutes: partial.netMinutes ?? 0,
		targetMinutes: partial.targetMinutes ?? null,
		differenceMinutes: partial.differenceMinutes ?? null,
		hasActiveSession: partial.hasActiveSession ?? false,
		dayType: partial.dayType ?? "work",
		note: partial.note ?? null,
	};
}

describe("statistics", () => {
	const days = [
		day({
			date: "2026-05-18",
			firstStart: "2026-05-18T08:00:00",
			netMinutes: 480,
			targetMinutes: 480,
			differenceMinutes: 0,
		}),
		day({
			date: "2026-05-19",
			firstStart: "2026-05-19T09:00:00",
			netMinutes: 540,
			targetMinutes: 480,
			differenceMinutes: 60,
		}),
		day({
			date: "2026-05-20",
			firstStart: "2026-05-20T10:00:00",
			netMinutes: 300,
			targetMinutes: 480,
			differenceMinutes: -180,
		}),
		day({
			date: "2026-05-23",
			netMinutes: 0,
			targetMinutes: 0,
			differenceMinutes: 0,
		}), // freier Tag, ignoriert
	];

	it("counts worked days and ignores zero-net days", () => {
		expect(computeStatistics(days).workedDays).toBe(3);
	});

	it("averages net minutes over worked days", () => {
		expect(computeStatistics(days).averageNetMinutes).toBe(440); // (480+540+300)/3
	});

	it("averages the start time", () => {
		// 08:00, 09:00, 10:00 -> 09:00 = 540 min
		expect(computeStatistics(days).averageStartMinutes).toBe(540);
	});

	it("finds longest and shortest worked days", () => {
		const stats = computeStatistics(days);
		expect(stats.longestDay).toEqual({ date: "2026-05-19", netMinutes: 540 });
		expect(stats.shortestDay).toEqual({ date: "2026-05-20", netMinutes: 300 });
	});

	it("classifies over/under/on-target days (only real target days)", () => {
		const stats = computeStatistics(days);
		expect(stats.overtimeDays).toBe(1);
		expect(stats.undertimeDays).toBe(1);
		expect(stats.onTargetDays).toBe(1);
	});

	it("handles empty input", () => {
		const stats = computeStatistics([]);
		expect(stats.workedDays).toBe(0);
		expect(stats.averageNetMinutes).toBeNull();
		expect(stats.longestDay).toBeNull();
	});

	it("formats start minutes", () => {
		expect(formatStartMinutes(540)).toBe("09:00");
		expect(formatStartMinutes(null)).toBe("—");
	});
});
