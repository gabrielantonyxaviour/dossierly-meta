/*
 * Outbound phone call through Twilio: the call's TwiML connects a Media Stream to /api/twilio/media/<ticket>, where
 * VoiceDO runs the caseworker in phone mode (μ-law 8 kHz both ways). Trial account: only verified numbers, so only the
 * demo accounts in DEMO_CALL_EMAILS are called, always at DEMO_CALL_NUMBER.
 */
import { caseClient } from "../../case/client";
import { dayLabel } from "../../case/context";
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

/**
 * Places the call. `userId` is the case to talk about; `reason` is what arrived. Returns the Twilio call SID.
 * Both legs are recorded (dual channel: the user and Dossierly); fetch with scripts/twilio-recording.sh.
 */
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
  const body = new URLSearchParams({ To: e.DEMO_CALL_NUMBER, From: e.TWILIO_FROM_NUMBER, Twiml: twiml, Timeout: "40", Record: "true", RecordingChannels: "dual" });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(e.TWILIO_ACCOUNT_SID)}/Calls.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; code?: number };
  if (!res.ok || !data.sid) throw new ApiError(502, "The phone call could not be placed", `twilio_${data.code ?? res.status}`);
  return { callSid: data.sid, to: `…${e.DEMO_CALL_NUMBER.slice(-2)}` };
}

export interface NewLetter {
  title: string;
  sender: string;
  /** What the letter asks for, in plain words. */
  asks: string;
  /** YYYY-MM-DD */
  dueDate: string;
  deadlineId?: string;
  letterDocId?: string;
  draftIds?: string[];
  /** What Dossierly already prepared, e.g. "Request to your dean's office for a certificate of enrolment (draft)". */
  prepared: string[];
}

const tomorrow = (now = new Date()) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(now);
  return new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
};

/** The REASON the phone agent works from when a new official letter arrives (pure, for tests). */
export function letterReason(l: NewLetter, now = new Date()): string {
  const ref = (id?: string) => (id ? ` (#${id})` : "");
  return [
    `A new letter just arrived in their case and you have read it: "${l.title}" from ${l.sender}${ref(l.letterDocId)}.`,
    `It asks for: ${l.asks}. Deadline: ${dayLabel(l.dueDate)}${ref(l.deadlineId)}.`,
    l.prepared.length ? `Already prepared for them: ${l.prepared.join("; ")}${l.draftIds?.length ? ` (${l.draftIds.map((d) => `#${d}`).join(" ")})` : ""}.` : "Nothing is prepared yet.",
    l.deadlineId ? `Offer a reminder tomorrow at nine (${dayLabel(tomorrow(now))}, 09:00 Warsaw). When they agree, confirm it with REMIND: ${l.deadlineId} | ${tomorrow(now)} 09:00.` : "",
  ].filter(Boolean).join("\n");
}

/** The 24/7 inbox runtime's trigger: a new official letter with a deadline arrived for a demo account → Dossierly calls. */
export async function callAboutLetter(env: Env, args: { accountId: string; userId: string; letter: NewLetter }): Promise<{ callSid: string; to: string }> {
  return placeCall(env, { accountId: args.accountId, userId: args.userId, reason: letterReason(args.letter) });
}
