import type { Env } from "./env";
import { dayKey } from "./util";

export type BudgetKind = "model_usd" | "search_calls";
const MICRO = 1_000_000;
/** Daily global caps; MODEL_DAILY_USD_CAP and SEARCH_DAILY_CAP override them. */
export const GLOBAL_CAPS: Record<BudgetKind, number> = { model_usd: 5, search_calls: 40 };
const USER_CAPS: Partial<Record<BudgetKind, number>> = { search_calls: 5 };

function globalCap(env: Env, kind: BudgetKind): number {
  const raw = (env as unknown as Record<string, unknown>)[kind === "model_usd" ? "MODEL_DAILY_USD_CAP" : "SEARCH_DAILY_CAP"];
  const n = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : GLOBAL_CAPS[kind];
}

async function spend(env: Env, scope: string, kind: BudgetKind, micro: number, capMicro: number): Promise<boolean> {
  const day = dayKey();
  for (let i = 0; i < 2; i++) {
    const upd = await env.DB.prepare(
      "UPDATE budgets SET spent_micro = spent_micro + ? WHERE day = ? AND scope = ? AND kind = ? AND spent_micro + ? <= ?",
    ).bind(micro, day, scope, kind, micro, capMicro).run();
    if ((upd.meta?.changes ?? 0) > 0) return true;
    const exists = await env.DB.prepare("SELECT 1 AS x FROM budgets WHERE day = ? AND scope = ? AND kind = ?").bind(day, scope, kind).first();
    if (exists) return false;
    const ins = await env.DB.prepare(
      "INSERT OR IGNORE INTO budgets (day, scope, kind, spent_micro) SELECT ?, ?, ?, ? WHERE ? <= ?",
    ).bind(day, scope, kind, micro, micro, capMicro).run();
    if ((ins.meta?.changes ?? 0) > 0) return true;
    if (micro > capMicro) return false;
  }
  return false;
}

/** Atomically reserves `amount` against today's caps; false when it would exceed one. */
export async function checkAndSpend(
  env: Env,
  kind: BudgetKind,
  amount: number,
  opts?: { userId?: string },
): Promise<boolean> {
  if (!(amount >= 0)) return false;
  const micro = Math.round(amount * MICRO);
  const userCap = USER_CAPS[kind];
  const userScope = opts?.userId && userCap !== undefined ? `user:${opts.userId}` : null;
  if (userScope && !(await spend(env, userScope, kind, micro, Math.round(userCap! * MICRO)))) return false;
  if (await spend(env, "global", kind, micro, Math.round(globalCap(env, kind) * MICRO))) return true;
  if (userScope) {
    await env.DB.prepare("UPDATE budgets SET spent_micro = spent_micro - ? WHERE day = ? AND scope = ? AND kind = ?")
      .bind(micro, dayKey(), userScope, kind).run();
  }
  return false;
}

/**
 * Adjusts today's global row by (actual - reserved), which may be negative. Used after a reserved call
 * finishes: the reservation becomes the real cost, or is released entirely when actual is 0. Never goes below 0.
 */
export async function settleSpend(env: Env, kind: BudgetKind, reservedUsd: number, actualUsd: number): Promise<void> {
  const delta = Math.round(actualUsd * MICRO) - Math.round(reservedUsd * MICRO);
  if (!Number.isFinite(delta) || delta === 0) return;
  await env.DB.prepare("UPDATE budgets SET spent_micro = MAX(0, spent_micro + ?) WHERE day = ? AND scope = 'global' AND kind = ?")
    .bind(delta, dayKey(), kind).run();
}

export async function getBudgets(env: Env) {
  const { results } = await env.DB.prepare("SELECT kind, spent_micro FROM budgets WHERE day = ? AND scope = 'global'")
    .bind(dayKey()).all<{ kind: BudgetKind; spent_micro: number }>();
  const spent = (k: BudgetKind) => (results.find((r) => r.kind === k)?.spent_micro ?? 0) / MICRO;
  const model = { spent: spent("model_usd"), cap: globalCap(env, "model_usd") };
  const search = { spent: spent("search_calls"), cap: globalCap(env, "search_calls") };
  // tf_usd / tavily_credits are the keys older clients read; they mirror the model and search rows.
  return { day: dayKey(), model_usd: model, search_calls: search, tf_usd: model, tavily_credits: search };
}
