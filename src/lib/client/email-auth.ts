import { z } from "zod";
import { tNow } from "@/lib/i18n/current";
import { call, type ApiFailure, type ApiResult } from "./api";

export const emailSchema = z.string().trim().max(254).email();
const challengeSchema = z.object({
  challengeId: z.string().min(1),
  expiresIn: z.number().int().positive().max(3600),
  resendAfter: z.number().int().nonnegative().max(3600),
});
export type EmailChallenge = z.infer<typeof challengeSchema>;

export async function requestEmailCode(email: string): Promise<ApiResult<EmailChallenge>> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid_email", error: tNow("auth")("errInvalidEmail") };
  const r = await call<unknown>("/api/auth/email/request", {
    method: "POST", body: JSON.stringify({ email: parsed.data }),
  });
  if (!r.ok) return r;
  const challenge = challengeSchema.safeParse(r.data);
  return challenge.success ? { ok: true, data: challenge.data }
    : { ok: false, status: 502, code: "email_unavailable", error: tNow("auth")("errEmailUnavailable") };
}

export function emailError(f: ApiFailure): string {
  const t = tNow("auth");
  if (f.status === 0) return t("errOffline");
  switch (f.code) {
    case "invalid_email": return t("errInvalidEmail");
    case "invalid_code": return t("errInvalidCode");
    case "expired_code": return t("errExpiredCode");
    case "too_many_attempts": return t("errTooManyAttempts");
    case "rate_limited": return t("errRateLimited");
    default: return f.status === 429 ? t("errRateLimited") : t("errUnavailable");
  }
}
