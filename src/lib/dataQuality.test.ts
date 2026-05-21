import { describe, expect, it } from "vitest";
import type { DaySummary, TimeEntry } from "../types";
import { findSuspiciousDays } from "./dataQuality";
import { defaultSettings } from "./timeCalculations";

function day(input: Partial<DaySummary>): DaySummary {
  return {
    date: "2026-05-20",
    firstStart: null,
    lastEnd: null,
    grossMinutes: 0,
    breakMinutes: 0,
    netMinutes: 0,
    targetMinutes: 480,
    differenceMinutes: -480,
    hasActiveSession: false,
    dayType: "work",
    note: null,
    ...input,
  };
}

function entry(input: Partial<TimeEntry>): TimeEntry {
  return {
    id: 1,
    start_time: "2026-05-20T06:00:00.000Z",
    end_time: "2026-05-20T14:00:00.000Z",
    note: null,
    created_at: "2026-05-20T06:00:00.000Z",
    updated_at: "2026-05-20T14:00:00.000Z",
    ...input,
  };
}

describe("data quality checks", () => {
  it("detects active sessions older than 12 hours", () => {
    const issues = findSuspiciousDays(
      [],
      [entry({ start_time: "2026-05-20T00:00:00.000Z", end_time: null })],
      defaultSettings,
      new Date("2026-05-20T13:00:00.000Z"),
    );
    expect(issues.some((issue) => issue.type === "open_session_too_long")).toBe(true);
  });

  it("detects suspicious day summaries", () => {
    const issues = findSuspiciousDays(
      [day({}), day({ date: "2026-05-21", grossMinutes: 700, netMinutes: 650 })],
      [],
      defaultSettings,
    );
    expect(issues.map((issue) => issue.type)).toContain("zero_net_on_workday");
    expect(issues.map((issue) => issue.type)).toContain("net_over_limit");
  });

  it("detects end before start and missing break", () => {
    const issues = findSuspiciousDays(
      [day({ grossMinutes: 400, netMinutes: 400, breakMinutes: 0 })],
      [entry({ end_time: "2026-05-20T05:00:00.000Z" })],
      { ...defaultSettings, autoBreakEnabled: true, autoBreakThresholdMinutes: 360, autoBreakMinutes: 30 },
    );
    expect(issues.map((issue) => issue.type)).toContain("end_before_start");
    expect(issues.map((issue) => issue.type)).toContain("missing_break");
  });
});
