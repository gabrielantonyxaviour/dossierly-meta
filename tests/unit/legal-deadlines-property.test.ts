import { describe, expect, it } from "vitest";
import { computeKpaDeadline, type DeadlineInput } from "../../src/lib/legal/deadlines";

// Independent oracle: no imports from the calendar or holidays modules.
const DAY_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const plus = (s: string, n: number) => iso(utc(s) + n * DAY_MS);
const weekday = (s: string) => new Date(utc(s)).getUTCDay();
const EASTER: Record<number, string> = {
  2024: "2024-03-31", 2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28",
  2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21", 2031: "2031-04-13",
};
const FIXED = ["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-25", "12-26"];
function isHoliday(s: string): boolean {
  const y = Number(s.slice(0, 4));
  if (FIXED.includes(s.slice(5))) return true;
  if (y >= 2025 && s.slice(5) === "12-24") return true;
  return [0, 1, 49, 60].some((o) => plus(EASTER[y], o) === s);
}
const isOff = (s: string) => weekday(s) === 0 || weekday(s) === 6 || isHoliday(s);

function rawEnd(start: string, amount: number, unit: "days" | "weeks" | "months"): string {
  if (unit === "days") return plus(start, amount);
  if (unit === "weeks") return plus(start, amount * 7);
  const [y, m, d] = start.split("-").map(Number);
  const total = y * 12 + (m - 1) + amount;
  const yy = Math.floor(total / 12);
  const mm = total % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return iso(Date.UTC(yy, mm, Math.min(d, last)));
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const FIRST = utc("2024-01-01");
const SPAN = (utc("2030-12-31") - FIRST) / DAY_MS + 1;
type Unit = "days" | "weeks" | "months";
const MAX: Record<Unit, number> = { days: 60, weeks: 8, months: 12 };
const UNITS: Unit[] = ["days", "weeks", "months"];

interface Case { start: string; unit: Unit; amount: number }
function generate(n: number, seed: number): Case[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const unit = UNITS[Math.floor(rnd() * 3)];
    return { start: iso(FIRST + Math.floor(rnd() * SPAN) * DAY_MS), unit, amount: 1 + Math.floor(rnd() * MAX[unit]) };
  });
}
const run = (c: Case, kind: "delivery" | "letter_date" | "electronic" = "delivery") =>
  computeKpaDeadline({ start: { kind, date: c.start }, period: { amount: c.amount, unit: c.unit } });

const CASES = generate(2000, 20261105);

describe("deadline engine properties (2000 seeded cases, 2024-2030 starts)", () => {
  it("generates the intended number of cases", () => {
    expect(CASES).toHaveLength(2000);
    expect(new Set(UNITS.map((u) => CASES.filter((c) => c.unit === u).length > 400)).has(false)).toBe(false);
  });

  it("the due date is never a Saturday, Sunday or public holiday", () => {
    for (const c of CASES) {
      const due = run(c).dueDate;
      expect(isOff(due), `${JSON.stringify(c)} -> ${due}`).toBe(false);
    }
  });

  it("due date equals the independent raw end, rolled over days off only", () => {
    for (const c of CASES) {
      const r = run(c);
      const raw = rawEnd(c.start, c.amount, c.unit);
      expect(r.startDate).toBe(c.start);
      expect(utc(r.dueDate) >= utc(raw), JSON.stringify(c)).toBe(true);
      expect(utc(r.dueDate) - utc(raw) <= 5 * DAY_MS, `${JSON.stringify(c)} shift too long`).toBe(true);
      for (let d = raw; d < r.dueDate; d = plus(d, 1)) expect(isOff(d), `${JSON.stringify(c)} skipped ${d}`).toBe(true);
      if (!isOff(raw)) expect(r.dueDate).toBe(raw);
    }
  });

  it("days: due >= start + N exactly, never earlier", () => {
    for (const c of CASES.filter((x) => x.unit === "days")) {
      expect(utc(run(c).dueDate) >= utc(c.start) + c.amount * DAY_MS).toBe(true);
    }
  });

  it("weeks: an unshifted deadline lands on the start weekday", () => {
    for (const c of CASES.filter((x) => x.unit === "weeks")) {
      const raw = rawEnd(c.start, c.amount, "weeks");
      expect(weekday(raw)).toBe(weekday(c.start));
    }
  });

  it("monotone: a longer period never gives an earlier due date", () => {
    for (const c of CASES.slice(0, 600)) {
      if (c.amount >= MAX[c.unit]) continue;
      const shorter = run(c).dueDate;
      const longer = run({ ...c, amount: c.amount + 1 }).dueDate;
      expect(utc(longer) >= utc(shorter), JSON.stringify(c)).toBe(true);
    }
  });

  it("art. 44: a notice start equals a delivery on firstNoticeDate + 14 days", () => {
    for (const c of CASES) {
      const input: DeadlineInput = { start: { kind: "notice", firstNoticeDate: c.start }, period: { amount: c.amount, unit: c.unit } };
      const viaNotice = computeKpaDeadline(input);
      const viaDelivery = run({ ...c, start: plus(c.start, 14) });
      expect(viaNotice.startDate).toBe(plus(c.start, 14));
      expect(viaNotice.dueDate).toBe(viaDelivery.dueDate);
    }
  });

  it("is deterministic and the start kind does not change the date", () => {
    for (const c of CASES.slice(0, 500)) {
      expect(run(c)).toEqual(run(c));
      expect(run(c, "letter_date").dueDate).toBe(run(c).dueDate);
      expect(run(c, "electronic").dueDate).toBe(run(c).dueDate);
    }
  });

  it("always returns citations to art. 57 §4 and a non-empty step list", () => {
    for (const c of CASES.slice(0, 300)) {
      const r = run(c);
      expect(r.steps.length).toBeGreaterThanOrEqual(3);
      expect(r.citations.map((x) => x.label)).toContain("KPA art. 57 §4");
    }
  });
});

describe("named edge cases", () => {
  const due = (start: string, amount: number, unit: Unit) => run({ start, amount, unit }).dueDate;

  it("a period ending on Easter Sunday 2026 (5 Apr) skips Easter Monday to Tuesday 7 Apr", () => {
    expect(due("2026-03-22", 14, "days")).toBe("2026-04-07");
  });

  it("a week ending on Easter Monday 2026 (6 Apr) moves to Tuesday 7 Apr", () => {
    expect(due("2026-03-30", 1, "weeks")).toBe("2026-04-07");
  });

  it("a period ending on Saturday 4 Apr 2026 (before Easter) rolls through Sunday and Monday to Tuesday", () => {
    expect(due("2026-03-21", 14, "days")).toBe("2026-04-07");
  });

  it("1 November on a weekday (Mon 2027) moves to Tuesday 2 Nov", () => {
    expect(due("2027-10-18", 14, "days")).toBe("2027-11-02");
  });

  it("1 November on a Saturday (2025) moves to Monday 3 Nov", () => {
    expect(due("2025-10-18", 14, "days")).toBe("2025-11-03");
  });

  it("a period crossing a year end stays on a working day (20 Dec 2027 + 14 days = Mon 3 Jan 2028)", () => {
    expect(due("2027-12-20", 14, "days")).toBe("2028-01-03");
  });

  it("Epiphany 2029 (Sat 6 Jan) and New Year chain: 1 week from 30 Dec 2028 ends Sat 6 Jan, moves to Mon 8 Jan", () => {
    expect(due("2028-12-30", 1, "weeks")).toBe("2029-01-08");
  });

  it("month periods from 31 Jan clamp to the month end: 31 Jan 2028 + 1 month = Tue 29 Feb 2028", () => {
    const r = run({ start: "2028-01-31", amount: 1, unit: "months" });
    expect(r.dueDate).toBe("2028-02-29");
    expect(r.steps.join(" ")).toContain("last day");
  });

  it("31 Dec 2027 + 2 months clamps to 29 Feb 2028, and 31 Jan 2027 + 1 month clamps to 28 Feb 2027 then rolls", () => {
    expect(due("2027-12-31", 2, "months")).toBe("2028-02-29");
    expect(due("2027-01-31", 1, "months")).toBe("2027-03-01");
  });

  it("leap day start: 1 day is Wed 1 Mar 2028; 12 months clamps to Wed 28 Feb 2029", () => {
    expect(due("2028-02-29", 1, "days")).toBe("2028-03-01");
    expect(due("2028-02-29", 12, "months")).toBe("2029-02-28");
  });
});
