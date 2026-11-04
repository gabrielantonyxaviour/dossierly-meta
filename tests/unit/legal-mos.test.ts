import { describe, expect, it } from "vitest";
import { MOS_ANNEX_5_UNIVERSITY, MOS_ATTACHMENTS_STUDY, MOS_FEES, MOS_SECTIONS } from "../../src/lib/legal/mos-form";

describe("MOS form data", () => {
  it("has ordered sections A-G with unique, non-empty fields", () => {
    expect(MOS_SECTIONS.map((s) => s.id)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    const ids = MOS_SECTIONS.flatMap((s) => s.fields.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of MOS_SECTIONS) for (const f of s.fields) {
      expect(f.labelPl.length).toBeGreaterThan(2);
      expect(f.labelEn.length).toBeGreaterThan(2);
      expect(f.example.length).toBeGreaterThan(0);
      expect(f.caseKey === null || /^(profile|facts|documents)\./.test(f.caseKey)).toBe(true);
    }
  });

  it("keeps the official Polish labels of the key fields", () => {
    const byId = Object.fromEntries(MOS_SECTIONS.flatMap((s) => s.fields).map((f) => [f.id, f]));
    expect(byId["A.1"].labelPl).toBe("Nazwisko");
    expect(byId["C.number"].caseKey).toBe("documents.passport.number");
    expect(byId["E.III.b.2"].caseKey).toBe("profile.arrivalDate");
  });

  it("lists the three mandatory study attachments with the photo spec from the regulation", () => {
    const mandatory = MOS_ATTACHMENTS_STUDY.filter((a) => a.kind === "mandatory").map((a) => a.id);
    expect(mandatory).toEqual(["photo", "passport", "university_certificate"]);
    expect(MOS_ATTACHMENTS_STUDY.find((a) => a.id === "photo")?.spec).toContain("684 x 883");
    expect(MOS_ATTACHMENTS_STUDY.find((a) => a.id === "photo")?.spec).toContain("2.5 MB");
    expect(MOS_ATTACHMENTS_STUDY.every((a) => a.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("states fees from the stamp duty act and flags unverified payment timing", () => {
    const fee = Object.fromEntries(MOS_FEES.map((f) => [f.id, f]));
    expect(fee.stamp_duty_study.amountPln).toBe(340);
    expect(fee.stamp_duty_work.amountPln).toBe(440);
    expect(fee.residence_card.amountPln).toBe(100);
    expect(MOS_ATTACHMENTS_STUDY.find((a) => a.id === "stamp_duty_proof")?.verified).toBe(false);
    expect(MOS_ANNEX_5_UNIVERSITY.length).toBeGreaterThan(8);
  });
});
