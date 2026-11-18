import { z } from "zod";
import type { Env } from "./env";
import { ApiError } from "./http";
import { accountFromCookie, sessionCookie } from "./session";
import { emailAccount } from "./email-accounts";
import { applyWhitelist } from "@/lib/admin/whitelist";
import { requireEmailDelivery, sendEmailCode, type SendCode } from "./email-delivery";
import { rateLimit } from "./ratelimit";
import { bytesToHex, hmacSha256, randomId, sha256Hex, timingSafeEqual } from "./util";

export const EMAIL_TTL = 600;
export const EMAIL_COOKIE = "dossierly_email_challenge";
export const emailRequestSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) }).strict();
export const emailVerifySchema = z.object({ challengeId: z.string().regex(/^ec_[A-Za-z0-9_-]{27}$/), code: z.string().regex(/^\d{6}$/) }).strict();
type Challenge = { id: string; email: string; code_hash: string; browser_hash: string; attach_user_id: string | null; attempts: number; expires_at: number; consumed_at: number | null };

const unavailable = () => new ApiError(503, "Email sign-in is temporarily unavailable. Please try again later.", "email_unavailable");
const invalid = () => new ApiError(400, "That code did not work. Check it and try again.", "invalid_code");
const expired = () => new ApiError(400, "That code has expired. Request a new code.", "expired_code");
const locked = () => new ApiError(429, "Too many incorrect codes. Request a new code.", "too_many_attempts");

function code() {
  // Rejection sampling avoids modulo bias in the six-digit secret.
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4_294_000_000);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

const digest = async (env: Env, id: string, value: string) => bytesToHex(await hmacSha256(env.SESSION_SECRET, `email-code:${id}:${value}`));
export function challengeCookie(env: Env, value: string, age = EMAIL_TTL) {
  return `${EMAIL_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${env.APP_ENV === "local" ? "" : "; Secure"}`;
}

export function checkEmailOrigin(req: Request, env: Env) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  // Next's local server normalizes req.url to localhost; the browser may use 127.0.0.1.
  const local = req.headers.get("host") ? `${url.protocol}//${req.headers.get("host")}` : url.origin;
  const expected = env.APP_ENV === "local" ? local : new URL(env.APP_URL || req.url).origin;
  if (origin !== expected) throw new ApiError(403, "Reload this page and try again.", "invalid_origin");
}

export async function requestEmailCode(env: Env, req: Request, input: unknown, send?: SendCode, now = Date.now()) {
  const { email } = emailRequestSchema.parse(input);
  if (!env.SESSION_SECRET) throw unavailable();
  if (!send) requireEmailDelivery(env);
  const emailKey = bytesToHex(await hmacSha256(env.SESSION_SECRET, `email-limit:${email}`));
  for (const [bucket, limit, seconds] of [["minute", 1, 60], ["hour", 5, 3600]] as const) {
    if (!(await rateLimit(env, `email:${emailKey}`, bucket, limit, seconds)).ok) {
      throw new ApiError(429, "Please wait before requesting another code.", "rate_limited");
    }
  }
  const id = randomId("ec", 20), secret = randomId("browser", 24), otp = code();
  const current = await accountFromCookie(req.headers.get("cookie"), env);
  const attachId = current && current.accountKind !== "email" ? current.accountId : null;
  // Expired secrets/addresses are removed on subsequent authentication activity.
  await env.DB.prepare("DELETE FROM email_login_challenges WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare("INSERT INTO email_login_challenges (id, email, code_hash, browser_hash, attach_user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, email, await digest(env, id, otp), await sha256Hex(secret), attachId, now, now + EMAIL_TTL * 1000).run();
  try { await (send ?? ((to, value, key) => sendEmailCode(env, to, value, key)))(email, otp, id); }
  catch {
    await env.DB.prepare("DELETE FROM email_login_challenges WHERE id = ?").bind(id).run();
    throw new ApiError(503, "We could not send your code. Please try again later.", "email_unavailable");
  }
  // Only a successfully delivered replacement invalidates earlier codes.
  await env.DB.prepare("UPDATE email_login_challenges SET consumed_at = ? WHERE email = ? AND id <> ? AND consumed_at IS NULL").bind(now, email, id).run();
  return { body: { challengeId: id, expiresIn: EMAIL_TTL, resendAfter: 60 }, cookie: challengeCookie(env, `${id}.${secret}`) };
}

export async function verifyEmailCode(env: Env, req: Request, input: unknown, now = Date.now()) {
  const { challengeId, code: otp } = emailVerifySchema.parse(input);
  if (!env.SESSION_SECRET) throw unavailable();
  const cookie = (req.headers.get("cookie") ?? "").split(/;\s*/).find((x) => x.startsWith(`${EMAIL_COOKIE}=`))?.slice(EMAIL_COOKIE.length + 1);
  const split = cookie?.indexOf(".") ?? -1;
  if (!cookie || split < 0 || cookie.slice(0, split) !== challengeId) throw invalid();
  const browserHash = await sha256Hex(cookie.slice(split + 1));
  const initial = await env.DB.prepare("SELECT * FROM email_login_challenges WHERE id = ?").bind(challengeId).first<Challenge>();
  if (!initial || !timingSafeEqual(initial.browser_hash, browserHash)) throw invalid();
  if (initial.consumed_at !== null || initial.expires_at <= now) throw expired();
  if (initial.attempts >= 5) throw locked();
  const row = await env.DB.prepare("UPDATE email_login_challenges SET attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5 RETURNING *")
    .bind(challengeId, now).first<Challenge>();
  if (!row) throw locked();
  if (!timingSafeEqual(row.code_hash, await digest(env, challengeId, otp))) throw row.attempts >= 5 ? locked() : invalid();
  const consumed = await env.DB.prepare("UPDATE email_login_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND expires_at > ? RETURNING id")
    .bind(now, challengeId, now).first();
  if (!consumed) throw expired();
  const current = row.attach_user_id ? await accountFromCookie(req.headers.get("cookie"), env) : null;
  const attachId = current?.accountId === row.attach_user_id ? row.attach_user_id : null;
  const userId = await emailAccount(env, row.email, attachId, now);
  // Sign-up and sign-in alike: a whitelist entry applies once. A failure here must never block the sign-in.
  await applyWhitelist(env, userId, row.email, now).catch(() => false);
  return { userId, cookie: await sessionCookie(userId, env), clearChallenge: challengeCookie(env, "", 0) };
}
