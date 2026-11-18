import type { Env } from "@/lib/server/env";
import { z } from "zod";
import { randomId } from "@/lib/server/util";
import { CURRENCY, PLANS, REFERRAL_GROSZ, addMonths, type PaidPlan } from "./plans";
import { addCredit, ensureReferralCode } from "./store";

const EventSchema = z.object({
  type: z.string(),
  data: z.object({
    payment_id: z.string().optional(),
    checkout_session_id: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    total_amount: z.union([z.number(), z.string()]).optional(),
    amount: z.union([z.number(), z.string()]).optional(),
    currency: z.string().optional(),
    status: z.string().optional(),
  }).passthrough(),
});
const num = (v: unknown): number | null => (v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export type DodoEvent = z.infer<typeof EventSchema>;
export const parseEvent = (raw: string): DodoEvent | null => {
  try {
    const r = EventSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
};

type Purchase = {
  id: string; user_id: string; plan: PaidPlan; amount_grosz: number; credit_grosz: number; status: string;
};

async function findPurchase(env: Env, d: DodoEvent["data"]): Promise<Purchase | null> {
  const cols = "id, user_id, plan, amount_grosz, credit_grosz, status";
  const meta = typeof d.metadata?.purchase_id === "string" ? d.metadata.purchase_id : null;
  if (meta) {
    const p = await env.DB.prepare(`SELECT ${cols} FROM purchases WHERE id = ?`).bind(meta).first<Purchase>();
    if (p) return p;
  }
  if (d.payment_id) {
    const p = await env.DB.prepare(`SELECT ${cols} FROM purchases WHERE dodo_payment_id = ?`).bind(d.payment_id).first<Purchase>();
    if (p) return p;
  }
  return d.checkout_session_id ? env.DB.prepare(`SELECT ${cols} FROM purchases WHERE dodo_session_id = ?`).bind(d.checkout_session_id).first<Purchase>() : null;
}

/** Entitlement starts now, or when the current grant of the same plan ends (renewal stacks). One per purchase. */
async function grantEntitlement(env: Env, p: Purchase, now: number): Promise<void> {
  const cfg = PLANS[p.plan];
  const last = await env.DB.prepare("SELECT MAX(expires_at) AS e FROM entitlements WHERE user_id = ? AND plan = ? AND revoked_at IS NULL AND expires_at > ?")
    .bind(p.user_id, p.plan, now).first<{ e: number | null }>();
  const start = p.plan === "household_year" && last?.e ? last.e : now;
  await env.DB.prepare("INSERT OR IGNORE INTO entitlements (id, user_id, purchase_id, plan, people_limit, starts_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(randomId("ent", 9), p.user_id, p.id, p.plan, cfg.people, start, addMonths(start, cfg.months)).run();
}

async function onPaymentSucceeded(env: Env, d: DodoEvent["data"], now: number): Promise<string> {
  const p = await findPurchase(env, d);
  if (!p) return "unknown_purchase";
  if (p.status === "refunded") return "already_refunded";
  if (d.currency && d.currency !== CURRENCY) return "wrong_currency";
  const paid = num(d.total_amount);
  if (paid !== null && paid < p.amount_grosz) return "underpaid";
  const wasExpired = p.status === "expired";
  const moved = await env.DB.prepare("UPDATE purchases SET status = 'succeeded', paid_at = ?, dodo_payment_id = COALESCE(dodo_payment_id, ?) WHERE id = ? AND status IN ('pending','expired','failed')")
    .bind(now, d.payment_id ?? null, p.id).run();
  if (!moved.meta?.changes && p.status !== "succeeded") return "ignored";
  await grantEntitlement(env, p, now);
  await ensureReferralCode(env, p.user_id);
  // A purchase that expired and got its credit back but was paid anyway must pay that credit again.
  if (wasExpired && p.credit_grosz > 0) await addCredit(env, p.user_id, -p.credit_grosz, "clawback", p.id);
  const ref = await env.DB.prepare("SELECT referrer_id FROM referral_events WHERE purchase_id = ? AND status = 'pending'").bind(p.id).first<{ referrer_id: string }>();
  if (ref) {
    await addCredit(env, ref.referrer_id, REFERRAL_GROSZ, "referral_reward", p.id);
    await env.DB.prepare("UPDATE referral_events SET status = 'granted' WHERE purchase_id = ?").bind(p.id).run();
  }
  return "granted";
}

/** A full refund (or a lost dispute) revokes the entitlement and the referrer's reward. Partial refunds change nothing. */
async function onRevoked(env: Env, d: DodoEvent["data"], now: number): Promise<string> {
  const p = await findPurchase(env, d);
  if (!p) return "unknown_purchase";
  const refunded = num(d.amount);
  if (refunded !== null && refunded < p.amount_grosz) return "partial_refund_ignored";
  await env.DB.prepare("UPDATE purchases SET status = 'refunded', refunded_at = ? WHERE id = ? AND status = 'succeeded'").bind(now, p.id).run();
  await env.DB.prepare("UPDATE entitlements SET revoked_at = ? WHERE purchase_id = ? AND revoked_at IS NULL").bind(now, p.id).run();
  const ref = await env.DB.prepare("SELECT referrer_id, status FROM referral_events WHERE purchase_id = ?").bind(p.id).first<{ referrer_id: string; status: string }>();
  if (ref && ref.status !== "revoked") {
    if (ref.status === "granted") await addCredit(env, ref.referrer_id, -REFERRAL_GROSZ, "clawback", p.id);
    await env.DB.prepare("UPDATE referral_events SET status = 'revoked' WHERE purchase_id = ?").bind(p.id).run();
  }
  return "revoked";
}

export type WebhookResult = { status: 200 | 500; outcome: string };

/** Idempotent on the webhook-id: the id is logged first and un-logged if processing throws so Dodo's retry re-runs it. */
export async function processWebhook(env: Env, webhookId: string, event: DodoEvent, now = Date.now()): Promise<WebhookResult> {
  const first = await env.DB.prepare("INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?, ?, ?)").bind(webhookId, event.type, now).run();
  if (!first.meta?.changes) return { status: 200, outcome: "duplicate" };
  try {
    const outcome =
      event.type === "payment.succeeded" ? await onPaymentSucceeded(env, event.data, now)
      : event.type === "refund.succeeded" || event.type === "dispute.lost" ? await onRevoked(env, event.data, now)
      : "ignored";
    await env.DB.prepare("UPDATE webhook_events SET outcome = ? WHERE id = ?").bind(outcome, webhookId).run();
    return { status: 200, outcome };
  } catch {
    await env.DB.prepare("DELETE FROM webhook_events WHERE id = ?").bind(webhookId).run();
    return { status: 500, outcome: "error" };
  }
}
