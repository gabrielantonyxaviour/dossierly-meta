import { describe, expect, it } from "vitest";
import { handleCaseRequest } from "@/lib/case/handler";
import { memorySql } from "@/lib/case/memory-sql";
import { CaseStore } from "@/lib/case/store";
import { caseContext } from "@/lib/case/context";
import { createSchemas, factsPatchSchema, patchSchemas, profilePatchSchema } from "@/lib/case/types";

const fresh = () => new CaseStore(memorySql());
const call = (s: CaseStore, method: string, path: string, body?: unknown) =>
  handleCaseRequest(s, new Request(`https://case.do${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) }));

describe("schemas", () => {
  it("rejects bad dates, unknown keys and bad phones", () => {
    expect(createSchemas.deadlines.safeParse({ title: "x", dueDate: "2026-02-30" }).success).toBe(false);
    expect(createSchemas.deadlines.safeParse({ title: "x", dueDate: "2026-03-01", extra: 1 }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ phone: { number: "48123", verified: false, callsEnabled: false } }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ country: "DE" }).success).toBe(false);
    expect(patchSchemas.tasks.safeParse({}).success).toBe(true);
    expect(factsPatchSchema.safeParse({ caseNumber: null }).success).toBe(true);
  });
});

describe("CaseStore", () => {
  it("starts with a default profile and empty collections", () => {
    const snap = fresh().snapshot();
    expect(snap.profile.stage).toBe("just_arrived");
    expect(snap.deadlines).toEqual([]);
  });

  it("patches profile with nested phone merge", () => {
    const s = fresh();
    s.patchProfile({ phone: { number: "+48501234567", verified: true, callsEnabled: false } });
    const p = s.patchProfile({ fullName: "Arjun Mehta", phone: { callsEnabled: true } as never });
    expect(p.phone).toEqual({ number: "+48501234567", verified: true, callsEnabled: true });
  });

  it("creates with defaults, sorts deadlines by date and patches", () => {
    const s = fresh();
    s.create("deadlines", { title: "Appeal", dueDate: "2026-12-20" });
    const early = s.create("deadlines", { title: "Supplement", dueDate: "2026-11-10" });
    expect(s.list("deadlines").map((d) => d.title)).toEqual(["Supplement", "Appeal"]);
    expect(early.status).toBe("open");
    expect(s.patch("deadlines", early.id, { status: "done" }).status).toBe("done");
    expect(() => s.patch("deadlines", early.id, { dueDate: "bad" })).toThrow();
  });

  it("rejects duplicate ids and missing items", async () => {
    const s = fresh();
    s.create("tasks", { id: "t1", title: "Call office" });
    const dup = await call(s, "POST", "/tasks", { id: "t1", title: "Again" });
    expect(dup.status).toBe(409);
    expect((await call(s, "PATCH", "/tasks/nope", { status: "done" })).status).toBe(404);
    expect((await call(s, "DELETE", "/tasks/t1")).status).toBe(200);
  });

  it("sets and clears facts", () => {
    const s = fresh();
    const f = { value: "WSC-II-S.6151.1234.2026", source: { type: "letter", ref: "doc1" }, confirmedByUser: false };
    expect(s.patchFacts({ caseNumber: f }).caseNumber?.value).toBe(f.value);
    expect(s.patchFacts({ caseNumber: null }).caseNumber).toBeUndefined();
  });

  it("returns { error, code } only for invalid input", async () => {
    const s = fresh();
    const r = await call(s, "POST", "/documents", { kind: "passport" });
    expect(r.status).toBe(400);
    expect(Object.keys(await r.json()).sort()).toEqual(["code", "error"]);
    expect((await call(s, "GET", "/bogus")).status).toBe(404);
  });
});

describe("caseContext", () => {
  it("renders compact text without file keys or phone numbers", () => {
    const s = fresh();
    s.patchProfile({ fullName: "Arjun Mehta", phone: { number: "+48501234567", verified: true, callsEnabled: true } });
    s.create("documents", { kind: "passport", title: "Passport", fileKey: "secret/key" });
    s.create("deadlines", { title: "Supplement documents", dueDate: "2026-11-10" });
    const txt = caseContext(s.snapshot(), new Date("2026-11-04T10:00:00Z"));
    expect(txt).toContain("Supplement documents");
    expect(txt).toContain("Next step: Supplement documents (Tuesday 10 November 2026 (2026-11-10), 6d)");
    expect(txt).not.toContain("secret/key");
    expect(txt).not.toContain("+48501234567");
  });
});
