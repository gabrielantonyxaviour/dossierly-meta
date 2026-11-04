/* Recording ChatClient: wraps the product's Meta client, retries transient failures, and keeps per-call usage and latency. */
import { createMetaClient } from "../../src/lib/model/meta";
import type { ChatClient, ChatRequest, Usage } from "../../src/lib/model/types";
import { ModelError } from "../../src/lib/model/types";

export interface CallRecord { kind: "ground" | "read"; model: string; ms: number; usage: Usage; ok: boolean; attempts: number }
export const PRICES: Record<string, { in: number; cached: number; out: number }> = {
  "muse-spark-1.1": { in: 1.25, cached: 0.15, out: 4.25 },
  "muse-spark-1.2": { in: 1.25, cached: 0.15, out: 4.25 },
  "muse-spark-1.3": { in: 1.25, cached: 0.15, out: 4.25 },
  "muse-wonder-1.0": { in: 4, cached: 4, out: 20 }, // no published cached rate: billed as fresh input (upper bound)
};
export const SAM_USD = 2.5 / 1000;
export const usd = (model: string, u: Usage): number => {
  const p = PRICES[model];
  if (!p) throw new Error(`no price for ${model}`);
  return (Math.max(0, u.tokensIn - u.cachedTokens) * p.in + u.cachedTokens * p.cached + u.tokensOut * p.out) / 1e6;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = new Set(["model_error", "rate_limited", "provider_unavailable", "model_unavailable"]);

export function recordingClient(env: Record<string, string>, onCall: (c: CallRecord) => void): ChatClient {
  const inner = createMetaClient(env);
  return {
    async chat(req: ChatRequest) {
      const sys = req.messages[0]?.content;
      const kind: CallRecord["kind"] = typeof sys === "string" && sys.startsWith("You are an object grounding") ? "ground" : "read";
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const t0 = Date.now();
        try {
          const res = await inner.chat(req);
          onCall({ kind, model: req.model, ms: Date.now() - t0, usage: res.usage, ok: true, attempts: attempt });
          return res;
        } catch (e) {
          lastErr = e;
          if (e instanceof ModelError && e.usage) onCall({ kind, model: req.model, ms: Date.now() - t0, usage: e.usage, ok: false, attempts: attempt });
          if (!(e instanceof ModelError) || !TRANSIENT.has(e.code) || attempt === 4) throw e;
          await sleep(1500 * 2 ** (attempt - 1) + Math.random() * 500);
        }
      }
      throw lastErr;
    },
  };
}
