import { ASR_USD_PER_HOUR, PRICES, SPARK_PRICE } from "../config";
import type { Run } from "../server/runs";
import type { Usage } from "./types";

export type { Run };

/** List-price cost in USD; cached input tokens bill at the cached rate. */
export function costUsd(modelId: string, u: Usage): number {
  const p = priceFor(modelId);
  const fresh = Math.max(0, u.tokensIn - u.cachedTokens);
  return (fresh * p.in + u.cachedTokens * p.cached + u.tokensOut * p.out) / 1_000_000;
}

/** Unknown models (a role moved to another host) bill at Spark rates, the safe upper estimate. */
export const priceFor = (modelId: string) => PRICES[modelId] ?? SPARK_PRICE;

/** Speech-to-text cost for `seconds` of audio. */
export const asrCostUsd = (seconds: number) => (Math.max(0, seconds) / 3600) * ASR_USD_PER_HOUR;

export function emptyUsage(): Usage {
  return { tokensIn: 0, tokensOut: 0, cachedTokens: 0 };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    cachedTokens: a.cachedTokens + b.cachedTokens,
  };
}

export function makeRun(model: string, ms: number, usage: Usage, ranOn: Run["ranOn"]): Run {
  return {
    model,
    ms: Math.round(ms),
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    cachedTokens: usage.cachedTokens,
    costUsd: Number(costUsd(model, usage).toFixed(6)),
    ranOn,
  };
}

/** Sum several runs of the same model into one (multi-page letters, retries). */
export function sumRuns(runs: Run[]): Run {
  const u = runs.reduce((acc, r) => addUsage(acc, r), emptyUsage());
  const first = runs[0];
  return {
    model: first?.model ?? "",
    ms: runs.reduce((m, r) => Math.max(m, r.ms), 0),
    tokensIn: u.tokensIn,
    tokensOut: u.tokensOut,
    cachedTokens: u.cachedTokens,
    costUsd: Number(runs.reduce((s, r) => s + r.costUsd, 0).toFixed(6)),
    ranOn: runs.every((r) => r.ranOn === "replay") ? "replay" : runs.find((r) => r.ranOn !== "replay")?.ranOn ?? "cloud",
  };
}

/** Tokens one image page is assumed to cost when reserving budget (pixels cannot be counted before the call). */
export const IMAGE_TOKENS_ESTIMATE = 3000;

/**
 * Conservative input-token estimate for any chat payload: JSON characters / 3 (more than the usual 4),
 * with image data URLs dropped from the count and charged at a flat per-image estimate.
 */
export function estimateInputTokens(payload: unknown): number {
  let images = 0;
  const json = JSON.stringify(payload, (k, v) => {
    if (k === "image_url") {
      images++;
      return null;
    }
    return v;
  });
  return Math.ceil((json?.length ?? 0) / 3) + images * IMAGE_TOKENS_ESTIMATE;
}
