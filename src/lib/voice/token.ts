import { z } from "zod";
import { b64url, fromBase64, hmacSha256, timingSafeEqual } from "../server/util";
import { VOICE_MODES } from "./protocol";

/** Short-lived ticket the authenticated /api/voice/session route issues for one WebSocket session. */
export const ticketSchema = z.object({
  /** Effective case user (the sample user while the sample case is active). */
  u: z.string().min(1).max(128),
  /** Session id: names the VoiceDO instance. */
  s: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  m: z.enum([...VOICE_MODES, "phone"]),
  /** User's spoken language. */
  l: z.string().min(2).max(8),
  /** Expiry, epoch ms. */
  e: z.number().int(),
  /** Phone mode: why we are calling. Welcome mode: the opening line to speak first. */
  r: z.string().max(1500).optional(),
});
export type Ticket = z.infer<typeof ticketSchema>;

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function signTicket(secret: string, t: Ticket): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(t)));
  const sig = b64url(await hmacSha256(secret, `voice:${body}`));
  return `${body}.${sig}`;
}

export async function verifyTicket(secret: string, token: string | null | undefined, now = Date.now()): Promise<Ticket | null> {
  if (!secret || !token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!timingSafeEqual(sig, b64url(await hmacSha256(secret, `voice:${body}`)))) return null;
  try {
    const t = ticketSchema.parse(JSON.parse(dec.decode(fromBase64(body))));
    return t.e > now ? t : null;
  } catch {
    return null;
  }
}
