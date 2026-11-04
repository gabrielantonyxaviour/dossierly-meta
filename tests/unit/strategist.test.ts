import { describe, expect, it } from "vitest";
import { CaseClientError, type CaseClient } from "@/lib/case/client";
import { memorySql } from "@/lib/case/memory-sql";
import { CaseError, CaseStore } from "@/lib/case/store";
import { buildArjunSeed } from "@/lib/dev/arjun-seed";
import { runAgent, type Meter } from "@/lib/strategist/agent";
import { cleanEvidence, runReview } from "@/lib/strategist/service";
import { readReview, REVIEW_DOC_ID } from "@/lib/strategist/storage";
import type { WonderClient, WonderReply, WonderRequest } from "@/lib/strategist/transport";
import { LIMITS } from "@/lib/strategist/types";

const NOW = new Date("2026-11-04T10:00:00Z");
const usage = { tokensIn: 20_000, tokensOut: 3000, cachedTokens: 0 };
const tiny = { tokensIn: 1000, tokensOut: 100, cachedTokens: 0 };

function seeded(): { store: CaseStore; client: CaseClient } {
  const store = new CaseStore(memorySql());
  const s = buildArjunSeed("2026-11-04");
  store.patchProfile(s.profile);
  store.patchFacts(s.facts);
  for (const k of ["documents", "deadlines", "tasks", "events", "appointments"] as const) for (const item of s[k]) store.create(k, item);
  const wrap = <T,>(f: () => T) => Promise.resolve().then(f).catch((e) => { throw e instanceof CaseError ? new CaseClientError(e.status, e.message, e.code) : e; });
  const client = {
    snapshot: () => wrap(() => store.snapshot()),
    create: (k: never, i: unknown) => wrap(() => store.create(k, i)),
    patch: (k: never, id: string, p: unknown) => wrap(() => store.patch(k, id, p)),
  } as unknown as CaseClient;
  return { store, client };
}

const REVIEW = {
  summary: "Application address differs from where you live; photo missing.",
  risks: [{ what: "Letters go to the dorm", why: "KPA art. 41 §2", evidence: ["doc-upo", "doc-rental", "doc-nope"], severity: "high", deadlineImpact: "Delivery to the old address counts", deadlineDate: "2026-11-18" }],
  plan: [{ order: 1, action: "Notify the office of the new address", date: "2026-11-06", dependsOn: [], actor: "user", legalBasis: "KPA art. 41" }],
  inconsistencies: [{ what: "Address mismatch", detail: "dorm vs flat", evidence: ["doc-upo", "doc-rental"], legalConsequence: "art. 41 §2", suggestedFix: "Send address change" }],
  questions: ["Do you still hold the dorm room?"],
};
const call = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });
const toolReply = (...c: ReturnType<typeof call>[]): WonderReply => ({ content: null, toolCalls: c, usage });
const finalReply = (r: unknown = REVIEW): WonderReply => ({ content: JSON.stringify(r), toolCalls: [], usage });

function scripted(replies: WonderReply[]): WonderClient & { reqs: WonderRequest[] } {
  const reqs: WonderRequest[] = [];
  return { reqs, async complete(req) { reqs.push(req); return replies[Math.min(reqs.length - 1, replies.length - 1)]; } };
}
const meter = (spentBefore = 0): Meter => ({ spentBefore, reserve: async () => undefined, settle: async () => undefined });

describe("strategist loop", () => {
  it("executes tools, feeds results back and ends on a valid answer", async () => {
    const { store } = seeded();
    const client = scripted([
      toolReply(call("a", "get_case_item", { collection: "documents", id: "doc-upo" }), call("b", "compute_deadline", { start_kind: "delivery", date: "2026-11-04", amount: 14, unit: "days", legal_basis: "art. 64 § 2 KPA" })),
      toolReply(call("c", "fetch_article", { act: "UoC", article: "106f" }), call("d", "add_task", { title: "Send address change", detail: "KPA art. 41", related_deadline_id: "dl-summons" })),
      finalReply(),
    ]);
    const out = await runAgent(client, store.snapshot(), meter(), NOW);
    expect(out.stop).toBe("final");
    expect(out.rounds).toBe(2);
    expect(out.toolCalls).toBe(4);
    const toolMsgs = client.reqs[2].messages.filter((m) => m.role === "tool");
    expect(toolMsgs).toHaveLength(4);
    expect(toolMsgs[1]).toMatchObject({ content: expect.stringContaining("2026-11-18") });
    expect(toolMsgs[2]).toMatchObject({ content: expect.stringContaining("106f") });
    expect(out.proposals).toMatchObject([{ kind: "task", relatedDeadlineId: "dl-summons" }]);
    expect(JSON.stringify(client.reqs[0].messages)).not.toContain("Arjun Raman");
  });

  it("masks the name and case number going out and restores placeholders in the answer", async () => {
    const { store } = seeded();
    const client = scripted([finalReply({ ...REVIEW, summary: "Case [CASE_1] for [NAME_1] needs attention." })]);
    const out = await runAgent(client, store.snapshot(), meter(), NOW);
    const sent = JSON.stringify(client.reqs[0].messages);
    expect(sent).not.toContain("WSC-II-P.6151.48213.2026");
    expect(sent).toContain("[CASE_1]");
    expect(out.review.summary).toBe("Case WSC-II-P.6151.48213.2026 for Arjun Raman needs attention.");
  });

  it("terminates at the round limit and finalises with no tools", async () => {
    const { store } = seeded();
    const client = scripted([toolReply(call("x", "get_case_item", { collection: "tasks", id: "task-photo" }))]);
    client.complete = (async (req: WonderRequest) => {
      client.reqs.push(req);
      return { ...(req.tools ? toolReply(call("x", "get_case_item", { collection: "tasks", id: "task-photo" })) : finalReply()), usage: tiny };
    }) as WonderClient["complete"];
    const out = await runAgent(client, store.snapshot(), meter(), NOW);
    expect(out.stop).toBe("round_limit");
    expect(out.rounds).toBe(LIMITS.maxToolRounds);
    expect(client.reqs).toHaveLength(LIMITS.maxToolRounds + 1);
    expect(client.reqs.at(-1)?.tools).toBeUndefined();
    expect(client.reqs.at(-1)?.json).toBeDefined();
  });

  it("stops on the per-user budget before another round, then finalises", async () => {
    const { store } = seeded();
    const client = scripted([toolReply(call("x", "get_case_item", { collection: "tasks", id: "task-photo" })), finalReply()]);
    const out = await runAgent(client, store.snapshot(), meter(0.3), NOW);
    expect(out.stop).toBe("budget");
    expect(client.reqs).toHaveLength(2);
  });

  it("refuses to start when the daily allowance is already spent", async () => {
    const { store } = seeded();
    await expect(runAgent(scripted([finalReply()]), store.snapshot(), meter(0.5), NOW)).rejects.toMatchObject({ code: "user_budget" });
  });

  it("rejects output that fails the schema after the repair attempt", async () => {
    const { store } = seeded();
    const client = scripted([finalReply({ summary: "x", risks: "none" })]);
    await expect(runAgent(client, store.snapshot(), meter(), NOW)).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("recovers when the first answer is invalid and the retry is valid", async () => {
    const { store } = seeded();
    const out = await runAgent(scripted([{ content: "not json", toolCalls: [], usage }, finalReply()]), store.snapshot(), meter(), NOW);
    expect(out.review.risks).toHaveLength(1);
  });

  it("returns tool errors to the model instead of throwing", async () => {
    const { store } = seeded();
    const client = scripted([toolReply(call("a", "get_case_item", { collection: "documents", id: "missing" }), call("b", "nope", {}), call("c", "compute_deadline", { start_kind: "delivery", date: "bad", amount: 1, unit: "days" })), finalReply()]);
    await runAgent(client, store.snapshot(), meter(), NOW);
    const tools = client.reqs[1].messages.filter((m) => m.role === "tool");
    expect(tools.every((m) => m.content.includes("error"))).toBe(true);
  });
});

describe("runReview storage", () => {
  const deps = (client: WonderClient, cases: CaseClient) => ({ client, cases, spentToday: async () => 0, reserve: async () => undefined, settle: async () => undefined, record: async () => undefined, now: () => NOW });
  const env = { MODELS_DISABLED: "" } as never;

  it("stores doc, event and proposals; never changes confirmed facts or existing items; is idempotent per revision", async () => {
    const { store, client } = seeded();
    const before = store.snapshot();
    const model = scripted([
      toolReply(call("a", "add_task", { title: "Send address change", detail: "KPA art. 41", related_deadline_id: "dl-summons" }), call("b", "add_deadline", { title: "Confirm address", due_date: "2026-11-10", rationale: "x" })),
      finalReply(),
    ]);
    const first = await runReview(env, "u1", deps(model, client));
    expect(first).toMatchObject({ status: "reviewed", changed: true });
    const after = store.snapshot();
    expect(after.facts).toEqual(before.facts);
    expect(after.profile).toEqual(before.profile);
    for (const k of ["deadlines", "appointments"] as const) expect(after[k]).toEqual(before[k]);
    for (const d of before.documents) expect(after.documents.find((x) => x.id === d.id)).toEqual(d);
    for (const t of before.tasks) expect(after.tasks.find((x) => x.id === t.id)).toEqual(t);
    const proposed = after.tasks.filter((t) => t.id.startsWith("prop-"));
    expect(proposed).toHaveLength(2);
    expect(proposed.every((t) => t.origin === "agent" && t.title.startsWith("[Proposed]") && t.status === "open")).toBe(true);
    expect(after.deadlines).toHaveLength(before.deadlines.length);
    const doc = after.documents.find((d) => d.id === REVIEW_DOC_ID);
    expect(doc).toMatchObject({ kind: "other", source: "agent", title: "Case review" });
    expect(after.events.find((e) => e.id === `ev-review-${first.revision}`)).toMatchObject({ type: "note", refs: expect.arrayContaining([REVIEW_DOC_ID, "doc-upo"]) });
    expect(readReview(after)?.risks[0].evidence).toEqual(["doc-upo", "doc-rental"]);

    const again = await runReview(env, "u1", deps(scripted([]), client));
    expect(again).toMatchObject({ status: "unchanged", changed: false, costUsd: 0 });
  });

  it("will not overwrite a user-owned document with the review id", async () => {
    const { store, client } = seeded();
    store.create("documents", { id: REVIEW_DOC_ID, kind: "other", title: "Mine", source: "user" });
    await expect(runReview(env, "u2", deps(scripted([finalReply()]), client))).rejects.toMatchObject({ code: "case_unavailable" });
    expect(store.get("documents", REVIEW_DOC_ID)?.title).toBe("Mine");
  });

  it("reports the switched-off kill switch and empty cases with codes", async () => {
    const { client } = seeded();
    await expect(runReview({ MODELS_DISABLED: "1" } as never, "u3", deps(scripted([]), client))).rejects.toMatchObject({ code: "models_disabled" });
    const empty = new CaseStore(memorySql());
    const ec = { snapshot: async () => empty.snapshot() } as unknown as CaseClient;
    await expect(runReview(env, "u4", deps(scripted([]), ec))).rejects.toMatchObject({ code: "empty_case" });
  });

  it("cleanEvidence drops ids that are not in the case", () => {
    const { store } = seeded();
    const r = cleanEvidence(REVIEW as never, store.snapshot());
    expect(r.risks[0].evidence).toEqual(["doc-upo", "doc-rental"]);
  });
});
