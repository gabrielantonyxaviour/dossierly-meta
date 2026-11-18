/*
 * Anthropic Messages API provider (plain fetch, no SDK). Takes the same ChatRequest the Meta client takes and
 * returns the same ChatResult, so features never know which provider answered. JSON output is requested in the
 * system prompt and validated by the caller's zod schema (callJson retries once), the same contract as Meta's
 * json_object. Images go in as base64 blocks. No temperature is sent (Sonnet 5.5 and Haiku 5.5 reject non-default
 * sampling). Reasoning effort maps to output_config.effort; "minimal" also turns thinking off.
 */
import { estimateInputTokens } from "./cost";
import { doFetch, sseData, type MetaOpts } from "./net";
import type { RoleConfig } from "./roles";
import type { ChatMessage, ChatRequest, ChatResult, ContentPart, Usage } from "./types";
import { ModelError } from "./types";
import { assertProviderAllowed } from "./gate";

export const ANTHROPIC_VERSION = "2023-06-01";

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string } };
export type AMessage = { role: "user" | "assistant"; content: string | Block[] | Array<Record<string, unknown>> };

export function mapStatus(status: number): ModelError {
  if (status === 429) return new ModelError("The model service is busy, try again", "rate_limited", 429);
  if (status === 529 || status === 503 || status === 404) return new ModelError("This model is briefly unavailable", "model_unavailable", 503);
  if (status === 401 || status === 402 || status === 403) return new ModelError("The model service rejected the API key", "provider_unavailable");
  if (status === 400 || status === 413 || status === 422) return new ModelError("The model service rejected the request", "bad_request", 502);
  return new ModelError("The model service returned an error", "model_error");
}

const textOf = (c: string | ContentPart[]): string => (typeof c === "string" ? c : c.map((p) => (p.type === "text" ? p.text : "")).join("\n"));

function blocks(parts: ContentPart[]): Block[] {
  return parts.map((p): Block => {
    if (p.type === "text") return { type: "text", text: p.text };
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(p.image_url.url);
    return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : { type: "image", source: { type: "url", url: p.image_url.url } };
  });
}

/** System messages are lifted out; consecutive turns of one role are merged (the API wants strict alternation). */
export function toAnthropicMessages(messages: ChatMessage[]): { system: string; messages: AMessage[] } {
  const system = messages.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n\n");
  const out: AMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const content: Block[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : blocks(m.content);
    const last = out[out.length - 1];
    if (last && last.role === m.role) (last.content as Block[]).push(...content);
    else out.push({ role: m.role, content });
  }
  return { system, messages: out };
}

const JSON_RULE = "Reply with exactly one JSON object and nothing else: no prose before or after, no code fences.";
function systemWith(system: string, json: ChatRequest["json"]): string {
  if (!json) return system;
  const schema = json === "json_object" ? "" : `\nThe object must match this JSON Schema:\n${JSON.stringify(json)}`;
  return `${system}\n\n${JSON_RULE}${schema}`.trim();
}

/** Thinking and effort for one call. Opus 5.5 cannot turn thinking off; Sonnet 5.5 uses between_tools instead of disabled. */
export function thinkingParams(model: string, effort: ChatRequest["reasoningEffort"]): Record<string, unknown> {
  const e = effort ?? "low";
  const out: Record<string, unknown> = { output_config: { effort: e === "minimal" ? "low" : e } };
  if (e === "minimal") {
    if (/haiku/i.test(model)) out.thinking = { type: "disabled" };
    else if (/sonnet/i.test(model)) out.thinking = { type: "between_tools" };
  }
  return out;
}

export function anthropicBody(req: ChatRequest, cfg: RoleConfig, stream: boolean): Record<string, unknown> {
  const { system, messages } = toAnthropicMessages(req.messages);
  const model = req.model && /^claude-/i.test(req.model) ? req.model : cfg.model;
  const body: Record<string, unknown> = {
    model, max_tokens: req.maxTokens, messages, ...thinkingParams(model, req.reasoningEffort ?? cfg.effort),
  };
  const sys = systemWith(system, req.json);
  if (sys) body.system = sys;
  if (stream) body.stream = true;
  return body;
}

/** Out of credit or a billing block on the primary key (Anthropic answers 400/402/403 with a billing message). */
export function isBillingError(status: number, text: string): boolean {
  if (status === 402) return true;
  return (status === 400 || status === 403) && /credit balance|billing|purchase credits|plans? & billing/i.test(text);
}

/** Second key used only when the primary is out of credit (ANTHROPIC_API_KEY_FALLBACK, or the var named by ANTHROPIC_FALLBACK_KEY_ENV). */
export function fallbackKey(env: unknown): string {
  const e = (env ?? {}) as Record<string, unknown>;
  const p: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  const name = (typeof e.ANTHROPIC_FALLBACK_KEY_ENV === "string" && e.ANTHROPIC_FALLBACK_KEY_ENV) || p?.ANTHROPIC_FALLBACK_KEY_ENV || "ANTHROPIC_API_KEY_FALLBACK";
  const v = e[name] ?? p?.[name];
  return typeof v === "string" ? v.trim() : "";
}

export async function anthropicPost(cfg: RoleConfig, body: unknown, o: MetaOpts, path = "/v1/messages"): Promise<Response> {
  assertProviderAllowed(cfg.provider, cfg.origin, o.env);
  if (!cfg.apiKey) throw new ModelError("The model service is not configured", "no_key", 503);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 90_000);
  const send = (key: string) => doFetch(o)(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: ctl.signal,
  });
  try {
    let res = await send(cfg.apiKey);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const spare = fallbackKey(o.env);
      if (spare && spare !== cfg.apiKey && isBillingError(res.status, text)) {
        res = await send(spare);
        if (res.ok) return res;
        await res.body?.cancel().catch(() => undefined);
      }
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

type RawUsage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | undefined;

export function usageOf(u: RawUsage, fallback: () => Usage): Usage {
  if (!u) return fallback();
  const read = u.cache_read_input_tokens ?? 0;
  return { tokensIn: (u.input_tokens ?? 0) + read + (u.cache_creation_input_tokens ?? 0), tokensOut: u.output_tokens ?? 0, cachedTokens: read };
}

/** No usage in a reply: assume the worst for metering (all of max_tokens), never zero. */
export const worstCase = (messages: unknown, maxTokens: number): Usage => ({ tokensIn: estimateInputTokens(messages), tokensOut: maxTokens, cachedTokens: 0 });

/** Non-streaming Messages call. */
export async function anthropicChat(req: ChatRequest, cfg: RoleConfig, o: MetaOpts = {}): Promise<ChatResult> {
  const res = await anthropicPost(cfg, anthropicBody(req, cfg, false), o);
  let json: { content?: Array<{ type?: string; text?: string }>; stop_reason?: string; usage?: RawUsage };
  try {
    json = await res.json();
  } catch {
    throw new ModelError("The model service returned an error", "model_error");
  }
  const usage = usageOf(json.usage, () => worstCase(req.messages, req.maxTokens));
  const content = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (json.stop_reason === "refusal" || !content) throw new ModelError("Model returned an empty reply", "model_error", 502, usage);
  return { content, usage };
}

export type AStreamChunk = { type: "delta"; text: string } | { type: "usage"; usage: Usage };

/** Streaming Messages call: content deltas, then one usage chunk. */
export async function* anthropicChatStream(req: ChatRequest, cfg: RoleConfig, o: MetaOpts = {}): AsyncGenerator<AStreamChunk> {
  const res = await anthropicPost(cfg, anthropicBody(req, cfg, true), o);
  let inTok: RawUsage;
  let outTokens = 0;
  let sawUsage = false;
  let emitted = "";
  for await (const data of sseData(res)) {
    let d: { type?: string; message?: { usage?: RawUsage }; delta?: { type?: string; text?: string }; usage?: RawUsage };
    try {
      d = JSON.parse(data);
    } catch {
      continue;
    }
    if (d.type === "message_start") inTok = d.message?.usage;
    else if (d.type === "message_delta" && d.usage) {
      sawUsage = true;
      outTokens = d.usage.output_tokens ?? outTokens;
      inTok = { ...inTok, ...d.usage, output_tokens: undefined };
    } else if (d.type === "content_block_delta" && d.delta?.type === "text_delta" && d.delta.text) {
      emitted += d.delta.text;
      yield { type: "delta", text: d.delta.text };
    }
  }
  const usage = sawUsage || inTok
    ? { ...usageOf({ ...inTok, output_tokens: outTokens }, () => worstCase(req.messages, req.maxTokens)) }
    : { tokensIn: estimateInputTokens(req.messages), tokensOut: Math.ceil(emitted.length / 3), cachedTokens: 0 };
  yield { type: "usage", usage };
}
