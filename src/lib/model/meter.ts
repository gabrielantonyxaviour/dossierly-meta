/*
 * The one place model spend is counted. Every path that can reach the model provider (runModel, the agent cloud
 * run, grounded search, SAM, speech) reserves an upper-bound estimate against the daily cap first, then settles to
 * the actual cost from the response usage.
 */
import type { Env } from "../server/env";
import { checkAndSpend, settleSpend } from "../server/budget";
import { costUsd, estimateInputTokens, priceFor } from "./cost";
import type { ChatClient, ChatRequest } from "./types";
import { ModelError } from "./types";

export const OVER_BUDGET_MESSAGE = "Daily limit reached. Try again after 08:00 MYT.";
export const MODELS_OFF_MESSAGE = "Model calls are switched off";

/** Kill switch: MODELS_DISABLED="1" stops every model call. */
export const modelsDisabled = (env: Pick<Env, "MODELS_DISABLED">): boolean => String(env.MODELS_DISABLED ?? "").trim() === "1";

export function assertModelsEnabled(env: Pick<Env, "MODELS_DISABLED">): void {
  if (modelsDisabled(env)) throw new ModelError(MODELS_OFF_MESSAGE, "models_disabled", 503);
}

/** Upper-bound USD for one chat call: estimated input at the input price plus all of max_tokens at the output price. */
export function estimateChatUsd(model: string, payload: unknown, maxTokens: number): number {
  const p = priceFor(model);
  return (estimateInputTokens(payload) * p.in + maxTokens * p.out) / 1_000_000;
}

/** Atomically reserves `usd` against today's cap; throws the over_budget error when it would pass it. */
export async function reserveModelSpend(env: Env, usd: number): Promise<void> {
  if (!(await checkAndSpend(env, "model_usd", usd))) throw new ModelError(OVER_BUDGET_MESSAGE, "over_budget", 429);
}

/** Settles a reservation to the real cost (0 releases it). Bookkeeping must never fail the user's request. */
export async function settleModelSpend(env: Env, reservedUsd: number, actualUsd: number): Promise<void> {
  try {
    await settleSpend(env, "model_usd", reservedUsd, actualUsd);
  } catch {
    /* the reservation stands, which errs on the side of the cap */
  }
}

/** Wraps a chat client so each call (including a JSON retry or a fallback model) is reserved, then settled. */
export function meterClient(env: Env, inner: ChatClient): ChatClient {
  return {
    async chat(req: ChatRequest) {
      assertModelsEnabled(env);
      const reserved = estimateChatUsd(req.model, req.messages, req.maxTokens);
      await reserveModelSpend(env, reserved);
      try {
        const res = await inner.chat(req);
        await settleModelSpend(env, reserved, costUsd(req.model, res.usage));
        return res;
      } catch (err) {
        // A reply the provider billed but we could not use carries its usage; any other failure had none.
        await settleModelSpend(env, reserved, err instanceof ModelError && err.usage ? costUsd(req.model, err.usage) : 0);
        throw err;
      }
    },
  };
}

/**
 * Meters any non-chat call (SAM, speech, grounded search): reserves `reservedUsd`, runs, settles to what `fn`
 * reports as actual cost, and releases the reservation when it throws.
 */
export async function meterFixed<T>(env: Env, reservedUsd: number, fn: () => Promise<{ value: T; actualUsd: number }>): Promise<T> {
  assertModelsEnabled(env);
  await reserveModelSpend(env, reservedUsd);
  try {
    const { value, actualUsd } = await fn();
    await settleModelSpend(env, reservedUsd, actualUsd);
    return value;
  } catch (err) {
    await settleModelSpend(env, reservedUsd, 0);
    throw err;
  }
}
