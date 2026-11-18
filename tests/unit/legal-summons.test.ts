import { describe, expect, it } from "vitest";
import { DECISION_CLOCK_SUSPENDED_THROUGH, decisionClockNotice, summonsForLetterType, SUMMONS_RULES } from "../../src/lib/legal/summons";

describe("three summonses", () => {
  it("fingerprint summons ends in discontinuation under art. 106i, not left without consideration", () => {
    const r = summonsForLetterType("fingerprint-appointment")!;
    expect(r.consequence.code).toBe("discontinuation");
    expect(r.consequence.basis).toContain("106i");
    expect(r.consequence.en).not.toMatch(/application is left/);
    expect(r.minDays).toBe(7);
  });
  it("formal defect is KPA art. 64 §2, left without consideration", () => {
    const r = summonsForLetterType("wezwanie-braki-formalne")!;
    expect(r.basis).toBe("KPA art. 64 §2");
    expect(r.consequence.code).toBe("left-without-consideration");
    expect(r.quotePl).toContain("nie krótszym niż siedem dni");
  });
  it("evidence summons needs at least 14 days from delivery", () => {
    const r = SUMMONS_RULES["evidence-documents"];
    expect(r.minDays).toBe(14);
    expect(r.from).toBe("delivery");
    expect(r.consequence.basis).toContain("112a ust. 2 pkt 3");
  });
  it("unknown letter types map to nothing", () => expect(summonsForLetterType("decyzja")).toBeNull());
});

describe("art. 112a clock", () => {
  it("never allows an overdue claim through 2027-03-04", () => {
    for (const d of ["2026-11-18", "2027-03-03", DECISION_CLOCK_SUSPENDED_THROUGH]) {
      const n = decisionClockNotice(d);
      expect(n.suspended).toBe(true);
      expect(n.mayShowOverdue).toBe(false);
    }
  });
  it("applies after the suspension", () => expect(decisionClockNotice("2027-03-05").mayShowOverdue).toBe(true));
});
