import type { Env } from "../server/env";

/* D1 claims and locks for the inbox watcher. Every "changes === 1" is the proof that this run owns the thing. */

export const LOCK_MS = 4 * 60_000;
export const STALE_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 3;

export type WatchRow = {
  account_id: string; message_id: string; status: "processing" | "done" | "skipped" | "failed"; attempts: number;
  received_at: number | null; claimed_at: number; done_at: number | null; called_at: number | null; call_sid: string | null;
  letter_doc_id: string | null; error: string | null;
};

const changed = (r: { meta?: { changes?: number } }) => r.meta?.changes === 1;

/** First sight of an account fixes its baseline: mail from before this instant is never processed. */
export async function ensureAccount(env: Env, accountId: string, since: number): Promise<{ since: number; last_run: number | null }> {
  await env.DB.prepare("INSERT OR IGNORE INTO watch_accounts (account_id, since, lock_until) VALUES (?, ?, 0)").bind(accountId, since).run();
  const row = await env.DB.prepare("SELECT since, last_run FROM watch_accounts WHERE account_id = ?").bind(accountId).first<{ since: number; last_run: number | null }>();
  return row ?? { since, last_run: null };
}

/** A reconnected mailbox moves the baseline forward, never back. */
export async function raiseBaseline(env: Env, accountId: string, since: number): Promise<void> {
  await env.DB.prepare("UPDATE watch_accounts SET since = ? WHERE account_id = ? AND since < ?").bind(since, accountId, since).run();
}

export async function lockAccount(env: Env, accountId: string, now: number): Promise<boolean> {
  return changed(await env.DB.prepare("UPDATE watch_accounts SET lock_until = ? WHERE account_id = ? AND lock_until < ?").bind(now + LOCK_MS, accountId, now).run());
}

export async function releaseAccount(env: Env, accountId: string, now: number): Promise<void> {
  await env.DB.prepare("UPDATE watch_accounts SET lock_until = 0, last_run = ? WHERE account_id = ?").bind(now, accountId).run();
}

/** Accounts to look at this tick: oldest last_run first (never-run first). */
export async function dueAccounts(env: Env, limit: number): Promise<{ account_id: string; connected_at: number }[]> {
  const r = await env.DB.prepare(
    "SELECT c.account_id AS account_id, c.connected_at AS connected_at FROM connection_accounts c LEFT JOIN watch_accounts w ON w.account_id = c.account_id WHERE c.category = 'mail' AND c.provider = 'gmail' ORDER BY COALESCE(w.last_run, 0) ASC LIMIT ?",
  ).bind(limit).all<{ account_id: string; connected_at: number }>();
  return r.results;
}

/** Ids already claimed and not retryable: they are skipped without a second Gmail request. */
export async function settledIds(env: Env, accountId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const marks = ids.map(() => "?").join(",");
  const r = await env.DB.prepare(`SELECT message_id FROM watch_messages WHERE account_id = ? AND message_id IN (${marks}) AND NOT (status = 'failed' AND attempts < ? AND called_at IS NULL)`)
    .bind(accountId, ...ids, MAX_ATTEMPTS).all<{ message_id: string }>();
  return new Set(r.results.map((x) => x.message_id));
}

/** Returns the attempt number when this run now owns the message, otherwise null. */
export async function claimMessage(env: Env, accountId: string, messageId: string, now: number): Promise<number | null> {
  const fresh = await env.DB.prepare("INSERT OR IGNORE INTO watch_messages (account_id, message_id, status, attempts, claimed_at) VALUES (?, ?, 'processing', 1, ?)").bind(accountId, messageId, now).run();
  if (changed(fresh)) return 1;
  const retry = await env.DB.prepare(
    "UPDATE watch_messages SET status = 'processing', attempts = attempts + 1, claimed_at = ?, error = NULL WHERE account_id = ? AND message_id = ? AND attempts < ? AND (status = 'failed' OR (status = 'processing' AND claimed_at < ?))",
  ).bind(now, accountId, messageId, MAX_ATTEMPTS, now - STALE_MS).run();
  if (!changed(retry)) return null;
  const row = await env.DB.prepare("SELECT attempts FROM watch_messages WHERE account_id = ? AND message_id = ?").bind(accountId, messageId).first<{ attempts: number }>();
  return row?.attempts ?? 2;
}

export async function finishMessage(env: Env, accountId: string, messageId: string, now: number, f: { status: "done" | "skipped" | "failed"; receivedAt?: number; letterDocId?: string | null; error?: string | null }): Promise<void> {
  await env.DB.prepare("UPDATE watch_messages SET status = ?, done_at = ?, received_at = COALESCE(?, received_at), letter_doc_id = COALESCE(?, letter_doc_id), error = ? WHERE account_id = ? AND message_id = ?")
    .bind(f.status, now, f.receivedAt ?? null, f.letterDocId ?? null, f.error ?? null, accountId, messageId).run();
}

/** The only gate to a phone call: succeeds once per message, however many ticks overlap or retry. */
export async function claimCall(env: Env, accountId: string, messageId: string, now: number): Promise<boolean> {
  return changed(await env.DB.prepare("UPDATE watch_messages SET called_at = ? WHERE account_id = ? AND message_id = ? AND called_at IS NULL").bind(now, accountId, messageId).run());
}

export async function recordCall(env: Env, accountId: string, messageId: string, f: { callSid?: string; error?: string }): Promise<void> {
  await env.DB.prepare("UPDATE watch_messages SET call_sid = COALESCE(?, call_sid), error = COALESCE(?, error) WHERE account_id = ? AND message_id = ?").bind(f.callSid ?? null, f.error ?? null, accountId, messageId).run();
}

export async function recentRows(env: Env, accountId: string, limit = 20): Promise<WatchRow[]> {
  const r = await env.DB.prepare("SELECT * FROM watch_messages WHERE account_id = ? ORDER BY claimed_at DESC LIMIT ?").bind(accountId, limit).all<WatchRow>();
  return r.results;
}

export async function accountStatus(env: Env, accountId: string) {
  return env.DB.prepare("SELECT since, lock_until, last_run FROM watch_accounts WHERE account_id = ?").bind(accountId).first<{ since: number; lock_until: number; last_run: number | null }>();
}
