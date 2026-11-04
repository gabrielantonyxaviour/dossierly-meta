import { describe, expect, it } from "vitest";
import { ARTICLES, quote } from "../../src/lib/legal/articles";
import { DeadlineInputError, computeKpaDeadline } from "../../src/lib/legal/deadlines";

const days = (date: string, amount: number, kind: "delivery" | "letter_date" | "electronic" = "delivery") =>
  computeKpaDeadline({ start: { kind, date }, period: { amount, unit: "days" } });

describe("computeKpaDeadline days", () => {
  it("14 days from delivery on Tue 27 Oct 2026 ends Tue 10 Nov 2026", () => {
    const r = days("2026-10-27", 14);
    expect(r.startDate).toBe("2026-10-27");
    expect(r.dueDate).toBe("2026-11-10");
    expect(r.rule).toBe("KPA art. 57 §1, §4");
    expect(r.steps[0]).toBe("You received the letter on Tuesday, 27 October 2026. That day is not counted (KPA art. 57 §1).");
    expect(r.steps).toContain("The period is 14 days. Day 14 is Tuesday, 10 November 2026.");
    expect(r.steps).toContain("That is not a Saturday, Sunday or public holiday, so it stays.");
    expect(r.steps.join(" ")).toMatch(/Poczta Polska/);
    expect(r.citations.map((c) => c.label)).toEqual(["KPA art. 57 §1", "KPA art. 57 §4", "KPA art. 57 §5"]);
    expect(r.warnings).toEqual([]);
  });

  it("moves a Saturday end to Monday", () => {
    const r = days("2026-10-24", 14); // Sat 7 Nov -> Mon 9 Nov
    expect(r.dueDate).toBe("2026-11-09");
    expect(r.steps.join(" ")).toContain("Saturday, 7 November 2026 is a Saturday");
  });

  it("moves a Sunday end to Monday", () => {
    expect(days("2026-10-25", 14).dueDate).toBe("2026-11-09"); // Sun 8 Nov
  });

  it("moves 11 Nov 2026 (Wednesday holiday) to Thursday 12 Nov", () => {
    const r = days("2026-10-28", 14);
    expect(r.dueDate).toBe("2026-11-12");
    expect(r.steps.join(" ")).toContain("Independence Day, a public holiday");
  });

  it("rolls the 24-26 Dec 2026 chain and the Sunday to Monday 28 Dec", () => {
    const r = days("2026-12-10", 14); // Thu 24 Dec
    expect(r.dueDate).toBe("2026-12-28");
    const s = r.steps.join(" ");
    expect(s).toContain("Christmas Eve");
    expect(s).toContain("Monday, 28 December 2026");
  });

  it("moves an Easter Monday end (29 Mar 2027) to Tuesday 30 Mar", () => {
    expect(days("2027-03-15", 14).dueDate).toBe("2027-03-30");
  });

  it("handles Corpus Christi 2026 (4 Jun) and 2027 (27 May)", () => {
    expect(days("2026-05-21", 14).dueDate).toBe("2026-06-05");
    expect(days("2027-05-13", 14).dueDate).toBe("2027-05-28");
  });

  it("counts letter-date and electronic starts the same way", () => {
    const l = days("2026-10-27", 14, "letter_date");
    expect(l.dueDate).toBe("2026-11-10");
    expect(l.steps[0]).toContain("The letter is dated Tuesday, 27 October 2026");
    expect(l.warnings.join(" ")).toMatch(/not from the date printed/);
    const e = days("2026-10-27", 14, "electronic");
    expect(e.steps.join(" ")).toMatch(/e-Doręczenia/);
  });

  it("shows the letter's own sentence as a step when given", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2026-10-27" }, period: { amount: 14, unit: "days" }, quote: "w terminie 14 dni od dnia doręczenia" });
    expect(r.steps.join(" ")).toContain("“w terminie 14 dni od dnia doręczenia”");
  });
});

describe("computeKpaDeadline notice (awizo)", () => {
  it("first notice on 20 Oct 2026 is delivered on 3 Nov 2026, then +14 days", () => {
    const r = computeKpaDeadline({ start: { kind: "notice", firstNoticeDate: "2026-10-20" }, period: { amount: 14, unit: "days" } });
    expect(r.startDate).toBe("2026-11-03");
    expect(r.dueDate).toBe("2026-11-17");
    expect(r.rule).toBe("KPA art. 44 §4, art. 57 §1, §4");
    expect(r.citations[0].label).toBe("KPA art. 44 §4");
    expect(r.citations[0].quote).toBe(quote("kpa44", "4"));
  });
});

describe("computeKpaDeadline weeks and months", () => {
  it("1 week from a Tuesday ends the next Tuesday", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2026-10-27" }, period: { amount: 1, unit: "weeks" } });
    expect(r.dueDate).toBe("2026-11-03");
    expect(r.rule).toBe("KPA art. 57 §1, §2, §4");
  });

  it("1 month from 31 Jan 2027 ends 28 Feb 2027, a Sunday, so Monday 1 Mar", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2027-01-31" }, period: { amount: 1, unit: "months" } });
    const s = r.steps.join(" ");
    expect(s).toContain("last day, Sunday, 28 February 2027");
    expect(r.dueDate).toBe("2027-03-01");
  });

  it("1 month from 15 Oct 2026 keeps the date number", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2026-10-15" }, period: { amount: 1, unit: "months" } });
    expect(r.dueDate).toBe("2026-11-16"); // 15 Nov is a Sunday
  });

  it("rolls across a year end", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2026-12-01" }, period: { amount: 2, unit: "months" } });
    expect(r.dueDate).toBe("2027-02-01");
  });
});

describe("warnings and errors", () => {
  it("warns when an art. 64 summons gives fewer than 7 days", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2026-10-27" }, period: { amount: 5, unit: "days" }, legalBasis: "art. 64 § 2 KPA" });
    expect(r.warnings.join(" ")).toMatch(/at least 7 days/);
    expect(r.citations.some((c) => c.label === "KPA art. 64 §2")).toBe(true);
  });

  it("does not warn at 7 days or more", () => {
    const r = computeKpaDeadline({ start: { kind: "delivery", date: "2026-10-27" }, period: { amount: 7, unit: "days" }, legalBasis: "art. 64 § 2 KPA" });
    expect(r.warnings).toEqual([]);
  });

  it("throws a typed error for invalid dates and periods", () => {
    expect(() => days("2026-02-30", 14)).toThrow(DeadlineInputError);
    expect(() => days("27/10/2026", 14)).toThrow(DeadlineInputError);
    expect(() => computeKpaDeadline({ start: { kind: "notice", firstNoticeDate: "nope" }, period: { amount: 14, unit: "days" } })).toThrow(DeadlineInputError);
    expect(() => days("2026-10-27", 0)).toThrow(DeadlineInputError);
    expect(() => days("2026-10-27", 1.5)).toThrow(DeadlineInputError);
  });
});

describe("articles", () => {
  it("quotes the verbatim paragraph and rejects unknown ones", () => {
    expect(quote("kpa64", "2")).toContain("nie krótszym niż siedem dni");
    expect(quote("kpa44", "4")).toBe("Doręczenie uważa się za dokonane z upływem ostatniego dnia okresu, o którym mowa w § 1, a pismo pozostawia się w aktach sprawy.");
    expect(() => quote("kpa57", "9")).toThrow();
    expect(ARTICLES.uoc108.textPl).toContain("uważa się za legalny od dnia złożenia wniosku");
    expect(Object.values(ARTICLES).every((a) => a.verified && a.verifiedOn === "2026-11-04")).toBe(true);
  });
});
