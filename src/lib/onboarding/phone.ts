import { z } from "zod";
import type { Env } from "../server/env";

export const phoneInputSchema = z.object({ number: z.string().trim().max(32) }).strict();

/** Accepts "+48 512 345 678", "0048…" or a Polish 9-digit number; returns E.164 or null. */
export function normalisePhone(raw: string): string | null {
  let s = raw.replace(/[\s().-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^\d{9}$/.test(s)) s = `+48${s}`;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

type DemoEnv = Env & { DEMO_CALL_EMAILS?: string; DEMO_CALL_NUMBER?: string };

const canonical = (email: string) => email.trim().toLowerCase();

/**
 * Phone calls are live only for the demo account: its signed-in email is listed in DEMO_CALL_EMAILS and the
 * number equals DEMO_CALL_NUMBER (a Twilio-verified caller). Every other number is saved unverified.
 */
export async function demoCallsAllowed(env: Env, accountId: string, number: string): Promise<boolean> {
  const e = env as DemoEnv;
  const listed = (e.DEMO_CALL_EMAILS ?? "").split(/[\s,]+/).filter(Boolean).map(canonical);
  const demoNumber = e.DEMO_CALL_NUMBER ? normalisePhone(e.DEMO_CALL_NUMBER) : null;
  if (!listed.length || !demoNumber || demoNumber !== number) return false;
  const identity = await env.DB.prepare("SELECT email FROM email_identities WHERE user_id=? AND verified_at>0").bind(accountId).first<{ email: string }>();
  return !!identity && listed.includes(canonical(identity.email));
}
