import { describe, expect, it } from "vitest";
import {
  createMetaClient, metaChat, metaChatStream, metaJson, parseSamOutput, samSegment, transcribeFile, visionGround, webSearch,
} from "@/lib/model/meta";
import { resolveRole } from "@/lib/model/roles";
import { ModelError } from "@/lib/model/types";

const ENV = { MODEL_API_KEY: "test-key" };
type Seen = { url: string; headers: Record<string, string>; body: unknown; raw: BodyInit | null | undefined };

function mock(replies: Array<Response | (() => Response)>) {
  const seen: Seen[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    const raw = init?.body;
    let body: unknown = null;
    if (typeof raw === "string") body = JSON.parse(raw);
    seen.push({ url, headers: init?.headers as Record<string, string>, body, raw });
    const r = replies[Math.min(seen.length, replies.length) - 1];
    return typeof r === "function" ? r() : r;
  };
  return { seen, fetch };
}
const sse = (events: string[]) => new Response(events.map((e) => `data: ${e}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
const completion = (content: string | null) => Response.json({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 40 } } });
const msgs = [{ role: "user" as const, content: "hi" }];

describe("roles", () => {
  it("defaults to the Meta API, Spark models and MODEL_API_KEY", () => {
    expect(resolveRole("interpret", ENV)).toMatchObject({ baseUrl: "https://api.meta.ai/v1", model: "muse-spark-1.2", effort: "minimal", apiKey: "test-key" });
    expect(resolveRole("vision", ENV)).toMatchObject({ model: "muse-spark-1.3" });
    expect(resolveRole("sam", ENV).model).toBe("sam-3.1");
    expect(resolveRole("asr", ENV).model).toBe("muse-voice-transcribe-1.0");
  });

  it("re-points one role at another OpenAI-compatible host without touching the others", () => {
    const env = { ...ENV, MODEL_GUARD_BASE_URL: "https://api.fireworks.ai/inference/v1/", MODEL_GUARD_MODEL: "accounts/x/models/guard", MODEL_GUARD_KEY_ENV: "FIREWORKS_KEY", FIREWORKS_KEY: "fw-key", MODEL_GUARD_EFFORT: "low" };
    expect(resolveRole("guard", env)).toMatchObject({ baseUrl: "https://api.fireworks.ai/inference/v1", model: "accounts/x/models/guard", apiKey: "fw-key", effort: "low" });
    expect(resolveRole("interpret", env)).toMatchObject({ baseUrl: "https://api.meta.ai/v1", apiKey: "test-key" });
  });
});

describe("chat", () => {
  it("sends Bearer auth, reasoning_effort, generous max_tokens and parses usage with cached tokens", async () => {
    const m = mock([completion('{"a":1}')]);
    const res = await metaChat({ model: "muse-spark-1.3", role: "reason", messages: msgs, maxTokens: 4000, reasoningEffort: "high", json: "json_object" }, { env: ENV, fetch: m.fetch });
    expect(m.seen[0].url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(m.seen[0].headers.Authorization).toBe("Bearer test-key");
    expect(m.seen[0].body).toMatchObject({ model: "muse-spark-1.3", max_tokens: 4000, reasoning_effort: "high", response_format: { type: "json_object" } });
    expect(JSON.stringify(m.seen[0].body)).not.toMatch(/logprobs|chat_template|store/);
    expect(res.usage).toEqual({ tokensIn: 100, tokensOut: 30, cachedTokens: 40 });
  });

  it("uses the role default effort and a json_schema response_format for a schema", async () => {
    const m = mock([completion("{}")]);
    await createMetaClient(ENV, m.fetch).chat({ model: "muse-spark-1.2", role: "guard", messages: msgs, maxTokens: 1500, json: { type: "object" } });
    expect(m.seen[0].body).toMatchObject({ reasoning_effort: "minimal", response_format: { type: "json_schema", json_schema: { name: "result", schema: { type: "object" } } } });
  });

  it("treats an empty reply as an error that still carries its billed usage", async () => {
    const m = mock([completion(null)]);
    const err = await metaChat({ model: "m", messages: msgs, maxTokens: 20 }, { env: ENV, fetch: m.fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err.usage).toEqual({ tokensIn: 100, tokensOut: 30, cachedTokens: 40 });
  });

  it("maps provider failures to clean ModelErrors without leaking the body", async () => {
    const attempt = async (status: number) => {
      const m = mock([new Response("secret sk-123 detail", { status })]);
      return (await metaChat({ model: "m", messages: msgs, maxTokens: 10 }, { env: ENV, fetch: m.fetch }).catch((e) => e)) as ModelError;
    };
    expect(await attempt(429)).toMatchObject({ code: "rate_limited", status: 429 });
    expect(await attempt(404)).toMatchObject({ code: "model_unavailable" });
    expect(await attempt(401)).toMatchObject({ code: "provider_unavailable" });
    const bad = await attempt(400);
    expect(bad.code).toBe("bad_request");
    expect(bad.message).not.toMatch(/sk-123/);
    const down = await metaChat({ model: "m", messages: msgs, maxTokens: 10 }, { env: ENV, fetch: async () => { throw new Error("boom sk-123"); } }).catch((e) => e);
    expect(down).toMatchObject({ code: "provider_unavailable" });
    expect(down.message).not.toMatch(/sk-123/);
  });

  it("fails with no_key before any network call", async () => {
    const m = mock([completion("x")]);
    await expect(metaChat({ model: "m", messages: msgs, maxTokens: 10 }, { env: { MODEL_API_KEY: "" }, fetch: m.fetch })).rejects.toMatchObject({ code: "no_key" });
    expect(m.seen).toHaveLength(0);
  });

  it("streams deltas then one usage chunk", async () => {
    const m = mock([sse([
      JSON.stringify({ choices: [{ delta: { content: "Dzień " } }] }),
      JSON.stringify({ choices: [{ delta: { content: "dobry." } }] }),
      JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 4 } }),
    ])]);
    const chunks = [];
    for await (const c of metaChatStream({ model: "muse-spark-1.2", role: "interpret", messages: msgs, maxTokens: 400 }, { env: ENV, fetch: m.fetch })) chunks.push(c);
    expect(m.seen[0].body).toMatchObject({ stream: true });
    expect(chunks.filter((c) => c.type === "delta").map((c) => (c as { text: string }).text).join("")).toBe("Dzień dobry.");
    expect(chunks.at(-1)).toEqual({ type: "usage", usage: { tokensIn: 12, tokensOut: 4, cachedTokens: 0 } });
  });

  it("returns schema-constrained JSON parsed", async () => {
    const m = mock([completion('{"ok":true}')]);
    const r = await metaJson<{ ok: boolean }>({ system: "s", user: "u", schema: { type: "object" } }, { env: ENV, fetch: m.fetch });
    expect(r.data.ok).toBe(true);
    const bad = mock([completion("nope")]);
    await expect(metaJson({ system: "s", user: "u", schema: {} }, { env: ENV, fetch: bad.fetch })).rejects.toMatchObject({ code: "invalid_output" });
  });
});

describe("vision grounding and SAM", () => {
  it("converts the 0-1000 grid to pixels and clamps to 1000", async () => {
    const objects = [{ object_name: "deadline", text: "w terminie 14 dni", bbox: { x_min: 100, y_min: 200, x_max: 1200, y_max: 300 } }];
    const m = mock([completion(JSON.stringify({ objects }))]);
    const r = await visionGround({ image: "data:image/png;base64,AAA", targets: ["the deadline phrase"], size: { w: 2000, h: 1000 } }, { env: ENV, fetch: m.fetch });
    expect(r.boxes[0]).toMatchObject({ x1: 100, y1: 200, x2: 1000, y2: 300, px: [200, 200, 2000, 300] });
    expect(m.seen[0].body).toMatchObject({ model: "muse-spark-1.3", max_tokens: 4000 });
    expect(JSON.stringify(m.seen[0].body)).toContain("object grounding expert");
  });

  it("parses SAM boxes and optional masks from output text", () => {
    const out = "1<|box;x1=10;y1=20;x2=110;y2=220;w=1000;h=800|><|mask;ABC85|>2<|box;x1=1;y1=2;x2=3;y2=4;w=1000;h=800|>";
    expect(parseSamOutput(out)).toEqual([
      { id: 1, x1: 10, y1: 20, x2: 110, y2: 220, w: 1000, h: 800, mask: "ABC85" },
      { id: 2, x1: 1, y1: 2, x2: 3, y2: 4, w: 1000, h: 800 },
    ]);
  });

  it("posts the box prompt to /responses as a stream and collects the deltas", async () => {
    const m = mock([sse([
      JSON.stringify({ type: "response.output_text.delta", delta: "1<|box;x1=10;y1=20;x2=110;" }),
      JSON.stringify({ type: "response.output_text.delta", delta: "y2=220;w=1000;h=800|>" }),
    ])]);
    const r = await samSegment({ image: "data:image/png;base64,AAA", boxes: [[10, 20, 110, 220]], size: { w: 1000, h: 800 } }, { env: ENV, fetch: m.fetch });
    const body = m.seen[0].body as { model: string; stream: boolean; input: Array<{ content: Array<{ type: string; text?: string }> }> };
    expect(m.seen[0].url).toBe("https://api.meta.ai/v1/responses");
    expect(body).toMatchObject({ model: "sam-3.1", stream: true });
    expect(body.input[0].content[0].text).toBe("<0f>1<|box;x1=10;y1=20;x2=110;y2=220;w=1000;h=800|>");
    expect(r.boxes).toHaveLength(1);
    expect(r.costUsd).toBeCloseTo(0.0025, 6);
  });
});

describe("web search", () => {
  it("uses the Responses API web_search tool and returns url_citation annotations", async () => {
    const reply = { output: [{ type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text: "Fee is 440 zł.", annotations: [{ type: "url_citation", url: "https://www.gov.pl/a", title: "Fees", start_index: 0, end_index: 14 }] }] }], usage: { input_tokens: 500, output_tokens: 60 } };
    const m = mock([Response.json(reply)]);
    const r = await webSearch({ query: "residence card fee" }, { env: ENV, fetch: m.fetch });
    expect(m.seen[0].url).toBe("https://api.meta.ai/v1/responses");
    expect(m.seen[0].body).toMatchObject({ model: "muse-spark-1.3", tools: [{ type: "web_search" }] });
    expect(r.citations).toEqual([{ url: "https://www.gov.pl/a", title: "Fees", start: 0, end: 14 }]);
    expect(r.searches).toBe(1);
    expect(r.text).toBe("Fee is 440 zł.");
  });
});

describe("transcribeFile", () => {
  it("posts multipart with a request part and an audio part", async () => {
    const m = mock([Response.json({ transcript: " Dzień dobry " })]);
    const wav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    const r = await transcribeFile({ wav, languageBias: ["Polish"] }, { env: ENV, fetch: m.fetch });
    expect(r.text).toBe("Dzień dobry");
    expect(m.seen[0].url).toBe("https://api.meta.ai/v1/asr/transcribe");
    const form = m.seen[0].raw as FormData;
    expect(JSON.parse(await (form.get("request") as Blob).text())).toEqual({ model: "muse-voice-transcribe-1.0", mode: "PUSH_TO_TALK", audioEncoding: "WAV", languageBias: ["Polish"] });
    expect(((form.get("audio") as Blob).size)).toBe(12);
    expect(m.seen[0].headers["Content-Type"]).toBeUndefined();
  });
});
