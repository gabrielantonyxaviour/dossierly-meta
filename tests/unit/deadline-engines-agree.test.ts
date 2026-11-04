/*
 * Two code paths compute day-count deadlines: the KPA engine (src/lib/legal/deadlines.ts: Look, MCP, Wonder) and
 * the older mail-reading helper (src/lib/features/deadline.ts: onboarding and inbox findings). Both must give the
 * same due date for every period in days, counted from delivery or from the letter date.
 */
import { describe, expect, it } from "vitest";
import { computeDeadline } from "../../src/lib/features/deadline";
import { computeKpaDeadline } from "../../src/lib/legal/deadlines";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.UTC(2024, 0, 1);
const SPAN_DAYS = Date.UTC(2030, 11, 31) / 86_400_000 - START / 86_400_000;
const isoAt = (offset: number) => new Date(START + offset * 86_400_000).toISOString().slice(0, 10);

describe("deadline engines agree", () => {
  const rand = mulberry32(20261105);
  const cases = Array.from({ length: 2000 }, () => ({
    date: isoAt(Math.floor(rand() * SPAN_DAYS)),
    days: 1 + Math.floor(rand() * 365),
    from: rand() < 0.8 ? ("delivery" as const) : ("letter_date" as const),
  }));

  it("gives the same due date on 2,000 seeded day-count cases (2024-2030, 1-365 days)", () => {
    const mismatches = cases.filter(({ date, days, from }) => {
      const older = computeDeadline({ rule: { days, from, quote: "" }, deliveryDate: date, letterDate: date, language: "en" });
      const kpa = computeKpaDeadline({ start: { kind: from, date }, period: { amount: days, unit: "days" } });
      return older?.date !== kpa.dueDate;
    });
    expect(mismatches).toEqual([]);
  });

  it("agrees across the holiday chains that move dates the most", () => {
    const tricky: Array<[string, number]> = [
      ["2026-12-10", 14], // ends Thu 24 Dec: 24-27 Dec off, so Mon 28 Dec
      ["2026-03-22", 14], // ends Easter Sunday 2026, so Tue 7 Apr
      ["2026-10-18", 14], // ends Sun 1 Nov 2026
      ["2027-10-28", 14], // ends Thu 11 Nov 2027
    ];
    for (const [date, days] of tricky) {
      const older = computeDeadline({ rule: { days, from: "delivery", quote: "" }, deliveryDate: date, letterDate: null, language: "en" });
      expect(older?.date).toBe(computeKpaDeadline({ start: { kind: "delivery", date }, period: { amount: days, unit: "days" } }).dueDate);
    }
  });
});
