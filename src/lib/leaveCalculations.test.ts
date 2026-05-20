import { describe, expect, it } from "vitest";
import type { LeaveEntry } from "../types";
import { defaultSettings } from "./timeCalculations";
import { leaveDaysForEntry, vacationOverview } from "./leaveCalculations";

function leave(input: Partial<LeaveEntry>): LeaveEntry {
  return {
    id: 1,
    type: "vacation",
    start_date: "2026-05-01",
    end_date: "2026-05-01",
    amount: "full_day",
    custom_minutes: null,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

describe("leave calculations", () => {
  it("counts full vacation days", () => {
    expect(leaveDaysForEntry(leave({ start_date: "2026-05-01", end_date: "2026-05-03" }))).toBe(3);
  });

  it("counts half vacation days", () => {
    expect(leaveDaysForEntry(leave({ amount: "half_day" }))).toBe(0.5);
  });

  it("splits planned and taken vacation", () => {
    const overview = vacationOverview(
      [
        leave({ start_date: "2026-01-10", end_date: "2026-01-11" }),
        leave({ id: 2, start_date: "2026-12-01", end_date: "2026-12-01" }),
      ],
      defaultSettings,
      new Date("2026-06-01T00:00:00.000Z"),
    );
    expect(overview.takenDays).toBe(2);
    expect(overview.plannedDays).toBe(1);
  });

  it("calculates remaining vacation", () => {
    const overview = vacationOverview([leave({ start_date: "2026-01-10", end_date: "2026-01-11" })], {
      ...defaultSettings,
      annualVacationDays: 30,
      vacationCarryoverDays: 2,
    }, new Date("2026-06-01T00:00:00.000Z"));
    expect(overview.remainingDays).toBe(30);
  });
});
