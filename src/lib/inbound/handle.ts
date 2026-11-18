import { callsEnabledFor, accountEmail } from "../voice/server/twilio";
import type { ConnectionsEnv } from "../server/connections/types";
import type { MessageBody } from "../onboarding/inbox";
import { defaultDeps } from "../watch/tick";
import { processMessage } from "../watch/process";
import type { Deps } from "../watch/types";
import { accountForRecipient, type InboundEnv } from "./address";
import { parseInbound } from "./parse";

export const MAX_RAW_BYTES = 20 * 1024 * 1024;
/** The slice of Cloudflare's ForwardableEmailMessage the handler uses. */
export type InboundMessage = { to: string; from: string; raw: ReadableStream<Uint8Array>; rawSize: number; setReject(reason: string): void };
export type InboundResult = { status: "rejected" | "confirmation" | "processed" | "duplicate" | "failed"; reason?: string };
type Env = ConnectionsEnv & InboundEnv;
const blobKey = (accountId: string, key: string) => `inbound/${accountId}/${key}.json`;

/** Read at most MAX_RAW_BYTES; a message that lies about its size is cut off and rejected. */
async function readRaw(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer | null> {
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let n = 0;
  for (;;) {
    const part = await reader.read(); if (part.done) break;
    n += part.value.byteLength;
    if (n > MAX_RAW_BYTES) { await reader.cancel(); return null; }
    chunks.push(part.value);
  }
  const out = new Uint8Array(n); let i = 0; for (const c of chunks) { out.set(c, i); i += c.byteLength; }
  return out.buffer;
}

async function run(env: Env, deps: Deps, accountId: string, body: MessageBody) {
  const email = await accountEmail(env, accountId).catch(() => null);
  const ctx = { accountId, userId: accountId, since: 0, demo: callsEnabledFor(env, email), email };
  return processMessage(env, { ...deps, read: async () => body }, ctx, body.id);
}

/** Cloudflare Email Worker entry: map recipient to user, bound the size, parse, then use the watcher's own processing path. */
export async function handleInbound(env: Env, msg: InboundMessage, deps: Deps = defaultDeps): Promise<InboundResult> {
  const reject = (reason: string): InboundResult => { msg.setReject(reason); return { status: "rejected", reason }; };
  if (msg.rawSize > MAX_RAW_BYTES) return reject("Message too large (20 MB limit).");
  const accountId = await accountForRecipient(env, msg.to);
  if (!accountId) return reject("Unknown recipient.");
  const raw = await readRaw(msg.raw);
  if (!raw) return reject("Message too large (20 MB limit).");
  let parsed;
  try { parsed = await parseInbound(raw, Date.now()); } catch { return reject("Could not read this message."); }
  if (parsed.confirmation) {
    await env.DB.prepare("UPDATE inbound_addresses SET confirm_code = ?, confirm_link = ?, confirm_at = ? WHERE account_id = ?").bind(parsed.confirmation.code, parsed.confirmation.link, Date.now(), accountId).run();
    return { status: "confirmation" };
  }
  // Kept so a failed run can be retried by the watcher tick: an email cannot be re-delivered.
  await env.BLOBS.put(blobKey(accountId, parsed.key), JSON.stringify(parsed.body)).catch(() => undefined);
  try {
    const item = await run(env, deps, accountId, parsed.body);
    return item ? (item.error ? { status: "failed", reason: item.error } : { status: "processed" }) : { status: "duplicate" };
  } catch { return { status: "failed", reason: "internal" }; }
}

/** Re-run inbound messages whose processing failed (model outage, over budget); bounded per tick. The claim keeps it to MAX_ATTEMPTS. */
export async function retryInbound(env: Env, deps: Deps = defaultDeps, limit = 3): Promise<number> {
  const rows = await env.DB.prepare("SELECT account_id, message_id FROM watch_messages WHERE message_id LIKE 'inb_%' AND status = 'failed' AND attempts < 3 AND called_at IS NULL ORDER BY claimed_at ASC LIMIT ?").bind(limit).all<{ account_id: string; message_id: string }>();
  let n = 0;
  for (const r of rows.results) {
    const blob = await env.BLOBS.get(blobKey(r.account_id, r.message_id)).catch(() => null);
    if (!blob) continue;
    try { await run(env, deps, r.account_id, JSON.parse(new TextDecoder().decode(await blob.arrayBuffer())) as MessageBody); n++; } catch { /* stays failed until attempts run out */ }
  }
  return n;
}
