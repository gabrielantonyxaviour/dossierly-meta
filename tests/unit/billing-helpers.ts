import { vi } from "vitest";
import { createCheckout } from "@/lib/billing/checkout";
import type { PaidPlan } from "@/lib/billing/plans";
import { processWebhook } from "@/lib/billing/webhook";
import { freshLocalEnv } from "@/lib/server/local";
import type { Env } from "@/lib/server/env";
import { ensureUser } from "@/lib/server/session";

export const testEnv = (): Env =>
  freshLocalEnv({
    DODO_PAYMENTS_API_KEY: "test-key", DODO_WEBHOOK_KEY: "", DODO_ENV: "test_mode", APP_URL: "https://app.test",
    DODO_PRODUCT_ONE_CASE: "pdt_one", DODO_PRODUCT_ONE_CASE_FOUNDING: "pdt_found", DODO_PRODUCT_HOUSEHOLD_YEAR: "pdt_house",
  });

export type DodoCall = { path: string; body: Record<string, unknown> };

/** Stubs fetch for the Dodo API and records what we sent. */
export function stubDodo(fail = false): DodoCall[] {
  const calls: DodoCall[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body) as Record<string, unknown>;
    calls.push({ path, body });
    if (fail) return new Response("{}", { status: 500 });
    return Response.json(path === "/discounts" ? { code: body.code } : { session_id: `cks_${calls.length}`, checkout_url: `https://test.checkout.dodopayments.com/session/cks_${calls.length}` });
  });
  return calls;
}

export async function newUser(env: Env, id: string): Promise<string> {
  await ensureUser(env, id);
  return id;
}

export const checkout = (env: Env, userId: string, plan: PaidPlan, referralCode?: string) =>
  createCheckout(env, userId, { plan, referralCode, returnPath: "/app" });

let seq = 0;
export const pay = (env: Env, purchaseId: string, amount: number, type = "payment.succeeded", extra: Record<string, unknown> = {}) =>
  processWebhook(env, `evt_${++seq}`, { type, data: { payment_id: `pay_${purchaseId}`, metadata: { purchase_id: purchaseId }, total_amount: amount, currency: "PLN", ...extra } });

export async function buy(env: Env, userId: string, plan: PaidPlan, referralCode?: string) {
  const c = await checkout(env, userId, plan, referralCode);
  await pay(env, c.purchaseId, c.price.amountGrosz);
  return c;
}
