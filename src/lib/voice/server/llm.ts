/* Spark calls for voice turns: streamed line protocol (spoken lanes) and one-shot JSON (side lanes). */
import type { Role, ReasoningEffort } from "../../config";
import { metaChat, metaChatStream, type FetchLike } from "../../model/meta";
import { resolveRole, type EnvLike } from "../../model/roles";
import { ModelError, type ChatMessage } from "../../model/types";
import { LineStream, type LineHandlers } from "./lines";

export interface StreamArgs {
  role: Role;
  effort?: ReasoningEffort;
  system: string;
  messages: ChatMessage[];
  speak: string[];
  maxTokens?: number;
  signal?: AbortSignal;
}

function withSignal(signal?: AbortSignal): FetchLike | undefined {
  if (!signal) return undefined;
  return (u, i) => {
    const inner = i?.signal;
    const any = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
    return fetch(u, { ...i, signal: inner && any ? any([inner, signal]) : signal });
  };
}

/** Meta's 404s come in bursts of a second or two: 4 tries over ~2.5 s before a turn gives up. */
const RETRIES = 4;
const backoff = (attempt: number) => new Promise((r) => setTimeout(r, [300, 700, 1500][attempt - 1] ?? 1500));
/** Provider hiccups worth another try (not a bad key or a rejected request). */
const transient = (e: unknown) => e instanceof ModelError && ["model_unavailable", "rate_limited", "model_error"].includes(e.code);

/** Streams one reply through the line parser. Resolves with all fields once the stream ends. */
export async function streamLines(env: EnvLike, a: StreamArgs, h: Partial<LineHandlers>): Promise<{ fields: Record<string, string>; model: string; firstTokenMs: number | null }> {
  const cfg = resolveRole(a.role, env);
  const fields: Record<string, string> = {};
  const lines = new LineStream(
    { onField: (k, v) => ((fields[k] = fields[k] ? `${fields[k]}\n${v}` : v), h.onField?.(k, v)), onSentence: h.onSentence },
    new Set(a.speak),
  );
  const t0 = Date.now();
  let first: number | null = null;
  const open = () =>
    metaChatStream(
      {
        model: cfg.model,
        role: a.role,
        messages: [{ role: "system", content: a.system }, ...a.messages],
        maxTokens: a.maxTokens ?? 1500,
        reasoningEffort: a.effort ?? "minimal",
      },
      { env, fetch: withSignal(a.signal), timeoutMs: 30_000 },
    );
  // Meta answers an intermittent 404/429/5xx before streaming: retry while nothing has been said yet.
  for (let attempt = 1; ; attempt++) {
    try {
      for await (const c of open()) {
        if (a.signal?.aborted) break;
        if (c.type === "delta") {
          first ??= Date.now() - t0;
          lines.push(c.text);
        }
      }
      break;
    } catch (e) {
      if (first !== null || a.signal?.aborted || attempt >= RETRIES || !transient(e)) throw e;
      await backoff(attempt);
    }
  }
  if (!a.signal?.aborted) lines.end();
  return { fields, model: cfg.model, firstTokenMs: first };
}

/** One-shot JSON (json_object) for side lanes; returns null on any failure so a side lane never breaks a turn. */
export async function jsonCall<T>(env: EnvLike, a: { role: Role; effort?: ReasoningEffort; system: string; user: string; maxTokens?: number }): Promise<T | null> {
  const cfg = resolveRole(a.role, env);
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const out = await metaChat(
        {
          model: cfg.model,
          role: a.role,
          messages: [{ role: "system", content: a.system }, { role: "user", content: a.user }],
          maxTokens: a.maxTokens ?? 2500,
          reasoningEffort: a.effort ?? "minimal",
          json: "json_object",
        },
        { env, timeoutMs: 30_000 },
      );
      const s = out.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      return JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)) as T;
    } catch (e) {
      if (attempt >= RETRIES || !transient(e)) return null;
      await backoff(attempt);
    }
  }
  return null;
}
