/*
 * Meta Model API provider (OpenAI-compatible Chat Completions plus /responses and /asr). Plain fetch, no SDK.
 * Reasoning tokens count against max_tokens and logprobs are unsupported (400), so callers ask the model for its
 * own confidence instead. Every role can be re-pointed at another OpenAI-compatible host through env (see roles.ts).
 */
import { estimateInputTokens } from "./cost";
import { resolveRole, type EnvLike, type RoleConfig, type Service } from "./roles";
import type { ChatClient, ChatMessage, ChatRequest, ChatResult, Usage } from "./types";
import { ModelError } from "./types";
import { relayable, relayMode, relayOf, viaRelay } from "./relay";
import { SAM_USD_PER_IMAGE, type Role } from "../config";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface MetaOpts {
  env?: EnvLike;
  fetch?: FetchLike;
  timeoutMs?: number;
}

const doFetch = (o: MetaOpts): FetchLike => o.fetch ?? ((u, i) => fetch(u, i));

function mapStatus(status: number): ModelError {
  if (status === 429) return new ModelError("The model service is busy, try again", "rate_limited", 429);
  if (status === 404) return new ModelError("This model is briefly unavailable", "model_unavailable", 503);
  if (status === 401 || status === 403) return new ModelError("The model service rejected the API key", "provider_unavailable");
  if (status === 400) return new ModelError("The model service rejected the request", "bad_request", 502);
  return new ModelError("The model service returned an error", "model_error");
}

async function post(cfg: RoleConfig, path: string, body: BodyInit, o: MetaOpts, headers: Record<string, string> = {}): Promise<Response> {
  if (!cfg.apiKey) throw new ModelError("The model service is not configured", "no_key", 503);
  const ctl = new AbortController();
  const timeoutMs = o.timeoutMs ?? 90_000;
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const url = `${cfg.baseUrl}${path}`;
  const init = { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}`, ...headers }, body, signal: ctl.signal };
  try {
    const relay = relayOf(o.env);
    const canRelay = !!relay && typeof body === "string" && relayable(url);
    // MODEL_RELAY_MODE=always: every Meta call goes out from western Europe (ops switch if an edge keeps failing).
    let res = canRelay && relayMode(o.env) === "always" ? await viaRelay(relay!, url, init, timeoutMs) : await doFetch(o)(url, init);
    // 404 from this edge location: the same call once more from western Europe (string bodies only: re-sendable).
    if (res.status === 404 && canRelay && relayMode(o.env) !== "always") {
      await res.body?.cancel().catch(() => undefined);
      res = await viaRelay(relay!, url, init, timeoutMs);
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw mapStatus(res.status);
    }
    return res;
  } catch (err) {
    if (err instanceof ModelError) throw err;
    throw new ModelError("Could not reach the model service", "provider_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

const postJson = (cfg: RoleConfig, path: string, body: unknown, o: MetaOpts) =>
  post(cfg, path, JSON.stringify(body), o, { "Content-Type": "application/json" });

type RawUsage = {
  prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number }; input_tokens_details?: { cached_tokens?: number };
} | undefined;

function usageOf(u: RawUsage, fallback: () => Usage): Usage {
  if (!u) return fallback();
  return {
    tokensIn: u.prompt_tokens ?? u.input_tokens ?? 0,
    tokensOut: u.completion_tokens ?? u.output_tokens ?? 0,
    cachedTokens: u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0,
  };
}

/** No usage in a reply: assume the worst for metering (all of max_tokens), never zero. */
const worstCase = (messages: unknown, maxTokens: number): Usage => ({ tokensIn: estimateInputTokens(messages), tokensOut: maxTokens, cachedTokens: 0 });

function chatBody(req: ChatRequest, cfg: RoleConfig, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model || cfg.model,
    messages: req.messages,
    max_tokens: req.maxTokens,
    reasoning_effort: req.reasoningEffort ?? cfg.effort,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  if (req.json === "json_object") body.response_format = { type: "json_object" };
  else if (req.json) body.response_format = { type: "json_schema", json_schema: { name: "result", schema: req.json } };
  return body;
}

/** Non-streaming Chat Completions call. */
export async function metaChat(req: ChatRequest, o: MetaOpts = {}): Promise<ChatResult> {
  const cfg = resolveRole(req.role ?? "agent", o.env);
  const res = await postJson(cfg, "/chat/completions", chatBody(req, cfg, false), o);
  let json: { choices?: Array<{ message?: { content?: string | null } }>; usage?: RawUsage };
  try {
    json = await res.json();
  } catch {
    throw new ModelError("The model service returned an error", "model_error");
  }
  const usage = usageOf(json.usage, () => worstCase(req.messages, req.maxTokens));
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new ModelError("Model returned an empty reply", "model_error", 502, usage);
  return { content, usage };
}

export type StreamChunk = { type: "delta"; text: string } | { type: "usage"; usage: Usage };

/** Streaming Chat Completions: yields content deltas, then one usage chunk. */
export async function* metaChatStream(req: ChatRequest, o: MetaOpts = {}): AsyncGenerator<StreamChunk> {
  const cfg = resolveRole(req.role ?? "agent", o.env);
  const res = await postJson(cfg, "/chat/completions", chatBody(req, cfg, true), o);
  let usage: Usage | null = null;
  let emitted = "";
  for await (const data of sseData(res)) {
    let d: { choices?: Array<{ delta?: { content?: string | null } }>; usage?: RawUsage };
    try {
      d = JSON.parse(data);
    } catch {
      continue;
    }
    if (d.usage) usage = usageOf(d.usage, () => worstCase(req.messages, req.maxTokens));
    const text = d.choices?.[0]?.delta?.content;
    if (text) {
      emitted += text;
      yield { type: "delta", text };
    }
  }
  yield { type: "usage", usage: usage ?? { tokensIn: estimateInputTokens(req.messages), tokensOut: Math.ceil(emitted.length / 3), cachedTokens: 0 } };
}

async function* sseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  }
  const tail = buf.trim();
  if (tail.startsWith("data:") && tail.slice(5).trim() !== "[DONE]") yield tail.slice(5).trim();
}

/** The ChatClient the features use; role selects base URL and key per call. */
export function createMetaClient(env?: EnvLike, fetchImpl?: FetchLike): ChatClient {
  return { chat: (req) => metaChat(req, { env, fetch: fetchImpl }) };
}

/** Structured output through response_format json_schema; the reply is returned parsed. */
export async function metaJson<T = unknown>(
  args: { role?: Role; system: string; user: string; schema: Record<string, unknown>; maxTokens?: number },
  o: MetaOpts = {},
): Promise<{ data: T; usage: Usage; model: string }> {
  const cfg = resolveRole(args.role ?? "agent", o.env);
  const messages: ChatMessage[] = [{ role: "system", content: args.system }, { role: "user", content: args.user }];
  const out = await metaChat({ model: cfg.model, role: args.role ?? "agent", messages, maxTokens: args.maxTokens ?? 2000, json: args.schema }, o);
  try {
    return { data: JSON.parse(out.content) as T, usage: out.usage, model: cfg.model };
  } catch {
    throw new ModelError("Model output was not valid JSON", "invalid_output");
  }
}

/* ---------- vision grounding (Spark) ---------- */

export interface GroundBox { name: string; text: string; x1: number; y1: number; x2: number; y2: number }
const GROUND_SCHEMA = {
  type: "object",
  properties: {
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          object_name: { type: "string" }, text: { type: "string" },
          bbox: { type: "object", properties: { x_min: { type: "integer" }, y_min: { type: "integer" }, x_max: { type: "integer" }, y_max: { type: "integer" } }, required: ["x_min", "y_min", "x_max", "y_max"] },
        },
        required: ["object_name", "text", "bbox"],
      },
    },
  },
  required: ["objects"],
};
const GROUND_SYSTEM =
  "You are an object grounding expert. Return a bounding box for every requested item, in normalized 0-1000 coordinates relative to the image (0,0 top-left). Include the exact text inside each box. If you cannot find an item, omit it.";
const clamp1000 = (n: number) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));

/** Asks Spark to box `targets` on an image. Boxes come back in the 0-1000 grid and as pixels for `size`. */
export async function visionGround(
  args: { image: string; targets: string[]; size: { w: number; h: number } },
  o: MetaOpts = {},
): Promise<{ boxes: Array<GroundBox & { px: [number, number, number, number] }>; usage: Usage; model: string }> {
  const cfg = resolveRole("vision", o.env);
  const messages: ChatMessage[] = [
    { role: "system", content: GROUND_SYSTEM },
    { role: "user", content: [{ type: "text", text: `Find: ${args.targets.join("; ")}` }, { type: "image_url", image_url: { url: args.image } }] },
  ];
  const out = await metaChat({ model: cfg.model, role: "vision", messages, maxTokens: 4000, reasoningEffort: "low", json: GROUND_SCHEMA }, o);
  let parsed: { objects?: Array<{ object_name?: string; text?: string; bbox?: Record<string, number> }> };
  try {
    parsed = JSON.parse(out.content);
  } catch {
    throw new ModelError("Model output was not valid JSON", "invalid_output", 502, out.usage);
  }
  const boxes = (parsed.objects ?? []).flatMap((x) => {
    const b = x.bbox;
    if (!b) return [];
    const [x1, y1, x2, y2] = [clamp1000(b.x_min), clamp1000(b.y_min), clamp1000(b.x_max), clamp1000(b.y_max)];
    const px: [number, number, number, number] = [
      Math.round((x1 / 1000) * args.size.w), Math.round((y1 / 1000) * args.size.h),
      Math.round((x2 / 1000) * args.size.w), Math.round((y2 / 1000) * args.size.h),
    ];
    return [{ name: x.object_name ?? "", text: x.text ?? "", x1, y1, x2, y2, px }];
  });
  return { boxes, usage: out.usage, model: cfg.model };
}

/* ---------- SAM 3.1 ---------- */

export interface SamBox { id: number; x1: number; y1: number; x2: number; y2: number; w: number; h: number; mask?: string }
const SAM_BOX = /(\d+)<\|box;([^|]*)\|>(?:<\|mask;([^|]*)\|>)?/g;

/** Parses `id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>` (and an optional `<|mask;...|>` payload) from SAM output text. */
export function parseSamOutput(text: string): SamBox[] {
  const out: SamBox[] = [];
  for (const m of text.matchAll(SAM_BOX)) {
    const kv = Object.fromEntries(m[2].split(";").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k, Number(v)]));
    if (!["x1", "y1", "x2", "y2"].every((k) => Number.isFinite(kv[k]))) continue;
    out.push({ id: Number(m[1]), x1: kv.x1, y1: kv.y1, x2: kv.x2, y2: kv.y2, w: kv.w ?? 0, h: kv.h ?? 0, ...(m[3] ? { mask: m[3] } : {}) });
  }
  return out;
}

/** Refines box prompts (real image pixels) into SAM 3.1 boxes; masks are returned base85-encoded when present. */
export async function samSegment(
  args: { image: string; boxes: Array<[number, number, number, number]>; size: { w: number; h: number } },
  o: MetaOpts = {},
): Promise<{ boxes: SamBox[]; raw: string; costUsd: number; model: string }> {
  const cfg = resolveRole("sam", o.env);
  const { w, h } = args.size;
  const prompt = `<0f>${args.boxes.map((b, i) => `${i + 1}<|box;x1=${b[0]};y1=${b[1]};x2=${b[2]};y2=${b[3]};w=${w};h=${h}|>`).join(",")}`;
  const res = await postJson(cfg, "/responses", {
    model: cfg.model, stream: true,
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: args.image }] }],
  }, o);
  let text = "";
  for await (const data of sseData(res)) {
    try {
      const ev = JSON.parse(data) as { type?: string; delta?: string };
      if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
    } catch {
      /* skip keep-alive noise */
    }
  }
  return { boxes: parseSamOutput(text), raw: text, costUsd: SAM_USD_PER_IMAGE, model: cfg.model };
}

/* ---------- grounded web search (Responses API) ---------- */

export interface Citation { url: string; title: string; start: number; end: number }
export interface SearchResult { text: string; citations: Citation[]; searches: number; usage: Usage; model: string }

export async function webSearch(args: { query: string; system?: string; maxTokens?: number }, o: MetaOpts = {}): Promise<SearchResult> {
  const cfg = resolveRole("search", o.env);
  const res = await postJson(cfg, "/responses", {
    model: cfg.model,
    max_output_tokens: args.maxTokens ?? 2500,
    reasoning: { effort: cfg.effort },
    tools: [{ type: "web_search" }],
    input: [
      ...(args.system ? [{ type: "message", role: "system", content: [{ type: "input_text", text: args.system }] }] : []),
      { type: "message", role: "user", content: [{ type: "input_text", text: args.query }] },
    ],
  }, o);
  const json = (await res.json().catch(() => null)) as {
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string; start_index?: number; end_index?: number }> }> }>;
    usage?: RawUsage;
  } | null;
  if (!json) throw new ModelError("The model service returned an error", "model_error");
  let text = "";
  const citations: Citation[] = [];
  let searches = 0;
  for (const item of json.output ?? []) {
    if (item.type === "web_search_call") searches++;
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      text += part.text ?? "";
      for (const a of part.annotations ?? []) {
        if (a.type === "url_citation" && a.url) citations.push({ url: a.url, title: a.title ?? "", start: a.start_index ?? 0, end: a.end_index ?? 0 });
      }
    }
  }
  const usage = usageOf(json.usage, () => ({ tokensIn: Math.ceil(args.query.length / 3), tokensOut: args.maxTokens ?? 2500, cachedTokens: 0 }));
  return { text, citations, searches: Math.max(searches, citations.length ? 1 : 0), usage, model: cfg.model };
}

/* ---------- speech to text (file mode) ---------- */

/** WAV mono 16-bit, 16 or 24 kHz. Language is a bias hint (BCP-47 or a language name), not a limit. */
export async function transcribeFile(
  args: { wav: Uint8Array; languageBias?: string[] },
  o: MetaOpts = {},
): Promise<{ text: string; model: string; raw: unknown }> {
  const cfg = resolveRole("asr", o.env);
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ model: cfg.model, mode: "PUSH_TO_TALK", audioEncoding: "WAV", languageBias: args.languageBias ?? [] })], { type: "application/json" }));
  form.append("audio", new Blob([args.wav as unknown as ArrayBuffer], { type: "audio/wav" }), "audio.wav");
  const res = await post(cfg, "/asr/transcribe", form, o);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) throw new ModelError("The speech service returned an error", "model_error");
  const t = json.transcript ?? json.text ?? (json.result as Record<string, unknown> | undefined)?.transcript;
  return { text: typeof t === "string" ? t.trim() : "", model: cfg.model, raw: json };
}
