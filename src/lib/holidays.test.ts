import { describe, expect, it } from "vitest";
import { easterSunday, germanHolidays } from "./holidays";
import { toDateKey } from "./dateUtils";

describe("holidays", () => {
  it("computes Easter Sunday correctly", () => {
    expect(toDateKey(easterSunday(2024))).toBe("2024-03-31");
    expect(toDateKey(easterSunday(2025))).toBe("2025-04-20");
    expect(toDateKey(easterSunday(2026))).toBe("2026-04-05");
    expect(toDateKey(easterSunday(2027))).toBe("2027-03-28");
  });

  it("returns no holidays for region none", () => {
    expect(germanHolidays(2026, "none")).toEqual([]);
  });

  it("includes nationwide holidays for every region", () => {
    const nw = germanHolidays(2026, "NW").map((h) => h.date);
    expect(nw).toContain("2026-01-01"); // Neujahr
    expect(nw).toContain("2026-04-03"); // Karfreitag (Ostern - 2)
    expect(nw).toContain("2026-04-06"); // Ostermontag
    expect(nw).toContain("2026-12-25");
    expect(nw).toContain("2026-12-26");
  });

  it("applies Bavaria-specific holidays", () => {
    const by = germanHolidays(2026, "BY");
    const dates = by.map((h) => h.date);
    expect(dates).toContain("2026-01-06"); // Heilige Drei Könige
    expect(dates).toContain("2026-11-01"); // Allerheiligen
    expect(dates).not.toContain("2026-10-31"); // Reformationstag nicht in BY
  });

  it("uses Reformationstag in eastern/northern states", () => {
    expect(germanHolidays(2026, "SN").map((h) => h.date)).toContain("2026-10-31");
  });

  it("computes Buß- und Bettag (Saxony) as the Wednesday before 23 Nov", () => {
    const bbt = germanHolidays(2026, "SN").find((h) => h.name === "Buß- und Bettag");
    expect(bbt?.date).toBe("2026-11-18");
  });

  it("sorts holidays ascending and has no duplicates", () => {
    const dates = germanHolidays(2026, "BW").map((h) => h.date);
    const sorted = [...dates].sort((a, b) => a.localeCompare(b));
    expect(dates).toEqual(sorted);
    expect(new Set(dates).size).toBe(dates.length);
  });
});
