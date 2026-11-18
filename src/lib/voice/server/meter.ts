/*
 * Spend control for live voice. Voice lanes stream outside runModel, so they are metered here without adding latency
 * to a turn: the gate before a call is synchronous (the MODELS_DISABLED kill switch plus a cached "cap reached today"
 * flag), and each call's cost is booked against the same daily model cap after it ends, never awaited by the turn.
 */
import { asrCostUsd, costUsd } from "../../model/cost";
import { MODELS_OFF_MESSAGE, OVER_BUDGET_MESSAGE, modelsDisabled } from "../../model/meter";
import { ModelError, type Usage } from "../../model/types";
import { checkAndSpend, getBudgets, settleSpend } from "../../server/budget";
import type { Env } from "../../server/env";
import { dayKey } from "../../server/util";

/** The budget day on which this isolate saw the global model cap reached; the cap is global, so is the flag. */
let overCapDay: string | null = null;

type AnyEnv = object | undefined;
const asEnv = (env: AnyEnv) => env as Env;
const hasDb = (env: AnyEnv): boolean => {
  const db = (env as { DB?: unknown } | undefined)?.DB;
  return typeof db === "object" && db !== null;
};

/** Throws before a voice model call when calls are switched off or today's cap is already spent. Synchronous. */
export function assertVoiceAllowed(env: AnyEnv): void {
  if (modelsDisabled(asEnv(env ?? {}))) throw new ModelError(MODELS_OFF_MESSAGE, "models_disabled", 503);
  if (overCapDay === dayKey()) throw new ModelError(OVER_BUDGET_MESSAGE, "over_budget", 429);
}

/**
 * Books `usd` already spent against today's cap. A call that passes the cap is still recorded, and it closes the
 * gate for the following calls. Never throws: bookkeeping must not fail a turn.
 */
export async function bookVoiceSpend(env: AnyEnv, usd: number): Promise<void> {
  if (!(usd > 0) || !hasDb(env)) return;
  try {
    if (await checkAndSpend(asEnv(env), "model_usd", usd)) return;
    overCapDay = dayKey();
    await settleSpend(asEnv(env), "model_usd", 0, usd);
  } catch {
    /* the turn already happened; a failed write only under-counts this one call */
  }
}

export const bookVoiceUsage = (env: AnyEnv, model: string, usage: Usage): Promise<void> => bookVoiceSpend(env, costUsd(model, usage));
export const bookAsrAudio = (env: AnyEnv, audioMs: number): Promise<void> => bookVoiceSpend(env, asrCostUsd(audioMs / 1000));

/** Reads today's spend once (at session start, in the background) so a spent cap closes the gate early. */
export async function primeVoiceBudget(env: AnyEnv): Promise<void> {
  if (!hasDb(env)) return;
  try {
    const { model_usd } = await getBudgets(asEnv(env));
    if (model_usd.spent >= model_usd.cap) overCapDay = dayKey();
  } catch {
    /* unknown: leave the gate as it is */
  }
}

/** Tests only. */
export function resetVoiceMeter(): void {
  overCapDay = null;
}
