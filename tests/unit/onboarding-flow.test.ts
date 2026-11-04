import { describe, expect, it } from "vitest";
import { z } from "zod";
import { calendarKey } from "../../src/lib/onboarding/commit";
import { extractionSchema } from "../../src/lib/onboarding/extract";
import { buildFindings, findingSchema } from "../../src/lib/onboarding/findings";
import { demoCallsAllowed, normalisePhone } from "../../src/lib/onboarding/phone";
import { warsawIso } from "../../src/lib/onboarding/time";

const msg = { id: "18f2a9c4b7d1e003", from: "Wydział Spraw Cudzoziemców (PRZYKŁAD) <wsc-przyklad@dossierly.cosmiclan.com>", subject: "Wezwanie do uzupełnienia braków", receivedAt: "2026-10-23T08:15:00.000Z", text: "", images: [], attachments: [] };
const base = extractionSchema.parse({ relevant: true, category: "summons", sender: "WSC", summary: "The office wants documents within 14 days.", facts: {}, appointment: null, deadline: null, documents: [], tasks: [] });

describe("phone", () => {
  it("normalises Polish and international numbers", () => {
    expect(normalisePhone("512 345 678")).toBe("+48512345678");
    expect(normalisePhone("0048 512-345-678")).toBe("+48512345678");
    expect(normalisePhone("+91 98400 12345")).toBe("+919840012345");
    expect(normalisePhone("12ab")).toBeNull();
  });
  const env = (email: string | null, extra: Record<string, string>) => ({
    ...extra, DB: { prepare: () => ({ bind: () => ({ first: async () => (email ? { email } : null) }) }) },
  }) as never;
  it("enables calls only for the listed account and the exact demo number", async () => {
    const vars = { DEMO_CALL_EMAILS: "darthstormer.ai@gmail.com, other@x.pl", DEMO_CALL_NUMBER: "+48 600 100 200" };
    expect(await demoCallsAllowed(env("Darthstormer.AI@gmail.com", vars), "u1", "+48600100200")).toBe(true);
    expect(await demoCallsAllowed(env("darthstormer.ai@gmail.com", vars), "u1", "+48600100201")).toBe(false);
    expect(await demoCallsAllowed(env("someone@gmail.com", vars), "u1", "+48600100200")).toBe(false);
    expect(await demoCallsAllowed(env("darthstormer.ai@gmail.com", { DEMO_CALL_EMAILS: vars.DEMO_CALL_EMAILS }), "u1", "+48600100200")).toBe(false);
  });
});

describe("findings", () => {
  it("counts a 14-day summons from the day the email arrived, moving off a weekend", () => {
    const r = buildFindings(msg, { ...base, deadline: { title: "Send missing documents", days: 14, from: "delivery", letterDate: "2026-10-22", statedDate: null, quote: "w terminie 14 dni od dnia doręczenia", consequence: "left unexamined", legalBasis: null } }, "en");
    const d = r.findings.find((f) => f.kind === "deadline");
    // Delivered Fri 23 Oct → day 14 is Fri 6 Nov (a working day).
    expect(d && d.kind === "deadline" && d.dueDate).toBe("2026-11-06");
    expect(r.relevant).toBe(true);
  });
  it("drops findings from irrelevant emails and keeps ids stable and valid", () => {
    expect(buildFindings(msg, { ...base, relevant: false, facts: { ...base.facts, caseNumber: "X" } }, "en").findings).toHaveLength(0);
    const a = buildFindings(msg, { ...base, facts: { ...base.facts, caseNumber: "WSC-II-S.6151.48213.2026" } }, "en");
    const b = buildFindings(msg, { ...base, facts: { ...base.facts, caseNumber: "WSC-II-S.6151.48213.2026" } }, "en");
    expect(a.findings[0].id).toBe(b.findings[0].id);
    expect(a.findings[0].id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(findingSchema.safeParse(a.findings[0]).success).toBe(true);
  });
  it("tolerates malformed model sub-fields", () => {
    const x = extractionSchema.parse({ relevant: true, category: "nope", facts: { filedAt: "yesterday" }, appointment: { title: "x" }, deadline: "soon", documents: "none", tasks: [] });
    expect(x.category).toBe("other");
    expect(x.facts.filedAt).toBeNull();
    expect(x.appointment).toBeNull();
    expect(x.documents).toEqual([]);
  });
});

describe("time and calendar keys", () => {
  it("gives Warsaw offsets across DST", () => {
    expect(warsawIso("2026-11-12", "10:30")).toBe("2026-11-12T10:30:00+01:00");
    expect(warsawIso("2026-07-01", "09:00")).toBe("2026-07-01T09:00:00+02:00");
  });
  it("derives a deterministic UUID accepted by the calendar schema", async () => {
    const k = await calendarKey("u1", "ddl_abc");
    expect(k).toBe(await calendarKey("u1", "ddl_abc"));
    expect(k).not.toBe(await calendarKey("u2", "ddl_abc"));
    expect(z.string().uuid().safeParse(k).success).toBe(true);
  });
});

describe("retryTransient", async () => {
  const { retryTransient } = await import("../../src/lib/onboarding/retry");
  const { ModelError } = await import("../../src/lib/model");
  it("retries a transient model error once and passes others through", async () => {
    let n = 0;
    expect(await retryTransient(async () => { if (n++ === 0) throw new ModelError("x", "model_unavailable", 503); return "ok"; }, 1)).toBe("ok");
    await expect(retryTransient(async () => { throw new ModelError("x", "over_budget", 429); }, 1)).rejects.toThrow();
  });
});
