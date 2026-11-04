import { describe, expect, it } from "vitest";
import { easterSunday, holidayName, isDayOff, isSaturday, polishHolidays } from "../../src/lib/legal/holidays";

describe("polishHolidays", () => {
  it("computes movable feasts", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    const h26 = polishHolidays(2026);
    expect(h26.has("2026-04-06")).toBe(true); // Easter Monday
    expect(h26.has("2026-05-24")).toBe(true); // Pentecost Sunday
    expect(h26.has("2026-06-04")).toBe(true); // Corpus Christi
    const h27 = polishHolidays(2027);
    expect(h27.has("2027-03-29")).toBe(true); // Easter Monday 2027
    expect(h27.has("2027-05-16")).toBe(true); // Pentecost
    expect(h27.has("2027-05-27")).toBe(true); // Corpus Christi 2027
  });

  it("has 14 statutory days from 2025 and 13 before (24 Dec)", () => {
    expect(polishHolidays(2026).size).toBe(14);
    expect(polishHolidays(2026).has("2026-12-24")).toBe(true);
    expect(polishHolidays(2024).size).toBe(13);
    expect(polishHolidays(2024).has("2024-12-24")).toBe(false);
  });

  it("includes the fixed holidays", () => {
    for (const md of ["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-25", "12-26"]) {
      expect(isDayOff(`2026-${md}`)).toBe(true);
    }
  });
});

describe("isDayOff / isSaturday", () => {
  it("treats Sundays and holidays as days off, but not Saturdays", () => {
    expect(isDayOff("2026-11-08")).toBe(true); // Sunday
    expect(isDayOff("2026-11-11")).toBe(true); // Wednesday holiday
    expect(isDayOff("2026-11-07")).toBe(false); // Saturday
    expect(isSaturday("2026-11-07")).toBe(true);
    expect(isDayOff("2026-11-10")).toBe(false);
  });
});

describe("holidayName", () => {
  it("names holidays in English and Polish", () => {
    expect(holidayName("2026-11-11")).toEqual({ en: "Independence Day", pl: "Narodowe Święto Niepodległości" });
    expect(holidayName("2027-03-29")?.pl).toBe("Poniedziałek Wielkanocny");
    expect(holidayName("2026-11-08")?.en).toBe("Sunday");
    expect(holidayName("2026-11-10")).toBeNull();
  });
});
