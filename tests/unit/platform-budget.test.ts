import { describe, expect, it } from "vitest";
import { GLOBAL_CAPS, checkAndSpend, getBudgets } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";

const CAP = GLOBAL_CAPS.model_usd;
const SEARCH = GLOBAL_CAPS.search_calls;

describe("budget caps", () => {
  it(`caps model spend at $${CAP} per day`, async () => {
    const env = freshLocalEnv();
    expect(await checkAndSpend(env, "model_usd", CAP * 0.6)).toBe(true);
    expect(await checkAndSpend(env, "model_usd", CAP * 0.4)).toBe(true);
    expect(await checkAndSpend(env, "model_usd", 0.000001)).toBe(false);
    expect((await getBudgets(env)).model_usd.spent).toBeCloseTo(CAP, 6);
  });

  it("rejects a single spend larger than the cap", async () => {
    expect(await checkAndSpend(freshLocalEnv(), "model_usd", CAP + 0.01)).toBe(false);
  });

  it(`allows ${SEARCH} search calls globally and 5 per user`, async () => {
    const env = freshLocalEnv();
    for (let i = 0; i < 5; i++) expect(await checkAndSpend(env, "search_calls", 1, { userId: "u1" })).toBe(true);
    expect(await checkAndSpend(env, "search_calls", 1, { userId: "u1" })).toBe(false);
    for (let i = 2; i <= SEARCH / 5 + 1; i++) for (let j = 0; j < 5 && (await getBudgets(env)).search_calls.spent < SEARCH; j++) expect(await checkAndSpend(env, "search_calls", 1, { userId: `u${i}` })).toBe(true);
    expect(await checkAndSpend(env, "search_calls", 1, { userId: "over" })).toBe(false);
    expect((await getBudgets(env)).search_calls.spent).toBe(SEARCH);
  });

  it("refunds the per-user reservation when the global cap blocks", async () => {
    const env = freshLocalEnv();
    for (let i = 0; i < SEARCH; i++) await checkAndSpend(env, "search_calls", 1, { userId: `f${Math.floor(i / 5)}` });
    expect(await checkAndSpend(env, "search_calls", 1, { userId: "late" })).toBe(false);
    const row = await env.DB.prepare("SELECT spent_micro FROM budgets WHERE scope = 'user:late'").first<{ spent_micro: number }>();
    expect(row?.spent_micro).toBe(0);
  });

  it("is safe under concurrency", async () => {
    const env = freshLocalEnv();
    const slice = CAP / 5;
    const results = await Promise.all(Array.from({ length: 10 }, () => checkAndSpend(env, "model_usd", slice)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
