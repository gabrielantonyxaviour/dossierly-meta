import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LookRead } from "@/lib/look/types";

const READ: Omit<LookRead, "lookId"> = {
  kind: "letter", title: "Summons to complete missing documents", summary: "Send the documents.", actions: ["Send the documents"],
  items: [{ id: "i1", role: "deadline", label: "Your deadline", text: "w terminie 14 dni", meaning: "14 days.", box: [10, 20, 300, 60] }],
  facts: { caseNumber: "WSC-II-S.6151.48213.2026" },
  letter: {
    dateOnLetter: "2026-10-22", asks: ["Provide a rental agreement"], asksLocal: ["przedłożenie umowy najmu"],
    deadlineRule: { amount: 14, unit: "days", from: "delivery", quote: "w terminie 14 dni" }, legalBasis: "art. 64 § 2 KPA",
  },
  uncertain: [], readable: true,
};
vi.mock("@/lib/look/read", () => ({ readLook: async () => structuredClone(READ) }));
vi.mock("@/lib/look/outline", () => ({
  outlineItems: async (_e: unknown, _u: unknown, _i: unknown, _s: unknown, items: Array<{ id: string; box: [number, number, number, number] }>) => ({
    outlines: items.map((i) => ({ id: i.id, box: i.box, path: "M0 0L1 0L1 1Z" })), ms: 5, source: "sam",
  }),
}));

import { POST as mcp, GET as mcpGet } from "@/app/api/mcp/route";
import { DELETE as revoke, GET as listTokensRoute, POST as createTokenRoute } from "@/app/api/mcp/tokens/route";
import { caseClient } from "@/lib/case/client";
import { parsePeriodText } from "@/lib/mcp/tools-legal";
import type { ChatClient } from "@/lib/model/types";
import * as environment from "@/lib/server/env";
import { freshLocalEnv } from "@/lib/server/local";
import { createAccountUser, sessionCookie } from "@/lib/server/session";

const USER = "u_mcp_a";
let env = freshLocalEnv();
let cookie = "";
const client: ChatClient = {
  async chat(req) {
    const system = String(req.messages[0].content);
    const base = { adviceRequest: false, answeredInstead: false, verdict: "ALLOW" };
    const content = /article of Polish law/.test(system)
      ? { summary: "Deadlines in days skip the delivery day.", keyPoints: ["Day of delivery not counted"] }
      : { ...base, translation: "Mam paszport." };
    return { content: JSON.stringify(content), usage: { tokensIn: 10, tokensOut: 10, cachedTokens: 0 } };
  },
};

beforeEach(async () => {
  delete (globalThis as unknown as { __caseDev?: unknown }).__caseDev;
  env = freshLocalEnv({ MODEL_API_KEY: "k" });
  vi.spyOn(environment, "getEnv").mockReturnValue(env);
  await createAccountUser(env, USER, "device");
  cookie = (await sessionCookie(USER, env)).split(";")[0];
});
afterEach(() => vi.restoreAllMocks());

async function makeToken(scope: "read" | "act" = "read", name = "Claude Desktop") {
  const res = await createTokenRoute(new Request("http://localhost:3000/api/mcp/tokens", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ name, scope }) }));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; token: string; scope: string; prefix: string };
}
let rpcId = 0;
async function rpc(token: string | null, method: string, params?: unknown, deps = {}) {
  const req = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const { handleMcpPost } = await import("@/lib/mcp/http");
  return handleMcpPost(req, { client, ...deps });
}
async function call(token: string, name: string, args: unknown = {}, deps = {}) {
  const res = await rpc(token, "tools/call", { name, arguments: args }, deps);
  expect(res.status).toBe(200);
  return (await res.json()).result as { isError: boolean; structuredContent?: Record<string, any>; content: Array<{ text: string }> };
}
const PNG = (() => {
  const b = new Uint8Array(120);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, 640); new DataView(b.buffer).setUint32(20, 480);
  return Buffer.from(b).toString("base64");
})();

describe("MCP protocol", () => {
  it("initializes, negotiates the version and lists every tool with JSON schemas", async () => {
    const { token } = await makeToken();
    const init = await (await rpc(token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } })).json();
    expect(init.jsonrpc).toBe("2.0");
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(init.result.serverInfo.name).toBe("dossierly");
    expect(init.result.capabilities.tools).toBeDefined();
    const fallback = await (await rpc(token, "initialize", { protocolVersion: "1999-01-01" })).json();
    expect(fallback.result.protocolVersion).toBe("2025-11-25");
    const list = await (await rpc(token, "tools/list")).json();
    const names = list.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["add_deadline", "add_task", "compute_deadline", "explain_law", "get_case", "interpret", "next_step", "read_letter"]);
    for (const t of list.result.tools) expect(t.inputSchema.type).toBe("object");
    expect(await (await rpc(token, "ping")).json()).toMatchObject({ result: {} });
  });

  it("answers notifications with 202, unknown methods with -32601 and bad JSON with -32700", async () => {
    const { token } = await makeToken();
    const note = await mcp(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }));
    expect(note.status).toBe(202);
    expect((await (await rpc(token, "nope")).json()).error.code).toBe(-32601);
    const bad = await mcp(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: "{" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe(-32700);
  });

  it("does not offer SSE or session deletion", async () => {
    expect((await mcpGet()).status).toBe(405);
  });
});

describe("MCP auth", () => {
  it("rejects missing, malformed, unknown and revoked tokens with 401", async () => {
    for (const t of [null, "dsl_" + "x".repeat(43), "garbage"]) {
      const res = await rpc(t, "ping");
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain("Bearer");
      expect((await res.json()).code).toBe("unauthorized");
    }
    const { token, id } = await makeToken();
    expect((await rpc(token, "ping")).status).toBe(200);
    const del = await revoke(new Request("http://localhost:3000/api/mcp/tokens", { method: "DELETE", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ id }) }));
    expect(del.status).toBe(200);
    expect((await rpc(token, "ping")).status).toBe(401);
  });

  it("stores only a hash, shows the secret once, and requires a session to manage tokens", async () => {
    const { token } = await makeToken("read", "Once");
    const rows = await env.DB.prepare("SELECT token_hash, prefix FROM mcp_tokens").all<{ token_hash: string; prefix: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows.results)).not.toContain(token);
    const listed = await (await listTokensRoute(new Request("http://localhost:3000/api/mcp/tokens", { headers: { cookie } }))).json();
    expect(listed.tokens).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(token);
    const anon = await createTokenRoute(new Request("http://localhost:3000/api/mcp/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "x" }) }));
    expect(anon.status).toBe(401);
  });

  it("rate-limits per token", async () => {
    const { token } = await makeToken();
    let last = 200;
    for (let i = 0; i < 62; i++) last = (await rpc(token, "ping")).status;
    expect(last).toBe(429);
  });

  it("enforces read vs act scope on write tools", async () => {
    const ro = await makeToken("read");
    const denied = await call(ro.token, "add_task", { title: "File the papers" });
    expect(denied.isError).toBe(true);
    expect(JSON.parse(denied.content[0].text).code).toBe("insufficient_scope");
    expect(await caseClient(USER).list("tasks")).toHaveLength(0);
  });
});

describe("MCP tools", () => {
  it("compute_deadline returns the KPA date, steps and citations, and rejects bad input honestly", async () => {
    const { token } = await makeToken();
    const ok = await call(token, "compute_deadline", { deliveredOn: "2026-11-02", periodText: "14 days", quote: "w terminie 14 dni" });
    expect(ok.isError).toBe(false);
    expect(ok.structuredContent!.dueDate).toBe("2026-11-16");
    expect(ok.structuredContent!.citations.length).toBeGreaterThan(0);
    expect(ok.structuredContent!.citations[0].quote).toMatch(/\S/);
    const bad = await call(token, "compute_deadline", { deliveredOn: "2026-02-31", periodDays: 7 });
    expect(bad.isError).toBe(true);
    expect(JSON.parse(bad.content[0].text)).toMatchObject({ code: "invalid_date" });
    const none = await call(token, "compute_deadline", { deliveredOn: "2026-11-02" });
    expect(JSON.parse(none.content[0].text).code).toBe("invalid_period");
    expect((await call(token, "compute_deadline", { deliveredOn: "x" })).isError).toBe(true);
    expect(parsePeriodText("30 dni")).toEqual({ amount: 30, unit: "days" });
    expect(parsePeriodText("two weeks")).toEqual({ amount: 2, unit: "weeks" });
  });

  it("get_case and next_step expose a safe snapshot without phone numbers or file keys", async () => {
    const { token } = await makeToken("act");
    const c = caseClient(USER);
    await c.patchProfile({ fullName: "Arjun Raman", city: "Warszawa", phone: { number: "+48500100200" } });
    await c.create("documents", { kind: "letter", title: "Summons", fileKey: "looks/secret.png", extractedFields: { note: "call +48 501 202 303 now" } });
    await c.create("deadlines", { title: "Send documents", dueDate: "2026-11-16", computation: { steps: ["Day 1"], rule: "KPA art. 57 §1", legalRefUrl: null } });
    const snap = await call(token, "get_case");
    const text = snap.content[0].text;
    expect(text).not.toContain("500100200");
    expect(text).not.toContain("501 202 303");
    expect(text).not.toContain("looks/secret.png");
    expect(snap.structuredContent!.openDeadlines[0]).toMatchObject({ dueDate: "2026-11-16", computationSteps: ["Day 1"] });
    expect(snap.structuredContent!.documents[0].hasFile).toBe(true);
    const next = await call(token, "next_step", {}, { now: () => new Date("2026-11-10T10:00:00Z") });
    expect(next.structuredContent!.nextStep).toMatchObject({ kind: "deadline", daysLeft: 6 });
  });

  it("add_task and add_deadline write to the case with an act token and validate input", async () => {
    const { token } = await makeToken("act");
    const t = await call(token, "add_task", { title: "Book fingerprint slot", detail: "MOS portal" });
    expect(t.isError).toBe(false);
    const d = await call(token, "add_deadline", { title: "Reply to summons", dueDate: "2026-11-16", steps: ["Counted from 2026-11-02"], rule: "KPA art. 57" });
    expect(d.structuredContent!.deadline.dueDate).toBe("2026-11-16");
    const c = caseClient(USER);
    expect((await c.list("tasks"))[0]).toMatchObject({ title: "Book fingerprint slot", origin: "agent" });
    expect((await c.list("deadlines"))[0].computation.rule).toBe("KPA art. 57");
    const bad = await call(token, "add_deadline", { title: "x", dueDate: "16/11/2026" });
    expect(JSON.parse(bad.content[0].text).code).toBe("invalid_arguments");
  });

  it("explain_law returns verbatim text plus a Muse summary, and refuses uncovered articles", async () => {
    const { token } = await makeToken();
    const r = await call(token, "explain_law", { act: "KPA", article: "art. 57" });
    expect(r.isError).toBe(false);
    expect(r.structuredContent!.verbatimPl).toContain("Jeżeli początkiem terminu określonego w dniach");
    expect(r.structuredContent!.summary).toContain("delivery day");
    const foreigners = await call(token, "explain_law", { act: "Act on Foreigners", article: "106f" });
    expect(foreigners.structuredContent!.article).toBe("106f");
    const missing = await call(token, "explain_law", { act: "KPA", article: "999" });
    expect(JSON.parse(missing.content[0].text).code).toBe("article_not_covered");
  });

  it("explain_law degrades to verbatim text when the model is unavailable", async () => {
    const { token } = await makeToken();
    const failing: ChatClient = { chat: async () => { throw new Error("down"); } };
    const r = await call(token, "explain_law", { act: "KPA", article: "44" }, { client: failing });
    expect(r.isError).toBe(false);
    expect(r.structuredContent!.summary).toBeNull();
    expect(r.structuredContent!.summaryError).toBeTruthy();
    expect(r.structuredContent!.verbatimPl).toMatch(/^Art\. 44\./);
  });

  it("interpret translates between Polish and a supported language", async () => {
    const { token } = await makeToken();
    const r = await call(token, "interpret", { text: "I have my passport.", from: "en", to: "pl" });
    expect(r.isError).toBe(false);
    expect(r.structuredContent!.translation).toBe("Mam paszport.");
    const pair = await call(token, "interpret", { text: "hi", from: "en", to: "hi" });
    expect(JSON.parse(pair.content[0].text).code).toBe("unsupported_pair");
  });

  it("read_letter returns items with boxes and outlines, previews the deadline, and saves with an act token", async () => {
    const ro = await makeToken("read");
    const out = await call(ro.token, "read_letter", { imageBase64: PNG, deliveredOn: "2026-11-02" });
    expect(out.isError).toBe(false);
    expect(out.structuredContent!.items[0]).toMatchObject({ box: [10, 20, 300, 60], outline: { path: "M0 0L1 0L1 1Z" } });
    expect(out.structuredContent!.computedDeadline.dueDate).toBe("2026-11-16");
    expect(out.structuredContent!.imageSize).toEqual({ width: 640, height: 480 });
    const denied = await call(ro.token, "read_letter", { imageBase64: PNG, save_to_case: true });
    expect(JSON.parse(denied.content[0].text).code).toBe("insufficient_scope");
    const act = await makeToken("act", "Writer");
    const saved = await call(act.token, "read_letter", { imageBase64: PNG, deliveredOn: "2026-11-02", save_to_case: true });
    expect(saved.structuredContent!.saved.deadline.dueDate).toBe("2026-11-16");
    expect((await caseClient(USER).list("deadlines"))).toHaveLength(1);
    const notImage = await call(ro.token, "read_letter", { imageBase64: Buffer.from("hello world".repeat(20)).toString("base64") });
    expect(JSON.parse(notImage.content[0].text).code).toBe("invalid_image");
    const neither = await call(ro.token, "read_letter", {});
    expect(JSON.parse(neither.content[0].text).code).toBe("invalid_arguments");
  });

  it("read_letter fetches https URLs only", async () => {
    const { token } = await makeToken();
    const http = await call(token, "read_letter", { imageUrl: "http://example.com/a.png" });
    expect(JSON.parse(http.content[0].text).code).toBe("invalid_image_url");
    const fetched = await call(token, "read_letter", { imageUrl: "https://example.com/a.png" }, { fetch: async () => new Response(Buffer.from(PNG, "base64"), { headers: { "content-type": "image/png" } }) });
    expect(fetched.isError).toBe(false);
  });
});
