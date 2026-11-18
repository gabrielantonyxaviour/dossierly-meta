import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { randomId } from "@/lib/server/util";
import { createCheckoutSession, createDiscount, foundingCode, productId } from "./dodo";
import { RESERVATION_MS, FOUNDING_CAP, type PaidPlan } from "./plans";
import { computePrice, type Price } from "./pricing";
import { addCredit, creditBalance } from "./store";

export type CheckoutResult = { checkoutUrl: string; purchaseId: string; plan: PaidPlan; founding: boolean; price: Price };

/** Releases a purchase that will not be paid: frees its founding seat and gives its credit back. */
export async function expirePurchase(env: Env, purchaseId: string, status: "expired" | "failed" = "expired"): Promise<void> {
  const r = await env.DB.prepare("UPDATE purchases SET status = ? WHERE id = ? AND status = 'pending'").bind(status, purchaseId).run();
  if (!r.meta?.changes) return;
  const p = await env.DB.prepare("SELECT user_id, credit_grosz FROM purchases WHERE id = ?").bind(purchaseId).first<{ user_id: string; credit_grosz: number }>();
  if (p && p.credit_grosz > 0) await addCredit(env, p.user_id, p.credit_grosz, "restore", purchaseId);
}

async function supersedePending(env: Env, userId: string): Promise<void> {
  const { results } = await env.DB.prepare("SELECT id FROM purchases WHERE user_id = ? AND status = 'pending'").bind(userId).all<{ id: string }>();
  for (const r of results) await expirePurchase(env, r.id);
}

type Referral = { referrerId: string; code: string } | null;

async function resolveReferral(env: Env, userId: string, raw: string | undefined): Promise<Referral> {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  const ref = await env.DB.prepare("SELECT user_id FROM referral_codes WHERE code = ?").bind(code).first<{ user_id: string }>();
  if (!ref || ref.user_id === userId) throw new ApiError(400, "That referral code is not valid", "referral_invalid");
  const paid = await env.DB.prepare("SELECT 1 AS x FROM purchases WHERE user_id = ? AND status IN ('succeeded','refunded') LIMIT 1").bind(userId).first();
  if (paid) throw new ApiError(400, "Referral codes are for first purchases only", "referral_not_eligible");
  return { referrerId: ref.user_id, code };
}

type Row = { plan: PaidPlan; price: Price; founding: boolean; referral: Referral };

/** Inserts the pending purchase. A founding seat is claimed in the same statement that counts them, so racing checkouts cannot exceed the cap. */
async function insertPurchase(env: Env, id: string, userId: string, r: Row, now: number): Promise<boolean> {
  const cols = "id, user_id, plan, base_grosz, amount_grosz, referral_discount_grosz, credit_grosz, founding, referral_code, status, reserved_until, created_at";
  const vals = [id, userId, r.plan, r.price.baseGrosz, r.price.amountGrosz, r.price.referralDiscountGrosz, r.price.creditGrosz, r.founding ? 1 : 0, r.referral?.code ?? null];
  const tail = [now + RESERVATION_MS, now];
  if (!r.founding) {
    await env.DB.prepare(`INSERT INTO purchases (${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).bind(...vals, ...tail).run();
    return true;
  }
  const res = await env.DB.prepare(
    `INSERT INTO purchases (${cols}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
     WHERE (SELECT COUNT(*) FROM purchases WHERE founding = 1 AND (status IN ('succeeded','refunded') OR (status = 'pending' AND reserved_until > ?))) < ?`,
  ).bind(...vals, ...tail, now, FOUNDING_CAP).run();
  return !!res.meta?.changes;
}

/** Spends credit only if the balance still covers it (conditional insert); otherwise the purchase reverts to the credit-free price. */
async function spendCredit(env: Env, userId: string, purchaseId: string, grosz: number): Promise<boolean> {
  if (grosz <= 0) return true;
  const res = await env.DB.prepare(
    `INSERT INTO credit_ledger (id, user_id, delta_grosz, reason, purchase_id, created_at)
     SELECT ?, ?, ?, 'spend', ?, ? WHERE (SELECT COALESCE(SUM(delta_grosz), 0) FROM credit_ledger WHERE user_id = ?) >= ?`,
  ).bind(randomId("cl", 9), userId, -grosz, purchaseId, Date.now(), userId, grosz).run();
  return !!res.meta?.changes;
}

export async function createCheckout(env: Env, userId: string, input: { plan: PaidPlan; referralCode?: string; returnPath: string }): Promise<CheckoutResult> {
  const now = Date.now();
  productId(env, input.plan); // fail early when billing is not configured
  const referral = await resolveReferral(env, userId, input.referralCode);
  await supersedePending(env, userId);
  const everFounding = await env.DB.prepare("SELECT 1 AS x FROM purchases WHERE user_id = ? AND founding = 1 AND status IN ('succeeded','refunded') LIMIT 1").bind(userId).first();
  const purchaseId = randomId("pur", 12);
  const credit = await creditBalance(env, userId);

  let row: Row | null = null;
  if (input.plan === "one_case" && !everFounding) {
    const founding: Row = { plan: input.plan, founding: true, referral, price: computePrice({ plan: input.plan, founding: true, referral: !!referral, creditGrosz: credit }) };
    if (await insertPurchase(env, purchaseId, userId, founding, now)) row = founding;
  }
  if (!row) {
    row = { plan: input.plan, founding: false, referral, price: computePrice({ plan: input.plan, founding: false, referral: !!referral, creditGrosz: credit }) };
    await insertPurchase(env, purchaseId, userId, row, now);
  }
  if (!(await spendCredit(env, userId, purchaseId, row.price.creditGrosz))) {
    row.price = computePrice({ plan: row.plan, founding: row.founding, referral: !!referral, creditGrosz: 0 });
    await env.DB.prepare("UPDATE purchases SET credit_grosz = 0, amount_grosz = ? WHERE id = ?").bind(row.price.amountGrosz, purchaseId).run();
  }
  if (referral) {
    await env.DB.prepare("INSERT OR IGNORE INTO referral_events (purchase_id, referrer_id, referee_id) VALUES (?, ?, ?)").bind(purchaseId, referral.referrerId, userId).run();
  }

  try {
    // One code per checkout: founding uses FOUNDING100, otherwise a runtime single-use code for referral + credit.
    const off = row.price.referralDiscountGrosz + row.price.creditGrosz;
    const discountCode = row.founding ? foundingCode(env) : off > 0 ? await createDiscount(env, purchaseId, off) : undefined;
    const session = await createCheckoutSession(env, {
      purchaseId, discountCode, productId: productId(env, row.plan),
      returnUrl: `${env.APP_URL.replace(/\/$/, "")}${input.returnPath}${input.returnPath.includes("?") ? "&" : "?"}purchase=${purchaseId}`,
    });
    await env.DB.prepare("UPDATE purchases SET dodo_session_id = ?, dodo_discount_code = ? WHERE id = ?").bind(session.sessionId, discountCode ?? null, purchaseId).run();
    return { checkoutUrl: session.checkoutUrl, purchaseId, plan: row.plan, founding: row.founding, price: row.price };
  } catch (e) {
    await expirePurchase(env, purchaseId, "failed");
    await env.DB.prepare("DELETE FROM referral_events WHERE purchase_id = ? AND status = 'pending'").bind(purchaseId).run();
    throw e;
  }
}
