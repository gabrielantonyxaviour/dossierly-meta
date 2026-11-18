import { ApiError } from "../server/http";
import type { Env } from "../server/env";

export type InboundEnv = Env & { INBOUND_MAIL_DOMAIN?: string };
export const DEFAULT_DOMAIN = "in.larinova.com";
/** No 0/o/1/l/i: easy to read aloud or retype. 31^10 is about 8e14 combinations. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LOCAL = /^case-[a-z0-9]{10}$/;

export const domainOf = (env: InboundEnv) => (env.INBOUND_MAIL_DOMAIN?.trim().toLowerCase() || DEFAULT_DOMAIN);
export function generateLocalPart(): string {
  const bytes = new Uint8Array(10); crypto.getRandomValues(bytes);
  // 248 is the largest multiple of 31 under 256: bytes at or above it are skipped to keep the draw uniform.
  let s = ""; let i = 0;
  while (s.length < 10) {
    if (i >= bytes.length) { crypto.getRandomValues(bytes); i = 0; }
    if (bytes[i] < 248) s += ALPHABET[bytes[i] % 31]; i++;
  }
  return `case-${s}`;
}
export const addressOf = (env: InboundEnv, local: string) => `${local}@${domainOf(env)}`;

type Row = { local_part: string; created_at: number; rotated_at: number | null; confirm_code: string | null; confirm_link: string | null; confirm_at: number | null };
const view = (env: InboundEnv, r: Row) => ({
  address: addressOf(env, r.local_part), createdAt: r.created_at, rotatedAt: r.rotated_at,
  forwardingConfirmation: r.confirm_at && (r.confirm_code || r.confirm_link) ? { code: r.confirm_code, link: r.confirm_link, receivedAt: r.confirm_at } : null,
});
const select = (env: InboundEnv, accountId: string) => env.DB.prepare("SELECT local_part, created_at, rotated_at, confirm_code, confirm_link, confirm_at FROM inbound_addresses WHERE account_id = ?").bind(accountId).first<Row>();

/** Insert a fresh unique local part; the UNIQUE index decides collisions, never a read-then-write. */
async function insertUnique(env: InboundEnv, accountId: string, now: number): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const local = generateLocalPart();
    const taken = await env.DB.prepare("SELECT 1 AS x FROM inbound_retired WHERE local_part = ?").bind(local).first();
    if (taken) continue;
    const r = await env.DB.prepare("INSERT OR IGNORE INTO inbound_addresses (account_id, local_part, created_at) VALUES (?, ?, ?)").bind(accountId, local, now).run();
    if (r.meta?.changes === 1) return local;
    if (await select(env, accountId)) return (await select(env, accountId))!.local_part; // a parallel request created it
  }
  throw new ApiError(503, "Could not create a forwarding address. Try again.", "address_unavailable");
}

/** The account's forwarding address, created on first use. */
export async function getOrCreateAddress(env: InboundEnv, accountId: string, now = Date.now()) {
  const row = await select(env, accountId);
  if (row) return view(env, row);
  await insertUnique(env, accountId, now);
  return view(env, (await select(env, accountId))!);
}

/** Replace the address: the old one stops working at once and is never reissued. */
export async function rotateAddress(env: InboundEnv, accountId: string, now = Date.now()) {
  const old = await select(env, accountId);
  if (!old) return getOrCreateAddress(env, accountId, now);
  for (let i = 0; i < 5; i++) {
    const local = generateLocalPart();
    if (await env.DB.prepare("SELECT 1 AS x FROM inbound_retired WHERE local_part = ? UNION SELECT 1 FROM inbound_addresses WHERE local_part = ?").bind(local, local).first()) continue;
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO inbound_retired (local_part, account_id, retired_at) VALUES (?, ?, ?)").bind(old.local_part, accountId, now),
      env.DB.prepare("UPDATE inbound_addresses SET local_part = ?, rotated_at = ?, confirm_code = NULL, confirm_link = NULL, confirm_at = NULL WHERE account_id = ? AND local_part = ?").bind(local, now, accountId, old.local_part),
    ]);
    return view(env, (await select(env, accountId))!);
  }
  throw new ApiError(503, "Could not rotate the forwarding address. Try again.", "address_unavailable");
}

/** Recipient to account: only an exact live address on our domain maps; anything else (rotated, unknown, other domain) is null. */
export async function accountForRecipient(env: InboundEnv, recipient: string): Promise<string | null> {
  const [local, domain, ...rest] = recipient.trim().toLowerCase().replace(/^<|>$/g, "").split("@");
  if (!local || rest.length || domain !== domainOf(env) || !LOCAL.test(local)) return null;
  const row = await env.DB.prepare("SELECT account_id FROM inbound_addresses WHERE local_part = ?").bind(local).first<{ account_id: string }>();
  return row?.account_id ?? null;
}
