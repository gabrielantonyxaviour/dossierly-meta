import { z } from "zod";
import { dodo, foundingCode, productId } from "@/lib/billing/dodo";
import { type PaidPlan } from "@/lib/billing/plans";
import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { randomId } from "@/lib/server/util";
import { writeAudit } from "./audit";

export type Promo = {
  id: string; code: string; kind: "percent"; percent: number; plans: PaidPlan[]; maxUses: number | null; perCustomer: number;
  startsAt: string | null; expiresAt: string | null; note: string; uses: number; dodoDiscountId: string | null;
  createdBy: string; createdAt: string; active: boolean;
};

const isoDate = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "invalid date").transform((v) => Date.parse(v));

export const promoInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,24}$/),
  percent: z.number().int().min(1).max(100),
  plans: z.array(z.enum(["one_case", "household_year"])).min(1).max(2).transform((p) => [...new Set(p)]),
  maxUses: z.number().int().min(1).max(1_000_000).nullish(),
  perCustomer: z.number().int().min(1).max(100).default(1),
  startsAt: isoDate.nullish(),
  expiresAt: isoDate.nullish(),
  note: z.string().trim().max(300).default(""),
}).strict().refine((v) => !v.startsAt || !v.expiresAt || v.startsAt < v.expiresAt, "startsAt must be before expiresAt");

type Row = {
  id: string; code: string; percent: number; plans: string; max_uses: number | null; per_customer: number; starts_at: number | null;
  expires_at: number | null; note: string; dodo_discount_id: string | null; created_by: string; created_at: number; disabled_at: number | null; uses: number;
};
const iso = (v: number | null) => (v === null ? null : new Date(v).toISOString());
/** `uses` = purchases that paid (or were later refunded) with this code; counted from the webhook-confirmed purchase. */
const SELECT = "SELECT p.*, (SELECT COUNT(*) FROM purchases x WHERE x.promo_id = p.id AND x.status IN ('succeeded','refunded')) AS uses FROM promo_codes p";

function toPromo(r: Row, now: number): Promo {
  const used = r.max_uses !== null && r.uses >= r.max_uses;
  return {
    id: r.id, code: r.code, kind: "percent", percent: r.percent, plans: JSON.parse(r.plans) as PaidPlan[], maxUses: r.max_uses, perCustomer: r.per_customer,
    startsAt: iso(r.starts_at), expiresAt: iso(r.expires_at), note: r.note, uses: r.uses, dodoDiscountId: r.dodo_discount_id,
    createdBy: r.created_by, createdAt: new Date(r.created_at).toISOString(),
    active: r.disabled_at === null && !used && (r.expires_at === null || r.expires_at > now),
  };
}

export async function listPromos(env: Env, now = Date.now()): Promise<Promo[]> {
  const { results } = await env.DB.prepare(`${SELECT} ORDER BY p.created_at DESC, p.rowid DESC`).all<Row>();
  return results.map((r) => toPromo(r, now));
}

async function getPromo(env: Env, id: string, now = Date.now()): Promise<Promo> {
  const r = await env.DB.prepare(`${SELECT} WHERE p.id = ?`).bind(id).first<Row>();
  if (!r) throw new ApiError(404, "No such promo", "not_found");
  return toPromo(r, now);
}

export async function createPromo(env: Env, actor: string, input: z.infer<typeof promoInput>, now = Date.now()): Promise<Promo> {
  if (input.code === foundingCode(env) || input.code.startsWith("DSR")) throw new ApiError(400, "That code is reserved", "promo_reserved");
  if (input.expiresAt && input.expiresAt <= now) throw new ApiError(400, "Expiry must be in the future", "invalid_expiry");
  if (await env.DB.prepare("SELECT 1 AS x FROM promo_codes WHERE code = ?").bind(input.code).first()) {
    throw new ApiError(409, "A promo with that code already exists", "promo_exists");
  }
  const id = randomId("pr", 10);
  let dodoId: string;
  try {
    const out = await dodo<{ discount_id: string }>(env, "/discounts", {
      type: "percentage", amount: input.percent * 100, code: input.code, name: `Dossierly promo ${input.code}`,
      restricted_to: input.plans.map((p) => productId(env, p)),
      ...(input.maxUses ? { usage_limit: input.maxUses } : {}),
      ...(input.perCustomer && (!input.maxUses || input.perCustomer <= input.maxUses) ? { per_customer_usage_limit: input.perCustomer } : {}),
      ...(input.startsAt ? { starts_at: new Date(input.startsAt).toISOString() } : {}),
      ...(input.expiresAt ? { expires_at: new Date(input.expiresAt).toISOString() } : {}),
      metadata: { promo_id: id, app: "dossierly" },
    });
    dodoId = out.discount_id;
  } catch {
    throw new ApiError(502, "The payment provider did not create the discount. Nothing was saved.", "dodo_failed");
  }
  try {
    await env.DB.prepare(
      "INSERT INTO promo_codes (id, code, percent, plans, max_uses, per_customer, starts_at, expires_at, note, dodo_discount_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, input.code, input.percent, JSON.stringify(input.plans), input.maxUses ?? null, input.perCustomer, input.startsAt ?? null, input.expiresAt ?? null, input.note, dodoId, actor, now).run();
  } catch {
    await dodo(env, `/discounts/${dodoId}`, null, "DELETE").catch(() => undefined);
    throw new ApiError(409, "A promo with that code already exists", "promo_exists");
  }
  await writeAudit(env, actor, "promo.add", input.code, `${input.percent}% off ${input.plans.join(", ")}`, now);
  return getPromo(env, id, now);
}

export async function disablePromo(env: Env, actor: string, id: string, now = Date.now()): Promise<Promo> {
  const p = await getPromo(env, id, now);
  const row = await env.DB.prepare("SELECT disabled_at, dodo_discount_id FROM promo_codes WHERE id = ?").bind(id).first<{ disabled_at: number | null; dodo_discount_id: string | null }>();
  if (!row || row.disabled_at !== null) return p;
  if (row.dodo_discount_id) {
    try { await dodo(env, `/discounts/${row.dodo_discount_id}`, null, "DELETE"); }
    catch { throw new ApiError(502, "The payment provider did not remove the discount. The promo is still active.", "dodo_failed"); }
  }
  await env.DB.prepare("UPDATE promo_codes SET disabled_at = ? WHERE id = ?").bind(now, id).run();
  await writeAudit(env, actor, "promo.disable", p.code, "", now);
  return getPromo(env, id, now);
}

export type ResolvedPromo = { id: string; code: string; percent: number };

/** Validates a typed promo code for one buyer and plan. Throws promo_invalid | promo_expired | promo_used_up | promo_not_for_plan. */
export async function resolvePromo(env: Env, userId: string, raw: string, plan: PaidPlan, now = Date.now()): Promise<ResolvedPromo> {
  const code = raw.trim().toUpperCase();
  const r = await env.DB.prepare(`${SELECT} WHERE p.code = ?`).bind(code).first<Row>();
  if (!r || r.disabled_at !== null || (r.starts_at !== null && r.starts_at > now)) throw new ApiError(400, "That promo code is not valid", "promo_invalid");
  if (r.expires_at !== null && r.expires_at <= now) throw new ApiError(400, "That promo code has expired", "promo_expired");
  if (!(JSON.parse(r.plans) as string[]).includes(plan)) throw new ApiError(400, "That promo code is not for this plan", "promo_not_for_plan");
  // Other buyers' unpaid reservations hold a use for 24h; this buyer's own pending checkouts are superseded by a new one.
  const held = await env.DB.prepare("SELECT COUNT(*) AS n FROM purchases WHERE promo_id = ? AND user_id <> ? AND status = 'pending' AND reserved_until > ?").bind(r.id, userId, now).first<{ n: number }>();
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM purchases WHERE promo_id = ? AND user_id = ? AND status IN ('succeeded','refunded')").bind(r.id, userId).first<{ n: number }>();
  if ((r.max_uses !== null && r.uses + (held?.n ?? 0) >= r.max_uses) || (mine?.n ?? 0) >= r.per_customer) {
    throw new ApiError(400, "That promo code has been used up", "promo_used_up");
  }
  return { id: r.id, code: r.code, percent: r.percent };
}

/** Called when a promo purchase is confirmed paid: writes the audit row (the `uses` count is derived from the paid purchase). */
export async function recordPromoUse(env: Env, purchaseId: string, now = Date.now()): Promise<void> {
  const r = await env.DB.prepare("SELECT p.code, x.user_id, x.plan FROM purchases x JOIN promo_codes p ON p.id = x.promo_id WHERE x.id = ?").bind(purchaseId).first<{ code: string; user_id: string; plan: string }>();
  if (r) await writeAudit(env, "system", "promo.used", r.code, `${r.plan} bought by account ${r.user_id} (purchase ${purchaseId})`, now);
}
