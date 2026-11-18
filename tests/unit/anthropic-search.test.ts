import { afterEach, describe, expect, it, vi } from "vitest";
import { SEARCH_ALLOWED_DOMAINS } from "@/lib/config";
import { searchTool, webSearch } from "@/lib/model/anthropic-search";
import { groundedSearch } from "@/lib/hub/search";
import { costUsd } from "@/lib/model/cost";
import { freshLocalEnv } from "@/lib/server/local";

const KEY = { ANTHROPIC_API_KEY: "primary", MODEL_API_KEY: "meta-key" };
const REPLY = {
  stop_reason: "end_turn",
  usage: { input_tokens: 4000, output_tokens: 500, server_tool_use: { web_search_requests: 2 } },
  content: [
    { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "q" } },
    { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://www.gov.pl/a", title: "A" }] },
    { type: "text", text: "Fingerprints are taken at the voivodeship office. ", citations: [{ type: "web_search_result_location", url: "https://www.gov.pl/web/udsc/odciski", title: "Odciski palców", cited_text: "x" }] },
    { type: "text", text: "Bring your passport.", citations: [{ type: "web_search_result_location", url: "https://migrant.wsc.mazowieckie.pl/oplaty", title: null, cited_text: "y" }] },
    { type: "text", text: " Uncited." },
  ],
};

function stub(replies: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; key: string; body: Record<string, unknown> }> = [];
  let i = 0;
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, key: (init?.headers as Record<string, string>)["x-api-key"], body: JSON.parse(String(init?.body)) });
    const r = replies[Math.min(i++, replies.length - 1)];
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { calls, f };
}
afterEach(() => vi.unstubAllGlobals());

describe("anthropic web search", () => {
  it("user origin goes to Anthropic with allowed_domains and max_uses, never to Meta", async () => {
    const s = stub([{ body: REPLY }]);
    const r = await webSearch({ query: "karta pobytu" }, { env: KEY, fetch: s.f as never });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    const tool = (s.calls[0].body.tools as Array<Record<string, unknown>>)[0];
    expect(tool).toMatchObject({ name: "web_search", max_uses: 3, allowed_domains: SEARCH_ALLOWED_DOMAINS });
    expect(String(tool.type)).toMatch(/^web_search_\d{8}$/);
    expect(s.calls[0].body.model).toBe("claude-sonnet-5-5");
    expect(r.model).toBe("claude-sonnet-5-5");
    expect(s.calls.some((c) => /meta\.ai/.test(c.url))).toBe(false);
  });

  it("normalises text, citations (url, title, range), search count and per-search price", async () => {
    const s = stub([{ body: REPLY }]);
    const r = await webSearch({ query: "q" }, { env: KEY, fetch: s.f as never });
    expect(r.searches).toBe(2);
    expect(r.usdPerSearch).toBe(0.01);
    expect(r.text).toBe("Fingerprints are taken at the voivodeship office. Bring your passport. Uncited.");
    expect(r.citations).toEqual([
      { url: "https://www.gov.pl/web/udsc/odciski", title: "Odciski palców", start: 0, end: 50 },
      { url: "https://migrant.wsc.mazowieckie.pl/oplaty", title: "", start: 50, end: 70 },
    ]);
    expect(costUsd(r.model, r.usage)).toBeCloseTo((4000 * 2 + 500 * 10) / 1e6, 6);
  });

  it("covers the official domains and honours SEARCH_MAX_USES", () => {
    for (const d of ["gov.pl", "udsc.gov.pl", "mos.cudzoziemcy.gov.pl", "migrant.wsc.mazowieckie.pl", "isap.sejm.gov.pl", "api.sejm.gov.pl", "pacjent.gov.pl", "zielonalinia.gov.pl", "podatki.gov.pl", "biznes.gov.pl", "duw.pl", "muw.pl"]) {
      expect(SEARCH_ALLOWED_DOMAINS).toContain(d);
    }
    expect(searchTool({ SEARCH_MAX_USES: "2" }).max_uses).toBe(2);
  });

  it("retries once on the fallback key when the primary is out of credit", async () => {
    const s = stub([{ status: 400, body: "Your credit balance is too low" }, { body: REPLY }]);
    const r = await webSearch({ query: "q" }, { env: { ...KEY, ANTHROPIC_API_KEY_FALLBACK: "spare" }, fetch: s.f as never });
    expect(s.calls.map((c) => c.key)).toEqual(["primary", "spare"]);
    expect(r.citations).toHaveLength(2);
  });

  it("continues a paused turn and sums usage", async () => {
    const s = stub([{ body: { stop_reason: "pause_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "server_tool_use", id: "s", name: "web_search", input: {} }] } }, { body: REPLY }]);
    const r = await webSearch({ query: "q" }, { env: KEY, fetch: s.f as never });
    expect(s.calls).toHaveLength(2);
    expect(r.usage.tokensIn).toBe(4010);
  });

  it("an error result with no text is model_unavailable", async () => {
    const s = stub([{ body: { stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } }] } }]);
    await expect(webSearch({ query: "q" }, { env: KEY, fetch: s.f as never })).rejects.toMatchObject({ code: "model_unavailable" });
  });

  it("demo origin keeps Meta", async () => {
    const s = stub([{ body: { output: [] } }]);
    await webSearch({ query: "q" }, { env: KEY, fetch: s.f as never, origin: "demo" });
    expect(s.calls[0].url).toBe("https://api.meta.ai/v1/responses");
  });

  it("hub groundedSearch for a user: official passages from Claude, then the per-user daily cap refuses without calling out", async () => {
    const env = freshLocalEnv({ ANTHROPIC_API_KEY: "k" });
    const s = stub([{ body: REPLY }]);
    vi.stubGlobal("fetch", s.f);
    const first = await groundedSearch(env, "odciski palców", { userId: "u1" });
    expect(first.origin).toBe("live");
    expect(first.passages[0].url).toBe("https://www.gov.pl/web/udsc/odciski");
    for (let i = 0; i < 4; i++) await groundedSearch(env, `other ${i}`, { userId: "u1" });
    const before = s.calls.length;
    expect((await groundedSearch(env, "one more", { userId: "u1" })).origin).toBe("budget");
    expect(s.calls).toHaveLength(before);
    expect(s.calls.every((c) => c.url.startsWith("https://api.anthropic.com"))).toBe(true);
  });
});
