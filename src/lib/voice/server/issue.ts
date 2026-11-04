/* Mints session tickets for authenticated callers (Next route handlers). */
import { caseClient } from "../../case/client";
import type { Env } from "../../server/env";
import { ApiError } from "../../server/http";
import { VOICE_LANGS, type VoiceMode } from "../protocol";
import { signTicket } from "../token";

const TICKET_TTL_MS = 2 * 60_000;

export function voiceLang(pref: string | null | undefined, requested?: string): string {
  const ok = (l?: string | null) => !!l && ((VOICE_LANGS as readonly string[]).includes(l) || l === "pl");
  if (ok(requested)) return requested!;
  if (ok(pref)) return pref!;
  return "en";
}

export function sessionId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function issueBrowserTicket(env: Env, userId: string, mode: VoiceMode, opts: { lang?: string; script?: string }) {
  if (!env.SESSION_SECRET) throw new ApiError(503, "Voice sessions are not configured", "voice_unconfigured");
  if (!(env as unknown as Record<string, unknown>).ELEVENLABS_API_KEY) throw new ApiError(503, "Speech output is not configured", "tts_unconfigured");
  let pref: string | null = null;
  try {
    pref = (await caseClient(userId).snapshot()).profile.preferredLanguage;
  } catch {
    /* default language */
  }
  const s = sessionId();
  const lang = voiceLang(pref, opts.lang);
  const ticket = await signTicket(env.SESSION_SECRET, { u: userId, s, m: mode, l: lang, e: Date.now() + TICKET_TTL_MS, ...(opts.script ? { r: opts.script } : {}) });
  return { sessionId: s, lang, path: `/api/voice/ws/${s}?t=${encodeURIComponent(ticket)}` };
}
