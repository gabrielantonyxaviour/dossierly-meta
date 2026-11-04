import { resolveRole } from "../model/roles";
import { StrategistError, LIMITS, WONDER_MODEL, type Usage } from "./types";

/* Chat Completions with tool calling for muse-wonder-1.0. The shared Meta provider has no tools surface, so this
 * talks to the same endpoint with the same role config (key, base URL) and a model/effort override. */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type WMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type WonderRequest = { messages: WMessage[]; tools?: ToolDef[]; json?: Record<string, unknown>; maxTokens: number };
export type WonderReply = { content: string | null; toolCalls: ToolCall[]; usage: Usage };
export interface WonderClient {
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

export function createWonderClient(env: object | undefined, fetchImpl?: FetchLike): WonderClient {
  const model = (env as Record<string, unknown> | undefined)?.STRATEGIST_MODEL;
  const cfg = resolveRole("reason", { ...(env ?? {}), MODEL_REASON_MODEL: typeof model === "string" && model ? model : WONDER_MODEL, MODEL_REASON_EFFORT: "high" });
  return {
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
