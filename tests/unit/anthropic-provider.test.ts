import { describe, expect, it } from "vitest";
import { z } from "zod";
import { anthropicToolChat, toAnthropicToolMessages } from "@/lib/model/anthropic-tools";
import { callJson } from "@/lib/model/json";
import { createMetaClient, metaChat, metaChatStream, metaJson } from "@/lib/model/meta";
import { resolveRole } from "@/lib/model/roles";

const ENV = { ANTHROPIC_API_KEY: "ak" };
type Seen = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
function mock(replies: Array<Response>) {
  const seen: Seen[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    seen.push({ url, headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return replies[Math.min(seen.length, replies.length) - 1];
  };
  return { seen, fetch };
}
const reply = (text: string, usage = { input_tokens: 100, output_tokens: 30, cache_read_input_tokens: 40 }) => Response.json({ content: [{ type: "text", text }], stop_reason: "end_turn", usage });
const png = "data:image/png;base64,iVBORw0KGgo=";

describe("Anthropic Messages provider", () => {
  it("sends x-api-key, version, system apart, effort, no temperature, and parses usage with cache reads", async () => {
    const m = mock([reply('{"a":1}')]);
    const res = await metaChat({ model: "claude-sonnet-5-5", role: "reason", messages: [{ role: "system", content: "RULES" }, { role: "user", content: "hi" }], maxTokens: 4000, reasoningEffort: "high", json: "json_object", temperature: 0.2 }, { env: ENV, fetch: m.fetch });
    const s = m.seen[0];
    expect(s.url).toBe("https://api.anthropic.com/v1/messages");
    expect(s.headers).toMatchObject({ "x-api-key": "ak", "anthropic-version": "2023-06-01" });
    expect(s.body).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 4000, output_config: { effort: "high" } });
    expect(String(s.body.system)).toMatch(/^RULES[\s\S]*exactly one JSON object/);
    expect(s.body).not.toHaveProperty("temperature");
    expect(s.body).not.toHaveProperty("thinking");
    expect(s.body.messages).toEqual([{ role: "user", content: [{ type: "text", text: "hi" }] }]);
    expect(res).toEqual({ content: '{"a":1}', usage: { tokensIn: 140, tokensOut: 30, cachedTokens: 40 } });
  });

  it("turns thinking off for minimal effort on Haiku and uses between_tools on Sonnet", async () => {
    const m = mock([reply("x"), reply("x")]);
    await metaChat({ model: "claude-haiku-5-5", role: "interpret", messages: [{ role: "user", content: "hi" }], maxTokens: 1500, reasoningEffort: "minimal" }, { env: ENV, fetch: m.fetch });
    expect(m.seen[0].body).toMatchObject({ thinking: { type: "disabled" }, output_config: { effort: "low" } });
    await metaChat({ model: "claude-sonnet-5-5", role: "interpret", messages: [{ role: "user", content: "hi" }], maxTokens: 1500, reasoningEffort: "minimal" }, { env: ENV, fetch: m.fetch });
    expect(m.seen[1].body).toMatchObject({ thinking: { type: "between_tools" } });
  });

  it("sends images as base64 blocks and appends a JSON schema to the system prompt", async () => {
    const m = mock([reply("{}")]);
    await metaChat({ model: "claude-sonnet-5-5", role: "vision", messages: [{ role: "system", content: "S" }, { role: "user", content: [{ type: "text", text: "read" }, { type: "image_url", image_url: { url: png } }] }], maxTokens: 4000, json: { type: "object", properties: { x: { type: "string" } } } }, { env: ENV, fetch: m.fetch });
    expect(m.seen[0].body.messages).toEqual([{ role: "user", content: [{ type: "text", text: "read" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } }] }]);
    expect(String(m.seen[0].body.system)).toContain('"properties"');
  });

  it("uses the role's Claude model even when the caller passed a Meta id, and merges the callJson retry turns", async () => {
    const m = mock([reply("not json"), reply('{"ok":true}')]);
    const client = createMetaClient(ENV, m.fetch);
    const out = await callJson(client, { model: "muse-spark-1.2", role: "interpret", messages: [{ role: "user", content: "go" }], maxTokens: 1500, json: "json_object" }, z.object({ ok: z.boolean() }));
    expect(out.data).toEqual({ ok: true });
    expect(out.attempts).toBe(2);
    expect(m.seen[0].body.model).toBe("claude-haiku-5-5");
    const turns = (m.seen[1].body.messages as Array<{ role: string }>).map((t) => t.role);
    expect(turns).toEqual(["user", "assistant", "user"]);
  });

  it("streams text deltas then one usage chunk", async () => {
    const ev = (o: unknown) => `event: x\ndata: ${JSON.stringify(o)}\n\n`;
    const body = ev({ type: "message_start", message: { usage: { input_tokens: 50, output_tokens: 1 } } }) + ev({ type: "content_block_delta", delta: { type: "text_delta", text: "Cze" } }) + ev({ type: "content_block_delta", delta: { type: "text_delta", text: "ść." } }) + ev({ type: "message_delta", usage: { output_tokens: 7 } }) + ev({ type: "message_stop" });
    const m = mock([new Response(body)]);
    const out = [];
    for await (const c of metaChatStream({ model: "claude-haiku-5-5", role: "interpret", messages: [{ role: "user", content: "hi" }], maxTokens: 500, reasoningEffort: "minimal" }, { env: ENV, fetch: m.fetch })) out.push(c);
    expect(m.seen[0].body).toMatchObject({ stream: true });
    expect(out).toEqual([{ type: "delta", text: "Cze" }, { type: "delta", text: "ść." }, { type: "usage", usage: { tokensIn: 50, tokensOut: 7, cachedTokens: 0 } }]);
  });

  it("maps provider failures to clean ModelErrors and keeps billed usage on an empty reply", async () => {
    for (const [status, code] of [[429, "rate_limited"], [529, "model_unavailable"], [401, "provider_unavailable"], [400, "bad_request"], [500, "model_error"]] as const) {
      await expect(metaChat({ model: "claude-haiku-5-5", role: "guard", messages: [{ role: "user", content: "x" }], maxTokens: 100 }, { env: ENV, fetch: mock([new Response("secret body", { status })]).fetch })).rejects.toMatchObject({ code, message: expect.not.stringContaining("secret") });
    }
    const empty = Response.json({ content: [], stop_reason: "max_tokens", usage: { input_tokens: 9, output_tokens: 100 } });
    await expect(metaChat({ model: "claude-haiku-5-5", role: "guard", messages: [{ role: "user", content: "x" }], maxTokens: 100 }, { env: ENV, fetch: mock([empty]).fetch })).rejects.toMatchObject({ code: "model_error", usage: { tokensIn: 9, tokensOut: 100, cachedTokens: 0 } });
    await expect(metaChat({ model: "claude-haiku-5-5", role: "guard", messages: [{ role: "user", content: "x" }], maxTokens: 100 }, { env: {}, fetch: mock([reply("x")]).fetch })).rejects.toMatchObject({ code: "no_key" });
  });

  it("metaJson works on a Claude role", async () => {
    const m = mock([reply('{"translation":"Cześć"}')]);
    const out = await metaJson<{ translation: string }>({ role: "agent", system: "S", user: "U", schema: { type: "object" } }, { env: ENV, fetch: m.fetch });
    expect(out).toMatchObject({ data: { translation: "Cześć" }, model: "claude-sonnet-5-5" });
    expect(resolveRole("agent", ENV).provider).toBe("anthropic");
  });
});

describe("Anthropic tool loop adapter", () => {
  it("maps OpenAI-shape tool turns to blocks, merges parallel results, and echoes raw blocks", () => {
    const { system, messages } = toAnthropicToolMessages([
      { role: "system", content: "SYS" },
      { role: "user", content: "review" },
      { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "a", arguments: '{"x":1}' } }, { id: "t2", type: "function", function: { name: "b", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "t1", content: "r1" },
      { role: "tool", tool_call_id: "t2", content: "r2" },
      { role: "assistant", content: "x", raw: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "x" }] },
      { role: "user", content: "again" },
    ]);
    expect(system).toBe("SYS");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(messages[1].content).toEqual([{ type: "tool_use", id: "t1", name: "a", input: { x: 1 } }, { type: "tool_use", id: "t2", name: "b", input: {} }]);
    expect(messages[2].content).toEqual([{ type: "tool_result", tool_use_id: "t1", content: "r1" }, { type: "tool_result", tool_use_id: "t2", content: "r2" }]);
    expect((messages[3].content as Array<{ type: string }>)[0].type).toBe("thinking");
  });

  it("returns tool calls and raw blocks from a tool_use reply", async () => {
    const m = mock([Response.json({ content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "tu1", name: "get_case_item", input: { id: "d1" } }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } })]);
    const cfg = resolveRole("reason", ENV);
    const r = await anthropicToolChat(cfg, { messages: [{ role: "user", content: "go" }], tools: [{ type: "function", function: { name: "get_case_item", description: "d", parameters: { type: "object" } } }], maxTokens: 1000 }, { env: ENV, fetch: m.fetch });
    expect(m.seen[0].body).toMatchObject({ tools: [{ name: "get_case_item", input_schema: { type: "object" } }], tool_choice: { type: "auto" } });
    expect(r.toolCalls).toEqual([{ id: "tu1", type: "function", function: { name: "get_case_item", arguments: '{"id":"d1"}' } }]);
    expect(r.content).toBeNull();
    expect(r.raw).toHaveLength(2);
  });
});
