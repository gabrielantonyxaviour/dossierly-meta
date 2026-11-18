import { z } from "zod";
import { PLANS, addMonths } from "@/lib/billing/plans";
import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { randomId } from "@/lib/server/util";
import { writeAudit } from "./audit";

export type GrantKind = "one_case" | "household_year" | "discount_percent";
export type Entry = {
  id: string; email: string; grant: { kind: GrantKind; value?: number };
  grantExpiresAt: string | null; entryExpiresAt: string | null; note: string; createdBy: string; createdAt: string;
  usedAt: string | null; usedByAccount: string | null;
};

const isoDate = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "invalid date").transform((v) => Date.parse(v));

export const whitelistInput = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  grant: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("one_case") }),
    z.object({ kind: z.literal("household_year") }),
    z.object({ kind: z.literal("discount_percent"), value: z.number().int().min(1).max(99) }),
  ]),
  grantExpiresAt: isoDate.nullish(),
  entryExpiresAt: isoDate.nullish(),
  note: z.string().trim().max(300).default(""),
}).strict();
export const idInput = z.object({ id: z.string().min(3).max(60) }).strict();

type Row = {
  id: string; email: string; grant_kind: GrantKind; grant_value: number | null; grant_expires_at: number | null; entry_expires_at: number | null;
  note: string; created_by: string; created_at: number; used_at: number | null; used_by_account: string | null;
};
const iso = (v: number | null) => (v === null ? null : new Date(v).toISOString());
const toEntry = (r: Row): Entry => ({
  id: r.id, email: r.email, grant: r.grant_value === null ? { kind: r.grant_kind } : { kind: r.grant_kind, value: r.grant_value },
  grantExpiresAt: iso(r.grant_expires_at), entryExpiresAt: iso(r.entry_expires_at), note: r.note, createdBy: r.created_by,
  createdAt: new Date(r.created_at).toISOString(), usedAt: iso(r.used_at), usedByAccount: r.used_by_account,
});

export async function listWhitelist(env: Env): Promise<Entry[]> {
  const { results } = await env.DB.prepare("SELECT * FROM email_whitelist ORDER BY created_at DESC, rowid DESC").all<Row>();
  return results.map(toEntry);
}

export async function addWhitelist(env: Env, actor: string, input: z.infer<typeof whitelistInput>, now = Date.now()): Promise<Entry> {
  const exp = [input.grantExpiresAt, input.entryExpiresAt];
  if (exp.some((v) => typeof v === "number" && v <= now)) throw new ApiError(400, "Expiry dates must be in the future", "invalid_expiry");
  const id = randomId("wl", 10);
  const value = input.grant.kind === "discount_percent" ? input.grant.value : null;
  const r = await env.DB.prepare(
    "INSERT OR IGNORE INTO email_whitelist (id, email, grant_kind, grant_value, grant_expires_at, entry_expires_at, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, input.email, input.grant.kind, value, input.grantExpiresAt ?? null, input.entryExpiresAt ?? null, input.note, actor, now).run();
  if (!r.meta?.changes) throw new ApiError(409, "That email is already on the whitelist. Remove it first to change it.", "whitelist_exists");
  await writeAudit(env, actor, "whitelist.add", input.email, `${input.grant.kind}${value ? ` ${value}%` : ""}`, now);
  const row = await env.DB.prepare("SELECT * FROM email_whitelist WHERE id = ?").bind(id).first<Row>();
  return toEntry(row as Row);
}

export async function removeWhitelist(env: Env, actor: string, id: string): Promise<void> {
  const row = await env.DB.prepare("SELECT email FROM email_whitelist WHERE id = ?").bind(id).first<{ email: string }>();
  if (!row) throw new ApiError(404, "No such whitelist entry", "not_found");
  await env.DB.prepare("DELETE FROM email_whitelist WHERE id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM account_discounts WHERE entry_id = ? AND applied_purchase_id IS NULL").bind(id).run();
  await writeAudit(env, actor, "whitelist.remove", row.email, "");
}

/**
 * Called once the sign-in email is verified (sign-up and sign-in alike). The entry is matched on the exact lowercased
 * address (so `a+x@d` and `a@d` are different entries), claimed atomically, and applied once: a plan grant becomes an
 * entitlement with source `whitelist`; a percent grant becomes a pending discount that the next checkout applies.
 */
export async function applyWhitelist(env: Env, accountId: string, email: string, now = Date.now()): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const row = await env.DB.prepare("SELECT * FROM email_whitelist WHERE email = ? AND used_at IS NULL AND (entry_expires_at IS NULL OR entry_expires_at > ?)")
    .bind(e, now).first<Row>();
  if (!row) return false;
  if (row.grant_expires_at !== null && row.grant_expires_at <= now) return false;
  const claimed = await env.DB.prepare("UPDATE email_whitelist SET used_at = ?, used_by_account = ? WHERE id = ? AND used_at IS NULL").bind(now, accountId, row.id).run();
  if (!claimed.meta?.changes) return false;
  if (row.grant_kind === "discount_percent") {
    await env.DB.prepare("INSERT OR IGNORE INTO account_discounts (id, account_id, entry_id, percent, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(randomId("ad", 9), accountId, row.id, row.grant_value ?? 0, row.grant_expires_at, now).run();
    await writeAudit(env, "system", "whitelist.used", e, `discount ${row.grant_value}% pending for next checkout (account ${accountId})`, now);
    return true;
  }
  const cfg = PLANS[row.grant_kind];
  await env.DB.prepare("INSERT OR IGNORE INTO entitlements (id, user_id, purchase_id, plan, people_limit, starts_at, expires_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'whitelist')")
    .bind(randomId("ent", 9), accountId, `wl_${row.id}`, row.grant_kind, cfg.people, now, row.grant_expires_at ?? addMonths(now, cfg.months)).run();
  await writeAudit(env, "system", "whitelist.used", e, `${row.grant_kind} granted to account ${accountId}`, now);
  return true;
}
