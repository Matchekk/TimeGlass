import { describe, expect, it } from "vitest";
import { hasMonthStarted } from "./dateUtils";

describe("date utils", () => {
  it("keeps future months hidden until their first day", () => {
    expect(hasMonthStarted(new Date(2026, 5, 1), new Date("2026-05-31T12:00:00"))).toBe(false);
    expect(hasMonthStarted(new Date(2026, 5, 1), new Date("2026-06-01T00:00:00"))).toBe(true);
  });
});
