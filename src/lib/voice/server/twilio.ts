/*
 * Outbound phone call through Twilio: the call's TwiML connects a Media Stream to /api/twilio/media/<ticket>, where
 * VoiceDO runs the caseworker in phone mode (μ-law 8 kHz both ways). Trial account: only verified numbers, so only the
 * demo accounts in DEMO_CALL_EMAILS are called, always at DEMO_CALL_NUMBER.
 */
import { caseClient } from "../../case/client";
import type { Env } from "../../server/env";
import { ApiError } from "../../server/http";
import { signTicket } from "../token";
import { sessionId, voiceLang } from "./issue";

type TwilioEnv = Env & { TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_FROM_NUMBER?: string; DEMO_CALL_NUMBER?: string; DEMO_CALL_EMAILS?: string };

/** Twilio allows ~10 minutes between placing the call and the stream connecting (ringing, trial message). */
const PHONE_TICKET_TTL_MS = 10 * 60_000;

export async function accountEmail(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT email FROM email_identities WHERE user_id = ?").bind(accountId).first<{ email: string }>();
  return row?.email?.toLowerCase() ?? null;
}

export function callsEnabledFor(env: Env, email: string | null): boolean {
  const list = String((env as TwilioEnv).DEMO_CALL_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return !!email && list.includes(email);
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Places the call. `userId` is the case to talk about; `reason` is what arrived. Returns the Twilio call SID. */
export async function placeCall(env: Env, args: { accountId: string; userId: string; reason: string }): Promise<{ callSid: string; to: string }> {
  const e = env as TwilioEnv;
  if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !e.TWILIO_FROM_NUMBER || !e.DEMO_CALL_NUMBER) {
    throw new ApiError(503, "Phone calls are not configured yet", "calls_unconfigured");
  }
  if (!callsEnabledFor(env, await accountEmail(env, args.accountId))) throw new ApiError(403, "Phone calls are coming soon", "calls_coming_soon");
  if (!env.SESSION_SECRET) throw new ApiError(503, "Voice sessions are not configured", "voice_unconfigured");
  let pref: string | null = null;
  try {
    pref = (await caseClient(args.userId).snapshot()).profile.preferredLanguage;
  } catch {
    /* default language */
  }
  const ticket = await signTicket(env.SESSION_SECRET, {
    u: args.userId, s: sessionId(), m: "phone", l: voiceLang(pref), e: Date.now() + PHONE_TICKET_TTL_MS, r: args.reason.slice(0, 1500),
  });
  const host = new URL(env.APP_URL).host;
  const twiml = `<Response><Connect><Stream url="wss://${xml(host)}/api/twilio/media/${xml(ticket)}" /></Connect></Response>`;
  const body = new URLSearchParams({ To: e.DEMO_CALL_NUMBER, From: e.TWILIO_FROM_NUMBER, Twiml: twiml, Timeout: "40" });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(e.TWILIO_ACCOUNT_SID)}/Calls.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number };
  if (!res.ok || !data.sid) throw new ApiError(502, "The phone call could not be placed", `twilio_${data.code ?? res.status}`);
  return { callSid: data.sid, to: `…${e.DEMO_CALL_NUMBER.slice(-2)}` };
}
