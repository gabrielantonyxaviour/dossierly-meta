import { describe, expect, it } from "vitest";
import { handleCaseRequest } from "@/lib/case/handler";
import { memorySql } from "@/lib/case/memory-sql";
import { CaseStore } from "@/lib/case/store";
import { profilePatchSchema, profileSchema, type CaseSnapshot } from "@/lib/case/types";
import { planResidenceAction, residenceActionSchema, type ResidenceAction } from "@/lib/residence/actions";
import { checklist } from "@/lib/residence/checklist";
import { appealDeadline, daysSinceFiling, daysToFile, fileByDate, renewalPrepDate, startByDate, weekdayLabel } from "@/lib/residence/dates";
import { feeLines, feeTotal, familyIncomeNeeded, under16From } from "@/lib/residence/model";
import { currentStage, NEW_TO_OLD, OLD_TO_NEW, storedStage } from "@/lib/residence/stage";

/** A profile exactly as stored before the residence flow existed. */
const OLD_PROFILE = {
  fullName: "Arjun Raman", preferredLanguage: "en", country: "PL", city: "Warszawa", permitType: "temporary_residence_study", stage: "waiting_decision",
  organisation: "Politechnika Warszawska", arrivalDate: "2025-09-20", phone: { number: null, verified: false, callsEnabled: false }, timezone: "Europe/Warsaw",
};

function storeWith(profile: unknown): CaseStore {
  const sql = memorySql();
  const s = new CaseStore(sql);
  sql.exec("INSERT OR REPLACE INTO singles (key, json) VALUES (?, ?)", "profile", JSON.stringify(profile));
  return s;
}

const snap = (s: CaseStore) => s.snapshot();
/** Applies an action the way the route does (minus the network). */
function apply(s: CaseStore, a: ResidenceAction, today = "2026-11-18") {
  const plan = planResidenceAction(s.snapshot(), residenceActionSchema.parse(a), today);
  if (plan.facts) s.patchFacts(plan.facts);
  if (plan.profile) s.patchProfile(plan.profile);
  if (plan.deadline) s.create("deadlines", plan.deadline);
  return plan;
}

describe("residence profile fields", () => {
  it("an old stored profile still parses and patches", () => {
    expect(profileSchema.safeParse(OLD_PROFILE).success).toBe(true);
    const s = storeWith(OLD_PROFILE);
    const p = s.patchProfile({ voivodeship: "mazowieckie", legalStayUntil: "2027-01-14", situation: "renew" });
    expect(p.fullName).toBe("Arjun Raman");
    expect(p.legalStayUntil).toBe("2027-01-14");
  });

  it("accepts the new permit grounds and rejects bad values", () => {
    expect(profilePatchSchema.safeParse({ permitType: "temporary_residence_blue_card" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ permitType: "temporary_residence_family" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ voivodeship: "bavaria" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ legalStayUntil: "2027-02-30" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ household: [{ id: "m1", name: "A", relation: "cousin", birthYear: null, under16: false, permitType: "other" }] }).success).toBe(false);
  });

  it("the PATCH /profile route stores residence fields", async () => {
    const s = new CaseStore(memorySql());
    const res = await handleCaseRequest(s, new Request("https://case.do/profile", { method: "PATCH", body: JSON.stringify({ residenceStage: "prepare", voivodeship: "malopolskie" }) }));
    expect(res.status).toBe(200);
    expect(s.getProfile().voivodeship).toBe("malopolskie");
  });
});

describe("residence dates", () => {
  it("file by the last day of legal stay, start 8 weeks earlier, weekday spelled out", () => {
    expect(fileByDate("2027-01-14")).toBe("2027-01-14");
    expect(weekdayLabel(fileByDate("2027-01-14"))).toBe("Thursday 14 January 2027");
    expect(startByDate("2027-01-14")).toBe("2026-11-19");
    expect(weekdayLabel(startByDate("2027-01-14"))).toBe("Thursday 19 November 2026");
    expect(daysToFile("2027-01-14", "2026-11-19")).toBe(56);
    expect(daysToFile("2027-01-14", "2027-01-15")).toBe(-1);
  });

  it("renewal prep is 3 months before the permit ends; wait days count from filing", () => {
    expect(renewalPrepDate("2029-09-30")).toBe("2029-06-30");
    expect(weekdayLabel(renewalPrepDate("2029-09-30"))).toBe("Saturday 30 June 2029");
    expect(renewalPrepDate("2029-05-31")).toBe("2029-02-28");
    expect(daysSinceFiling("2026-12-08", "2027-02-01")).toBe(55);
  });

  it("appeal: 14 days from delivery, rolled past Christmas days off", () => {
    expect(appealDeadline("2027-11-12").dueDate).toBe("2027-11-26");
    expect(weekdayLabel(appealDeadline("2027-11-12").dueDate)).toBe("Friday 26 November 2027");
    const xmas = appealDeadline("2026-12-10");
    expect(xmas.dueDate > "2026-12-24").toBe(true);
    expect(weekdayLabel(xmas.dueDate)).toMatch(/^Monday/);
  });
});

describe("fees and family", () => {
  it("two transfers per person: 440/340 stamp duty, 100/50 card", () => {
    const lines = feeLines({ name: "Priya Nair", permitType: "temporary_residence_work" }, [
      { id: "mspouse01", name: "Arun Menon", relation: "spouse", birthYear: 1990, under16: false, permitType: "temporary_residence_family" },
      { id: "mchild001", name: "Meera Nair", relation: "child", birthYear: 2020, under16: true, permitType: "temporary_residence_family" },
    ]);
    expect(lines.map((l) => [l.stamp, l.card])).toEqual([[440, 100], [340, 100], [340, 50]]);
    expect(feeTotal(lines)).toBe(1370);
    expect(familyIncomeNeeded(2)).toBe(2469);
    expect(under16From(2012, "2027-01-14")).toBe(true);
    expect(under16From(2011, "2027-01-14")).toBe(false); // may already be 16: the full 100 zł is the safe amount
  });
});

describe("stage mapping", () => {
  it("maps every old stage onto the 8 and back", () => {
    expect(OLD_TO_NEW).toEqual({ just_arrived: "prepare", preparing_application: "prepare", filed: "waiting", waiting_decision: "waiting", decision_received: "decision" });
    expect(storedStage(profileSchema.parse(OLD_PROFILE))).toBe("waiting");
    expect(NEW_TO_OLD.after).toBe("decision_received");
  });

  it("derives the live stage from the case data", () => {
    const s = storeWith({ ...OLD_PROFILE, stage: "preparing_application" });
    expect(currentStage(snap(s))).toBe("prepare");
    s.patchFacts({ filedAt: { value: "2026-12-08", source: { type: "screenshot", ref: null }, confirmedByUser: true } });
    expect(currentStage(snap(s))).toBe("waiting");
    s.create("documents", { id: "doc_lk1", kind: "letter", title: "Wezwanie" });
    s.create("deadlines", { id: "ddl_lk1", title: "Send documents", dueDate: "2027-03-01", triggeredBy: "doc_lk1" });
    expect(currentStage(snap(s), new Date("2027-02-16T10:00:00Z"))).toBe("letter");
    s.patch("deadlines", "ddl_lk1", { status: "done" });
    s.create("appointments", { title: "Fingerprints", at: "2027-03-18T10:40:00+01:00" });
    expect(currentStage(snap(s), new Date("2027-03-16T10:00:00Z"))).toBe("visit");
    expect(currentStage(snap(s), new Date("2027-03-20T10:00:00Z"))).toBe("waiting");
  });
});

describe("residence actions", () => {
  it("persists checklist ticks and drops a removed member's fee ticks", () => {
    const s = storeWith(OLD_PROFILE);
    apply(s, { action: "household", members: [{ name: "Meera Nair", relation: "child", birthYear: 2020 }] });
    const child = s.getProfile().household![0]!;
    expect(child.under16).toBe(true);
    expect(child.permitType).toBe("temporary_residence_family");
    apply(s, { action: "tick", item: "edelivery", done: true });
    apply(s, { action: "tick", item: `fee_card_${child.id}`, done: true });
    const items = checklist(snap(s) as CaseSnapshot);
    expect(items.find((i) => i.id === "edelivery")?.done).toBe(true);
    expect(items.find((i) => i.id === `fee_card_${child.id}`)?.vars?.amount).toBe(50);
    apply(s, { action: "tick", item: "edelivery", done: false });
    apply(s, { action: "household", members: [] });
    expect(s.getProfile().checklistDone).toEqual([]);
    expect(residenceActionSchema.safeParse({ action: "tick", item: "drop table", done: true }).success).toBe(false);
  });

  it("ticks document items from the case and filing moves to waiting", () => {
    const s = storeWith({ ...OLD_PROFILE, stage: "preparing_application" });
    s.create("documents", { kind: "passport", title: "Passport, all pages" });
    expect(checklist(snap(s)).find((i) => i.id === "passport")).toMatchObject({ done: true, auto: true });
    apply(s, { action: "filed", filedOn: "2026-12-08", caseNumber: "WSC-II-P.6151.48213.2026" }, "2027-01-10");
    expect(s.getFacts().filedAt?.value).toBe("2026-12-08");
    expect(s.getFacts().caseNumber?.source.type).toBe("user");
    expect(currentStage(snap(s))).toBe("waiting");
    expect(() => apply(s, { action: "filed", filedOn: "2027-01-11", caseNumber: null }, "2027-01-10")).toThrow(/future/);
  });

  it("a refusal creates the appeal deadline; card collection needs an approval", () => {
    const s = storeWith(OLD_PROFILE);
    expect(() => apply(s, { action: "card", collectedOn: "2026-11-10" })).toThrow(/approval/);
    const plan = apply(s, { action: "decision", outcome: "refused", deliveredOn: "2026-11-12", validUntil: null });
    expect(plan.deadline?.dueDate).toBe("2026-11-26");
    expect(s.list("deadlines")[0]?.computation.rule).toBeTruthy();
    expect(currentStage(snap(s))).toBe("decision");
    const ok = planResidenceAction(snap(s), { action: "decision", outcome: "approved", deliveredOn: "2026-11-12", validUntil: "2029-09-30" }, "2026-11-18");
    expect(ok.removeDeadline).toBe("ddl_appeal");
    s.patchProfile(ok.profile!);
    apply(s, { action: "card", collectedOn: "2026-11-17" });
    expect(currentStage(snap(s))).toBe("after");
  });
});
