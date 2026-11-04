import { beforeEach, describe, expect, it } from "vitest";
import { caseClient } from "@/lib/case/client";
import { compareItems, isOfficial, numberCitations } from "@/lib/visit/compare";
import { buildVisitPlan } from "@/lib/visit/plan";
import { taskIdFor } from "@/lib/visit/save";
import { structuredSchema } from "@/lib/visit/types";

const NOW = new Date("2026-11-04T04:00:00Z");
const usage = { tokensIn: 100, tokensOut: 50, cachedTokens: 0 };
const CITES = [
  { url: "https://blog.example.com/pl-fingerprints", title: "Expat blog", start: 0, end: 1 },
  { url: "https://www.gov.pl/web/uw-mazowiecki/odciski#a", title: "Fingerprints - gov.pl", start: 0, end: 1 },
  { url: "https://www.gov.pl/web/uw-mazowiecki/odciski#b", title: "Fingerprints - gov.pl", start: 0, end: 1 },
];
const search = async () => ({ text: "Bring your passport, insurance and a photo.", citations: CITES, searches: 2, usage, model: "muse-spark-1.3" });
const structure = (data: unknown) => (async () => ({ data, usage, model: "muse-spark-1.3" })) as never;

async function seed(userId: string) {
  const c = caseClient(userId);
  await c.patchProfile({ fullName: "Arjun Raman", city: "Warsaw", permitType: "temporary_residence_study", stage: "filed" });
  await c.create("documents", { id: "d-pass", kind: "passport", title: "Passport", status: "have" });
  await c.create("documents", { id: "d-ins", kind: "health_insurance", title: "Insurance", status: "missing" });
  await c.create("appointments", { id: "ap1", title: "Fingerprints", at: "2026-11-12T09:30:00.000Z", location: { name: "Mazowiecki Voivodeship Office", address: "ul. Marszałkowska 3/5" } });
  return c;
}

const GOOD = {
  items: [
    { id: "passport", title: "Passport", detail: "Original.", sourceIdx: 1, matchKind: "passport" },
    { id: "insurance", title: "Health insurance", detail: "Valid policy.", sourceIdx: 1, matchKind: "health_insurance" },
    { id: "photo", title: "Photo", detail: "35x45 mm.", sourceIdx: 9, matchKind: "photo" },
    { id: "fee", title: "Be on time", detail: "Arrive early.", sourceIdx: null, matchKind: null },
  ],
  office: { name: "Mazowiecki Voivodeship Office", address: "Marszałkowska 3/5", note: "", sourceIdx: 1 },
  warnings: [],
};

describe("citations", () => {
  it("dedupes, strips fragments, puts official first", () => {
    const n = numberCitations(CITES);
    expect(n.map((c) => c.url)).toEqual(["https://www.gov.pl/web/uw-mazowiecki/odciski", "https://blog.example.com/pl-fingerprints"]);
    expect(isOfficial("https://migrant.wsc.mazowieckie.pl/x")).toBe(true);
    expect(isOfficial("https://notgov.pl.evil.com/")).toBe(false);
  });
});

describe("compareItems", () => {
  it("never marks have without a matching have document", async () => {
    const c = await seed("visit-cmp");
    const snap = await c.snapshot();
    const items = compareItems(structuredSchema.parse(GOOD), snap.documents, numberCitations(CITES));
    expect(items.map((i) => [i.id, i.status, i.caseDocId])).toEqual([
      ["passport", "have", "d-pass"], ["insurance", "missing", null], ["photo", "missing", null], ["fee", "unknown", null],
    ]);
    expect(items[0].source?.url).toContain("gov.pl");
    expect(items[2].source).toBeNull(); // out-of-range sourceIdx
  });
});

describe("buildVisitPlan", () => {
  let n = 0;
  beforeEach(() => { n++; });

  it("picks the next appointment, compares, and stays idempotent when saving", async () => {
    const c = await seed(`visit-main-${n}`);
    const stages: string[] = [];
    const deps = { search, structure: structure(GOOD), now: NOW, emit: (e: { type: string; stage?: string }) => e.stage && stages.push(e.stage) };
    const { plan } = await buildVisitPlan(c, { save: true }, deps as never);
    expect(stages).toEqual(["searching", "comparing"]);
    expect(plan.appointment?.id).toBe("ap1");
    expect(plan.searches).toBe(2);
    expect(plan.citations[0].official).toBe(true);
    expect(plan.savedTaskIds).toHaveLength(2);
    const again = await buildVisitPlan(c, { save: true }, deps as never);
    expect(again.plan.savedTaskIds).toEqual(plan.savedTaskIds);
    const snap = await c.snapshot();
    expect(snap.tasks.filter((t) => t.title.startsWith("Bring: "))).toHaveLength(2);
    expect(snap.tasks[0].origin).toBe("agent");
    expect(snap.appointments[0].prepTaskIds.sort()).toEqual([taskIdFor("ap1", "insurance"), taskIdFor("ap1", "photo")].sort());
  });

  it("warns when no official source is cited", async () => {
    const c = await seed(`visit-warn-${n}`);
    const blogOnly = async () => ({ text: "x", citations: [CITES[0]], searches: 1, usage, model: "m" });
    const { plan } = await buildVisitPlan(c, {}, { search: blogOnly, structure: structure(GOOD), now: NOW } as never);
    expect(plan.warnings[0]).toMatch(/No official/);
  });

  it("errors on unknown appointment and on nothing to plan", async () => {
    const c = await seed(`visit-err-${n}`);
    await expect(buildVisitPlan(c, { appointmentId: "nope" }, { search, structure: structure(GOOD), now: NOW } as never)).rejects.toMatchObject({ code: "appointment_not_found" });
    const empty = caseClient(`visit-empty-${n}`);
    await expect(buildVisitPlan(empty, {}, { search, structure: structure(GOOD), now: NOW } as never)).rejects.toMatchObject({ code: "no_appointment" });
    const { plan } = await buildVisitPlan(empty, { purpose: "UPO collection" }, { search, structure: structure(GOOD), now: NOW } as never);
    expect(plan.appointment).toBeNull();
  });

  it("rejects malformed structuring output", async () => {
    const c = await seed(`visit-bad-${n}`);
    await expect(buildVisitPlan(c, {}, { search, structure: structure({ items: [{ title: "" }] }), now: NOW } as never)).rejects.toThrow();
  });
});
