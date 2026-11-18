import type { ContentOrigin } from "../config";
import { anthropicToolChat } from "../model/anthropic-tools";
import { normaliseOrigin } from "../model/gate";
import { ModelError } from "../model/types";
import { resolveRole } from "../model/roles";
import { StrategistError, LIMITS, WONDER_MODEL, type Usage } from "./types";

/* Chat Completions with tool calling for muse-wonder-1.0. The shared Meta provider has no tools surface, so this
 * talks to the same endpoint with the same role config (key, base URL) and a model/effort override. */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type WMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; raw?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type WonderRequest = { messages: WMessage[]; tools?: ToolDef[]; json?: Record<string, unknown>; maxTokens: number };
export type WonderReply = { content: string | null; toolCalls: ToolCall[]; usage: Usage; raw?: unknown[] };
export interface WonderClient {
  /** Model that answers; absent on test doubles (priced as Wonder). */
  model?: string;
  complete(req: WonderRequest): Promise<WonderReply>;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type RawUsage = { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };

function mapStatus(status: number): StrategistError {
  if (status === 429) return new StrategistError("The model service is busy, try again", "rate_limited", 429);
  if (status === 401 || status === 403) return new StrategistError("The model service rejected the API key", "provider_unavailable");
  if (status === 404) return new StrategistError("The review model is briefly unavailable", "provider_unavailable", 503);
  return new StrategistError("The model service returned an error", "model_error");
}

/**
 * The review model. Real users' cases (origin "user", the default) follow the reason role's user route, Claude
 * Sonnet 5.5 unless configured otherwise; demo/eval cases keep Muse Wonder. STRATEGIST_MODEL overrides both, and a
 * Meta model for a user case is refused by the content-origin gate (model/gate.ts) until META_USER_CONTENT=allow.
 */
export function createWonderClient(env: object | undefined, fetchImpl?: FetchLike, originIn?: ContentOrigin): WonderClient {
  const origin = normaliseOrigin(originIn);
  const model = (env as Record<string, unknown> | undefined)?.STRATEGIST_MODEL;
  const pinned = typeof model === "string" && model ? model : "";
  const scope = origin === "user" ? "USER" : "DEMO";
  const cfg = resolveRole("reason", { ...(env ?? {}), MODEL_REASON_EFFORT: "high", ...(pinned || origin !== "user" ? { [`MODEL_REASON_${scope}_MODEL`]: pinned || WONDER_MODEL } : {}) }, origin);
  if (cfg.provider === "anthropic") {
    const c = cfg;
    return {
      model: c.model,
      async complete(req) {
        try {
          return await anthropicToolChat(c, req, { env, fetch: fetchImpl, timeoutMs: LIMITS.callTimeoutMs });
        } catch (err) {
          if (!(err instanceof ModelError)) throw err;
          throw new StrategistError(err.message, err.code === "rate_limited" ? "rate_limited" : err.code === "no_key" ? "no_key" : err.code === "provider_unavailable" ? "provider_unavailable" : "model_error", err.status);
        }
      },
    };
  }
  return {
    model: cfg.model,
    async complete(req) {
      if (!cfg.apiKey) throw new StrategistError("The model service is not configured", "no_key", 503);
      const body: Record<string, unknown> = { model: cfg.model, messages: req.messages, max_tokens: req.maxTokens, reasoning_effort: "high" };
      if (req.tools?.length) {
        body.tools = req.tools;
        body.tool_choice = "auto";
      }
      if (req.json) body.response_format = { type: "json_schema", json_schema: { name: "case_review", schema: req.json } };
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), LIMITS.callTimeoutMs);
      try {
        const res = await (fetchImpl ?? ((u, i) => fetch(u, i)))(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (!res.ok) {
          await res.body?.cancel().catch(() => undefined);
          throw mapStatus(res.status);
        }
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>; usage?: RawUsage };
        const msg = json.choices?.[0]?.message;
        if (!msg) throw new StrategistError("The model returned an empty reply", "model_error");
        const u = json.usage;
        return {
          content: msg.content ?? null,
          toolCalls: msg.tool_calls ?? [],
          usage: { tokensIn: u?.prompt_tokens ?? 0, tokensOut: u?.completion_tokens ?? req.maxTokens, cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? 0 },
        };
      } catch (err) {
        if (err instanceof StrategistError) throw err;
        if (err instanceof Error && err.name === "AbortError") throw new StrategistError("The review took too long and was stopped", "timeout", 504);
        throw new StrategistError("Could not reach the model service", "provider_unavailable");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
