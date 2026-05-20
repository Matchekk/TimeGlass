import { describe, expect, it } from "vitest";
import type { DayOverride, TimeEntry } from "../types";
import { calculateFlexBalance, defaultSettings, isLongActiveSession, roundMinutes, summarizeDay } from "./timeCalculations";

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

  it("uses target 0 before tracking start date", () => {
    const summary = summarizeDay("2026-05-17", [], undefined, { ...defaultSettings, trackingStartDate: "2026-05-18" }, now);
    expect(summary.targetMinutes).toBe(0);
    expect(summary.differenceMinutes).toBe(0);
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
});
