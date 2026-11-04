import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LookEvent, LookRead } from "@/lib/look/types";

const READ: Omit<LookRead, "lookId"> = {
  kind: "letter",
  title: "Summons to complete missing documents",
  summary: "Send three documents.",
  actions: ["Send the documents"],
  items: [{ id: "i1", role: "deadline", label: "Your deadline", text: "w terminie 14 dni od dnia doręczenia", meaning: "14 days.", box: [10, 20, 300, 60] }],
  facts: { caseNumber: "WSC-II-S.6151.48213.2026", office: "MAZOWIECKI URZĄD WOJEWÓDZKI W WARSZAWIE" },
  letter: {
    dateOnLetter: "2026-10-22",
    asks: ["Provide a rental agreement", "Provide health insurance", "Provide a passport copy"],
    asksLocal: ["przedłożenie umowy najmu", "przedłożenie ubezpieczenia", "przedłożenie kopii paszportu"],
    deadlineRule: { amount: 14, unit: "days", from: "delivery", quote: "w terminie 14 dni od dnia doręczenia niniejszego wezwania" },
    legalBasis: "art. 64 § 2 KPA",
  },
  uncertain: [],
  readable: true,
};
const state = { fail: null as null | Error };
vi.mock("@/lib/look/read", () => ({
  readLook: async () => {
    if (state.fail) throw state.fail;
    return structuredClone(READ);
  },
}));
vi.mock("@/lib/look/outline", () => ({
  outlineItems: async (_e: unknown, _u: unknown, _i: unknown, _s: unknown, items: Array<{ id: string; box: [number, number, number, number] }>) => ({
    outlines: items.map((i) => ({ id: i.id, box: i.box, path: "M0 0L1 0L1 1Z" })),
    ms: 7,
    source: "sam",
  }),
}));

import * as environment from "@/lib/server/env";
import { freshLocalEnv } from "@/lib/server/local";
import { createAccountUser, sessionCookie } from "@/lib/server/session";
import { ModelError } from "@/lib/model";
import { caseClient } from "@/lib/case/client";
import { POST as look } from "@/app/api/look/route";
import { POST as commit } from "@/app/api/look/commit/route";
import { GET as image } from "@/app/api/look/[lookId]/image/route";

let env = freshLocalEnv();
const cookies: Record<string, string> = {};
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" + "A".repeat(80),
  "base64",
);
const validImage = `data:image/png;base64,${PNG.toString("base64")}`;

beforeEach(async () => {
  state.fail = null;
  delete (globalThis as unknown as { __caseDev?: unknown }).__caseDev; // fresh in-memory case stores
  env = freshLocalEnv({ MODEL_API_KEY: "k" });
  vi.spyOn(environment, "getEnv").mockReturnValue(env);
  for (const id of ["u_look_a", "u_look_b"]) {
    await createAccountUser(env, id, "device");
    cookies[id] = (await sessionCookie(id, env)).split(";")[0];
  }
});
afterEach(() => vi.restoreAllMocks());

const post = (path: string, id: string | null, body: unknown) =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers: { ...(id ? { cookie: cookies[id] } : {}), "content-type": "application/json" }, body: JSON.stringify(body) });
const lookBody = { image: validImage, width: 640, height: 480 };
async function events(res: Response): Promise<LookEvent[]> {
  return (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as LookEvent);
}
async function doLook(id = "u_look_a"): Promise<string> {
  const evs = await events(await look(post("/api/look", id, lookBody)));
  return (evs.find((e) => e.type === "read") as Extract<LookEvent, { type: "read" }>).read.lookId;
}

describe("POST /api/look", () => {
  it("rejects a missing session and invalid bodies with normal JSON errors", async () => {
    const noAuth = await look(post("/api/look", null, lookBody));
    expect(noAuth.status).toBe(401);
    expect((await noAuth.json()).code).toBe("no_session");
    const bad = await look(post("/api/look", "u_look_a", { ...lookBody, image: "not an image" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Invalid request", code: "invalid_request" });
    const garbage = await look(post("/api/look", "u_look_a", { ...lookBody, image: "data:image/png;base64,@@@@" }));
    expect(garbage.status).toBe(400);
    expect((await garbage.json()).code).toBe("invalid_image");
  });

  it("streams stage, read, stage, outlines, outlines_done, stage as NDJSON", async () => {
    const res = await look(post("/api/look", "u_look_a", lookBody));
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    const evs = await events(res);
    expect(evs.map((e) => (e.type === "stage" ? `stage:${e.stage}` : e.type))).toEqual(["stage:reading", "read", "stage:outlining", "outline", "outlines_done", "stage:done"]);
    const read = evs[1] as Extract<LookEvent, { type: "read" }>;
    expect(read.read.lookId).toMatch(/^lk_[A-Za-z0-9]{20}$/);
    expect(evs[4]).toEqual({ type: "outlines_done", ms: 7, count: 1 });
  });

  it("persists the image and the record in BLOBS before the user confirms", async () => {
    const lookId = await doLook();
    const rec = JSON.parse(new TextDecoder().decode(await (await env.BLOBS.get(`looks/u_look_a/${lookId}.json`))!.arrayBuffer()));
    expect(rec).toMatchObject({ lookId, userId: "u_look_a", size: { w: 640, h: 480 }, mime: "image/png", imageKey: `looks/u_look_a/${lookId}.png` });
    expect(rec.outlines).toHaveLength(1);
    expect(await env.BLOBS.get(`looks/u_look_a/${lookId}.png`)).not.toBeNull();
  });

  it("reports a model failure as an error line the client can act on", async () => {
    state.fail = new ModelError("The model service is busy, try again", "rate_limited", 429);
    const evs = await events(await look(post("/api/look", "u_look_a", lookBody)));
    expect(evs.at(-1)).toEqual({ type: "error", error: "The model service is busy, try again", code: "rate_limited", retryable: true });
    state.fail = new ModelError("Daily limit reached. Try again after 08:00 MYT.", "over_budget", 429);
    expect((await events(await look(post("/api/look", "u_look_a", lookBody)))).at(-1)).toMatchObject({ type: "error", code: "over_budget", retryable: false });
    state.fail = new Error("SQLITE_CONSTRAINT secret internals");
    const last = (await events(await look(post("/api/look", "u_look_a", lookBody)))).at(-1) as Extract<LookEvent, { type: "error" }>;
    expect(last.error).toBe("Something went wrong on our side");
    expect(JSON.stringify(last)).not.toContain("SQLITE");
  });

  it("rate limits a user after 30 looks per hour", async () => {
    for (let i = 0; i < 30; i++) expect((await look(post("/api/look", "u_look_b", lookBody))).status).toBe(200);
    const res = await look(post("/api/look", "u_look_b", lookBody));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
  });
});

describe("GET /api/look/[lookId]/image", () => {
  const get = (id: string, lookId: string) => image(new Request("http://localhost:3000/x", { headers: { cookie: cookies[id] } }), { params: Promise.resolve({ lookId }) });

  it("returns the stored bytes to the owner and 404 to anyone else", async () => {
    const lookId = await doLook();
    const mine = await get("u_look_a", lookId);
    expect(mine.status).toBe(200);
    expect(mine.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await mine.arrayBuffer()).equals(PNG)).toBe(true);
    expect((await get("u_look_b", lookId)).status).toBe(404);
    expect((await get("u_look_a", "lk_doesnotexist000000")).status).toBe(404);
    expect((await get("u_look_a", "../../etc")).status).toBe(404);
  });
});

describe("POST /api/look/commit", () => {
  const send = (id: string, body: unknown) => commit(post("/api/look/commit", id, body));
  const delivered = { kind: "delivered", date: "2026-10-27" } as const;

  it("404s for a look that is not the caller's", async () => {
    const lookId = await doLook();
    expect((await send("u_look_b", { lookId, delivery: delivered })).status).toBe(404);
    expect((await send("u_look_a", { lookId: "lk_aaaaaaaaaaaaaaaaaaaa" })).status).toBe(404);
    expect((await send("u_look_a", { lookId: "nope" })).status).toBe(400);
  });

  it("writes facts, document, a computed deadline, one task per ask and an event", async () => {
    const lookId = await doLook();
    const res = await send("u_look_a", { lookId, delivery: delivered });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.deadline).toMatchObject({ id: `ddl_${lookId}`, startDate: "2026-10-27", dueDate: "2026-11-10" });
    expect(out.deadline.citations.length).toBeGreaterThan(0);
    expect(out).toMatchObject({ documentId: `doc_${lookId}`, eventId: `evt_${lookId}`, factsWritten: ["caseNumber", "office"] });
    expect(out.taskIds).toEqual([1, 2, 3].map((n) => `tsk_${lookId}_${n}`));

    const snap = await caseClient("u_look_a").snapshot();
    expect(snap.facts.caseNumber).toEqual({ value: "WSC-II-S.6151.48213.2026", source: { type: "letter", ref: lookId }, confirmedByUser: true });
    expect(snap.documents[0]).toMatchObject({ id: `doc_${lookId}`, kind: "letter", source: "scan", fileKey: `looks/u_look_a/${lookId}.png`, extractedFields: { caseNumber: "WSC-II-S.6151.48213.2026", dateOnLetter: "2026-10-22", legalBasis: "art. 64 § 2 KPA" } });
    expect(snap.deadlines[0]).toMatchObject({ id: `ddl_${lookId}`, dueDate: "2026-11-10", triggeredBy: `doc_${lookId}`, status: "open" });
    expect(snap.deadlines[0].title).toBe("Send the 3 missing documents (WSC-II-S.6151.48213.2026)");
    expect(snap.deadlines[0].computation.legalRefUrl).toMatch(/^https:/);
    expect(snap.tasks).toHaveLength(3);
    expect(snap.tasks.every((t) => t.origin === "letter" && t.dueDeadlineId === `ddl_${lookId}`)).toBe(true);
    expect(snap.events[0]).toMatchObject({ id: `evt_${lookId}`, type: "letter_read" });
  });

  it("is idempotent and moves the deadline when the delivery date changes", async () => {
    const lookId = await doLook();
    await send("u_look_a", { lookId, delivery: delivered });
    await send("u_look_a", { lookId, delivery: delivered });
    const again = await send("u_look_a", { lookId, delivery: { kind: "delivered", date: "2026-10-29" } });
    expect((await again.json()).deadline.dueDate).toBe("2026-11-12");
    const snap = await caseClient("u_look_a").snapshot();
    expect([snap.documents.length, snap.deadlines.length, snap.tasks.length, snap.events.length]).toEqual([1, 1, 3, 1]);
    expect(snap.deadlines[0].dueDate).toBe("2026-11-12");
  });

  it("applies the user's corrections to the facts and rejects unknown keys", async () => {
    const lookId = await doLook();
    const ok = await send("u_look_a", { lookId, delivery: delivered, corrections: { caseNumber: "WSC-II-S.6151.48218.2026" } });
    expect(ok.status).toBe(200);
    const snap = await caseClient("u_look_a").snapshot();
    expect(snap.facts.caseNumber?.value).toBe("WSC-II-S.6151.48218.2026");
    expect(snap.deadlines[0].title).toContain("WSC-II-S.6151.48218.2026");
    const bad = await send("u_look_a", { lookId, corrections: { password: "x" } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("invalid_correction");
  });

  it("writes no deadline without a delivery date, and rejects an impossible one before writing anything", async () => {
    const lookId = await doLook();
    const noDelivery = await (await send("u_look_a", { lookId })).json();
    expect(noDelivery.deadline).toBeNull();
    expect(noDelivery.taskIds).toHaveLength(3);
    const other = await doLook();
    const bad = await send("u_look_a", { lookId: other, delivery: { kind: "delivered", date: "2026-02-31" } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("invalid_delivery");
    expect((await caseClient("u_look_a").snapshot()).documents.some((d) => d.id === `doc_${other}`)).toBe(false);
  });

  it("counts from the letter date when that is what the letter says", async () => {
    const lookId = await doLook();
    // Rewrite the stored look so the rule runs from the letter date (22.10.2026) instead of delivery.
    const key = `looks/u_look_a/${lookId}.json`;
    const rec = JSON.parse(new TextDecoder().decode(await (await env.BLOBS.get(key))!.arrayBuffer()));
    rec.read.letter.deadlineRule.from = "letter_date";
    await env.BLOBS.put(key, JSON.stringify(rec));
    const out = await (await send("u_look_a", { lookId })).json();
    expect(out.deadline).toMatchObject({ startDate: "2026-10-22", dueDate: "2026-11-05" });
  });
});
