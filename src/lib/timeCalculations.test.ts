import { describe, expect, it } from "vitest";
import type { DayOverride, Settings, TimeEntry } from "../types";
import {
  calculateFlexBalance,
  calculateLeaveTimeEstimate,
  calculateTodayExitOptions,
  calculateTotalTrackedTime,
  defaultSettings,
  getTargetMinutesForDate,
  isLongActiveSession,
  roundMinutes,
  shouldShowDailyDelta,
  shouldShowOvertimeBalance,
  summarizeDay,
  summarizePeriod,
} from "./timeCalculations";

function entry(start: string, end: string | null): TimeEntry {
  return {
    id: Math.random(),
    start_time: start,
    end_time: end,
    note: null,
    created_at: start,
    updated_at: end ?? start,
  };
}

const date = "2026-05-20";
const now = new Date("2026-05-20T12:00:00.000Z");

describe("time calculations", () => {
  it("calculates day net with one session", () => {
    const summary = summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", "2026-05-20T16:00:00.000Z")], undefined, defaultSettings, now);
    expect(summary.netMinutes).toBe(480);
  });

  it("calculates day net with multiple sessions", () => {
    const summary = summarizeDay(
      date,
      [
        entry("2026-05-20T08:00:00.000Z", "2026-05-20T12:00:00.000Z"),
        entry("2026-05-20T13:00:00.000Z", "2026-05-20T17:00:00.000Z"),
      ],
      undefined,
      defaultSettings,
      now,
    );
    expect(summary.netMinutes).toBe(480);
  });

  it("calculates positive day difference", () => {
    const summary = summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", "2026-05-20T17:30:00.000Z")], undefined, defaultSettings, now);
    expect(summary.differenceMinutes).toBe(90);
  });

  it("calculates negative day difference", () => {
    const summary = summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", "2026-05-20T15:00:00.000Z")], undefined, defaultSettings, now);
    expect(summary.differenceMinutes).toBe(-60);
  });

  it("uses target 0 for free days", () => {
    const override: DayOverride = {
      date,
      manual_break_minutes: null,
      target_minutes: null,
      day_type: "free",
      note: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const summary = summarizeDay(date, [], override, defaultSettings, now);
    expect(summary.targetMinutes).toBe(0);
    expect(summary.differenceMinutes).toBe(0);
  });

  it("keeps free days at target 0 even when workdays include the date", () => {
    const override: DayOverride = {
      date,
      manual_break_minutes: null,
      target_minutes: null,
      day_type: "free",
      note: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    expect(summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", "2026-05-20T09:00:00.000Z")], override, defaultSettings, now).targetMinutes).toBe(0);
  });

  it("treats days before tracking start as no target", () => {
    const summary = summarizeDay("2026-05-17", [], undefined, { ...defaultSettings, trackingStartDate: "2026-05-18" }, now);
    expect(summary.targetMinutes).toBe(null);
    expect(summary.differenceMinutes).toBe(null);
  });

  it("ignores sessions that started before tracking start date", () => {
    const summary = summarizeDay(
      "2026-05-18",
      [entry("2026-04-20T07:00:00.000Z", null)],
      undefined,
      { ...defaultSettings, trackingStartDate: "2026-05-18" },
      new Date("2026-05-18T16:00:00.000Z"),
    );
    expect(summary.netMinutes).toBe(0);
    expect(summary.differenceMinutes).toBe(-480);
  });

  it("adds start flex balance correctly", () => {
    const day = summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", "2026-05-20T17:00:00.000Z")], undefined, defaultSettings, now);
    expect(calculateFlexBalance([day], 120)).toBe(180);
  });

  it("includes active running session for live display", () => {
    const summary = summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", null)], undefined, defaultSettings, now);
    expect(summary.hasActiveSession).toBe(true);
    expect(summary.grossMinutes).toBe(240);
  });

  it("keeps raw minutes when rounding is off", () => {
    expect(roundMinutes(487, "off")).toBe(487);
  });

  it("rounds to 15 minutes when configured", () => {
    expect(roundMinutes(487, "15")).toBe(480);
    expect(roundMinutes(488, "15")).toBe(495);
  });

  it("detects long active sessions", () => {
    expect(isLongActiveSession(entry("2026-05-20T01:00:00.000Z", null), 600, now)).toBe(true);
  });

  it("calculates leave time for zero balance and desired plus", () => {
    const active = entry("2026-05-20T08:00:00.000Z", null);
    const summary = summarizeDay(date, [active], undefined, defaultSettings, now);
    const estimate = calculateLeaveTimeEstimate(summary, active, 30, now);
    expect(estimate.targetReached).toBe(false);
    expect(estimate.leaveAtZero?.toISOString()).toBe("2026-05-20T16:00:00.000Z");
    expect(estimate.leaveAtDesiredPlus?.toISOString()).toBe("2026-05-20T16:30:00.000Z");
  });

  it("marks daily target as reached", () => {
    const summary = summarizeDay(date, [entry("2026-05-20T08:00:00.000Z", "2026-05-20T16:00:00.000Z")], undefined, defaultSettings, now);
    expect(calculateLeaveTimeEstimate(summary, null, 30, now).targetReached).toBe(true);
  });
});

const trackingStart = "2026-05-01";
function buildSettings(partial: Partial<Settings>): Settings {
  return { ...defaultSettings, trackingStartDate: trackingStart, ...partial };
}

function dayEntry(dateKey: string, startHour: number, endHour: number): TimeEntry {
  const pad = (n: number) => String(n).padStart(2, "0");
  return entry(`${dateKey}T${pad(startHour)}:00:00.000Z`, `${dateKey}T${pad(endHour)}:00:00.000Z`);
}

describe("work model: fixed_daily", () => {
  const settings = buildSettings({ workModelMode: "fixed_daily", workdays: [1, 2, 3, 4, 5], standardTargetMinutes: 480 });
  it("8h target on a workday", () => {
    const monday = "2026-05-18";
    expect(getTargetMinutesForDate(monday, undefined, settings)).toBe(480);
  });
  it("0 target on a non-workday (Saturday)", () => {
    const saturday = "2026-05-23";
    expect(getTargetMinutesForDate(saturday, undefined, settings)).toBe(0);
  });
  it("-1h difference on a 7h work day", () => {
    const monday = "2026-05-18";
    const summary = summarizeDay(monday, [dayEntry(monday, 8, 15)], undefined, settings, new Date(`${monday}T18:00:00.000Z`));
    expect(summary.targetMinutes).toBe(480);
    expect(summary.differenceMinutes).toBe(-60);
  });
});

describe("work model: fixed_weekly_distributed", () => {
  const settings = buildSettings({
    workModelMode: "fixed_weekly_distributed",
    workdays: [1, 3, 5],
    weeklyTargetMinutes: 24 * 60,
  });
  it("derives 8h target on each active day", () => {
    expect(getTargetMinutesForDate("2026-05-18", undefined, settings)).toBe(480);
    expect(getTargetMinutesForDate("2026-05-20", undefined, settings)).toBe(480);
    expect(getTargetMinutesForDate("2026-05-22", undefined, settings)).toBe(480);
  });
  it("0 target on inactive workday (Tuesday)", () => {
    const tuesday = "2026-05-19";
    expect(getTargetMinutesForDate(tuesday, undefined, settings)).toBe(0);
    const summary = summarizeDay(tuesday, [], undefined, settings, new Date(`${tuesday}T18:00:00.000Z`));
    expect(summary.differenceMinutes).toBe(0);
  });
  it("Tuesday with no work creates no negative balance", () => {
    const tuesday = "2026-05-19";
    const summary = summarizeDay(tuesday, [], undefined, settings, new Date(`${tuesday}T18:00:00.000Z`));
    expect(summary.targetMinutes).toBe(0);
    expect(summary.differenceMinutes).toBe(0);
  });
  it("respects 20h spread over 4 days = 5h each", () => {
    const fourDayWeek = buildSettings({
      workModelMode: "fixed_weekly_distributed",
      workdays: [1, 2, 3, 4],
      weeklyTargetMinutes: 20 * 60,
    });
    expect(getTargetMinutesForDate("2026-05-18", undefined, fourDayWeek)).toBe(300);
  });
});

describe("work model: custom_weekday_targets", () => {
  const settings = buildSettings({
    workModelMode: "custom_weekday_targets",
    weekdayTargets: [0, 240, 360, 0, 300, 0, 0],
  });
  it("uses Monday target 4h", () => {
    expect(getTargetMinutesForDate("2026-05-18", undefined, settings)).toBe(240);
  });
  it("uses Tuesday target 6h", () => {
    expect(getTargetMinutesForDate("2026-05-19", undefined, settings)).toBe(360);
  });
  it("uses 0 for Wednesday (no work scheduled)", () => {
    expect(getTargetMinutesForDate("2026-05-20", undefined, settings)).toBe(0);
  });
});

describe("work model: variable_weekly_target", () => {
  const settings = buildSettings({
    workModelMode: "variable_weekly_target",
    weeklyTargetMinutes: 20 * 60,
  });
  const monday = "2026-05-18";
  it("daily target is null", () => {
    expect(getTargetMinutesForDate(monday, undefined, settings)).toBeNull();
  });
  it("Monday with 0h work creates no daily underhours", () => {
    const summary = summarizeDay(monday, [], undefined, settings, new Date(`${monday}T18:00:00.000Z`));
    expect(summary.targetMinutes).toBeNull();
    expect(summary.differenceMinutes).toBeNull();
  });
  it("week with 18h is -2h weekly balance", () => {
    const weekDays = ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"];
    const summaries = weekDays.map((key) => summarizeDay(key, [], undefined, settings, new Date(`${key}T18:00:00.000Z`)));
    // simulate net = 18h by injecting netMinutes via override-equivalent entries: just construct
    const synthetic = summaries.map((s, idx) => ({ ...s, netMinutes: idx === 0 ? 9 * 60 : idx === 1 ? 9 * 60 : 0 }));
    const week = summarizePeriod(synthetic, { settings, kind: "week" });
    expect(week.targetMinutes).toBe(20 * 60);
    expect(week.netMinutes).toBe(18 * 60);
    expect(week.differenceMinutes).toBe(-2 * 60);
  });
  it("week with 22h is +2h weekly balance", () => {
    const weekDays = ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"];
    const summaries = weekDays.map((key) => summarizeDay(key, [], undefined, settings, new Date(`${key}T18:00:00.000Z`)));
    const synthetic = summaries.map((s, idx) => ({ ...s, netMinutes: idx === 0 ? 11 * 60 : idx === 1 ? 11 * 60 : 0 }));
    const week = summarizePeriod(synthetic, { settings, kind: "week" });
    expect(week.differenceMinutes).toBe(2 * 60);
  });
  it("daily delta is hidden", () => {
    expect(shouldShowDailyDelta(settings)).toBe(false);
  });
  it("overtime balance derives from weekly total (not daily)", () => {
    const days = ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"];
    const summaries = days.map((key, idx) => ({
      ...summarizeDay(key, [], undefined, settings, new Date(`${key}T18:00:00.000Z`)),
      netMinutes: idx < 2 ? 11 * 60 : 0,
    }));
    const flex = calculateFlexBalance(summaries, 0, { settings, kind: "week" });
    expect(flex).toBe(22 * 60 - 20 * 60);
  });
});

describe("work model: no_target_tracking", () => {
  const settings = buildSettings({ workModelMode: "no_target_tracking" });
  const monday = "2026-05-18";
  it("daily target is null", () => {
    expect(getTargetMinutesForDate(monday, undefined, settings)).toBeNull();
  });
  it("daily difference is null even on workdays", () => {
    const summary = summarizeDay(monday, [dayEntry(monday, 8, 12)], undefined, settings, new Date(`${monday}T18:00:00.000Z`));
    expect(summary.netMinutes).toBe(240);
    expect(summary.targetMinutes).toBeNull();
    expect(summary.differenceMinutes).toBeNull();
  });
  it("period target/difference are null", () => {
    const summaries = [summarizeDay(monday, [dayEntry(monday, 8, 12)], undefined, settings, new Date(`${monday}T18:00:00.000Z`))];
    const period = summarizePeriod(summaries, { settings, kind: "week" });
    expect(period.targetMinutes).toBeNull();
    expect(period.differenceMinutes).toBeNull();
    expect(period.netMinutes).toBe(240);
  });
  it("flex balance is null (not active)", () => {
    const summaries = [summarizeDay(monday, [dayEntry(monday, 8, 12)], undefined, settings, new Date(`${monday}T18:00:00.000Z`))];
    expect(calculateFlexBalance(summaries, 0, { settings, kind: "year" })).toBeNull();
  });
  it("total tracked time aggregates regardless", () => {
    const summaries = [
      summarizeDay(monday, [dayEntry(monday, 8, 12)], undefined, settings, new Date(`${monday}T18:00:00.000Z`)),
      summarizeDay("2026-05-19", [dayEntry("2026-05-19", 9, 11)], undefined, settings, new Date(`2026-05-19T18:00:00.000Z`)),
    ];
    expect(calculateTotalTrackedTime(summaries)).toBe(360);
  });
  it("shouldShowDailyDelta and OvertimeBalance return false", () => {
    expect(shouldShowDailyDelta(settings)).toBe(false);
    expect(shouldShowOvertimeBalance(settings)).toBe(false);
  });
});

describe("leave/absence behavior across work models", () => {
  const monday = "2026-05-18";
  it("vacation on a workday with target keeps target 0 for delta calc (default behavior)", () => {
    const settings = buildSettings({ workModelMode: "fixed_daily" });
    const override: DayOverride = {
      date: monday,
      manual_break_minutes: null,
      target_minutes: null,
      day_type: "vacation",
      note: null,
      created_at: "x",
      updated_at: "x",
    };
    const summary = summarizeDay(monday, [], override, settings, new Date(`${monday}T18:00:00.000Z`));
    expect(summary.targetMinutes).toBe(0);
    expect(summary.differenceMinutes).toBe(0);
  });
  it("vacation on a target-0 day produces no extra hours", () => {
    const settings = buildSettings({ workModelMode: "fixed_daily", workdays: [1, 2, 3, 4, 5] });
    const saturday = "2026-05-23";
    const override: DayOverride = {
      date: saturday,
      manual_break_minutes: null,
      target_minutes: null,
      day_type: "vacation",
      note: null,
      created_at: "x",
      updated_at: "x",
    };
    const summary = summarizeDay(saturday, [], override, settings, new Date(`${saturday}T18:00:00.000Z`));
    expect(summary.targetMinutes).toBe(0);
    expect(summary.differenceMinutes).toBe(0);
  });
  it("no_target_tracking: vacation does not create any target correction", () => {
    const settings = buildSettings({ workModelMode: "no_target_tracking" });
    const override: DayOverride = {
      date: monday,
      manual_break_minutes: null,
      target_minutes: null,
      day_type: "vacation",
      note: null,
      created_at: "x",
      updated_at: "x",
    };
    const summary = summarizeDay(monday, [], override, settings, new Date(`${monday}T18:00:00.000Z`));
    expect(summary.targetMinutes).toBeNull();
    expect(summary.differenceMinutes).toBeNull();
  });
});

describe("calculateTodayExitOptions", () => {
  const fixedNow = new Date("2026-05-20T13:00:00.000Z");

  it("Fall A: no prior balance — daily-target rest equals account-0 rest", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: 8 * 60,
      balanceBeforeTodayMinutes: 0,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.remainingToDailyTargetMinutes).toBe(3 * 60);
    expect(out.remainingToZeroBalanceMinutes).toBe(3 * 60);
    expect(out.currentBalanceIncludingTodayMinutes).toBe(-3 * 60);
    expect(out.coveredByFlexMinutes).toBe(0);
    expect(out.dailyTargetReached).toBe(false);
    expect(out.zeroBalanceReached).toBe(false);
  });

  it("Fall B: +2h balance — daily 3h, account 1h, covered 2h", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: 8 * 60,
      balanceBeforeTodayMinutes: 2 * 60,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.remainingToDailyTargetMinutes).toBe(3 * 60);
    expect(out.remainingToZeroBalanceMinutes).toBe(60);
    expect(out.coveredByFlexMinutes).toBe(2 * 60);
    expect(out.currentBalanceIncludingTodayMinutes).toBe(-60);
  });

  it("Fall C: +4h balance — daily 3h, account 0h, account target reached", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: 8 * 60,
      balanceBeforeTodayMinutes: 4 * 60,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.remainingToDailyTargetMinutes).toBe(3 * 60);
    expect(out.remainingToZeroBalanceMinutes).toBe(0);
    expect(out.zeroBalanceReached).toBe(true);
    expect(out.currentBalanceIncludingTodayMinutes).toBe(60);
    expect(out.dailyTargetReached).toBe(false);
  });

  it("Fall D: +2h balance, desired +0:30 — remaining to desired 1:30", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: 8 * 60,
      balanceBeforeTodayMinutes: 2 * 60,
      desiredBalanceMinutes: 30,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.remainingToDesiredBalanceMinutes).toBe(90);
    expect(out.desiredBalanceReached).toBe(false);
  });

  it("Fall E: no_target_tracking — no daily-target/account/exit calculation", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: null,
      balanceBeforeTodayMinutes: null,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.remainingToDailyTargetMinutes).toBeNull();
    expect(out.remainingToZeroBalanceMinutes).toBeNull();
    expect(out.currentBalanceIncludingTodayMinutes).toBeNull();
    expect(out.exitAtZeroBalance).toBeNull();
    expect(out.exitAtDesiredBalance).toBeNull();
    expect(out.coveredByFlexMinutes).toBeNull();
  });

  it("Fall F: variable_weekly_target — no daily-target rest, no daily underhours", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: null,
      balanceBeforeTodayMinutes: 120,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.remainingToDailyTargetMinutes).toBeNull();
    expect(out.dailyTargetReached).toBeNull();
    expect(out.remainingToZeroBalanceMinutes).toBeNull();
    expect(out.exitAtZeroBalance).toBeNull();
  });

  it("computes exit times when tracking", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: 8 * 60,
      balanceBeforeTodayMinutes: 2 * 60,
      desiredBalanceMinutes: 30,
      isCurrentlyTracking: true,
      now: fixedNow,
    });
    expect(out.exitAtZeroBalance?.toISOString()).toBe("2026-05-20T14:00:00.000Z");
    expect(out.exitAtDesiredBalance?.toISOString()).toBe("2026-05-20T14:30:00.000Z");
  });

  it("no exit times when not tracking", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 5 * 60,
      todayTargetMinutes: 8 * 60,
      balanceBeforeTodayMinutes: 0,
      isCurrentlyTracking: false,
      now: fixedNow,
    });
    expect(out.exitAtZeroBalance).toBeNull();
    expect(out.exitAtDesiredBalance).toBeNull();
  });

  it("free day with target 0 → daily target reached, remaining 0", () => {
    const out = calculateTodayExitOptions({
      todayNetMinutes: 0,
      todayTargetMinutes: 0,
      balanceBeforeTodayMinutes: 0,
      isCurrentlyTracking: false,
      now: fixedNow,
    });
    expect(out.remainingToDailyTargetMinutes).toBe(0);
    expect(out.dailyTargetReached).toBe(true);
    expect(out.remainingToZeroBalanceMinutes).toBe(0);
    expect(out.zeroBalanceReached).toBe(true);
  });
});
