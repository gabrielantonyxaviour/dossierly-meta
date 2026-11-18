import type { Env } from "@/lib/server/env";
import { randomId } from "@/lib/server/util";
import { FOUNDING_CAP, RENEWAL_WINDOW_DAYS, type PaidPlan } from "./plans";

export type Active = { plan: PaidPlan; expiresAt: number; peopleLimit: number };

/** The best live entitlement: household beats one case; expiry is the latest end among that plan's grants. */
export async function activeEntitlement(env: Env, userId: string, now = Date.now()): Promise<Active | null> {
  const row = await env.DB.prepare(
    `SELECT plan, people_limit, (SELECT MAX(expires_at) FROM entitlements e2 WHERE e2.user_id = e.user_id AND e2.plan = e.plan AND e2.revoked_at IS NULL) AS last_end
     FROM entitlements e WHERE user_id = ? AND revoked_at IS NULL AND starts_at <= ? AND expires_at > ?
     ORDER BY (plan = 'household_year') DESC, expires_at DESC LIMIT 1`,
  ).bind(userId, now, now).first<{ plan: PaidPlan; people_limit: number; last_end: number }>();
  return row ? { plan: row.plan, expiresAt: row.last_end, peopleLimit: row.people_limit } : null;
}

/** Legacy rows written before billing existed: an unexpired `case_pass` counts as One case. */
export async function legacyPass(env: Env, userId: string, now = Date.now()): Promise<Active | null> {
  const row = await env.DB.prepare("SELECT plan_expires_at FROM users WHERE id = ? AND plan_kind = 'case_pass'").bind(userId).first<{ plan_expires_at: number | null }>();
  return row && (row.plan_expires_at === null || row.plan_expires_at > now)
    ? { plan: "one_case", expiresAt: row.plan_expires_at ?? Number.MAX_SAFE_INTEGER, peopleLimit: 1 }
    : null;
}

export async function creditBalance(env: Env, userId: string): Promise<number> {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(delta_grosz), 0) AS n FROM credit_ledger WHERE user_id = ?").bind(userId).first<{ n: number }>();
  return Math.max(0, r?.n ?? 0);
}

/** Seats held by paid, refunded or still-reserved founding purchases. Refunds keep their seat: the cap is a hard cap. */
export async function foundingClaimed(env: Env, now = Date.now()): Promise<number> {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM purchases WHERE founding = 1 AND (status IN ('succeeded','refunded') OR (status = 'pending' AND reserved_until > ?))",
  ).bind(now).first<{ n: number }>();
  return r?.n ?? 0;
}

export const foundingSeatsLeft = async (env: Env, now = Date.now()) => Math.max(0, FOUNDING_CAP - (await foundingClaimed(env, now)));

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return `DOSS-${Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join("")}`;
}

export async function referralCodeOf(env: Env, userId: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT code FROM referral_codes WHERE user_id = ?").bind(userId).first<{ code: string }>();
  return r?.code ?? null;
}

/** Every paying user gets one code, created when their first payment succeeds. */
export async function ensureReferralCode(env: Env, userId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const existing = await referralCodeOf(env, userId);
    if (existing) return existing;
    await env.DB.prepare("INSERT OR IGNORE INTO referral_codes (code, user_id, created_at) VALUES (?, ?, ?)").bind(newCode(), userId, Date.now()).run();
  }
  const final = await referralCodeOf(env, userId);
  if (!final) throw new Error("referral code allocation failed");
  return final;
}

export async function addCredit(env: Env, userId: string, delta: number, reason: "referral_reward" | "spend" | "restore" | "clawback", purchaseId: string): Promise<void> {
  await env.DB.prepare("INSERT OR IGNORE INTO credit_ledger (id, user_id, delta_grosz, reason, purchase_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(randomId("cl", 9), userId, delta, reason, purchaseId, Date.now()).run();
}

export const renewalDue = (a: Active | null, now = Date.now()): boolean =>
  !!a && a.plan === "household_year" && a.expiresAt - now <= RENEWAL_WINDOW_DAYS * 86_400_000;
