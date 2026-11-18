"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { verifyEmailCode } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { emailError, emailSchema, requestEmailCode } from "@/lib/client/email-auth";
import { rich } from "@/lib/i18n/rich";

type Challenge = { id: string; email: string; expiresAt: number };

export function EmailCodeForm({ heading, onVerified }: { heading: string; onVerified(): void }) {
  const t = useT("auth");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const [spent, setSpent] = useState(false);
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expired = !!challenge && now >= challenge.expiresAt;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (challenge) codeInput.current?.focus(); }, [challenge]);

  async function send() {
    if (pending.current || Date.now() < retryAt) return;
    const parsed = emailSchema.safeParse(challenge?.email ?? email);
    if (!parsed.success) { setError(t("errInvalidEmail")); emailInput.current?.focus(); return; }
    pending.current = true;
    setBusy("send"); setError(""); setNotice("");
    const r = await requestEmailCode(parsed.data);
    const time = Date.now();
    setNow(time); setBusy(null); pending.current = false;
    if (!r.ok) {
      setError(emailError(r));
      if (r.code === "rate_limited" || r.status === 429) setRetryAt(time + 60_000);
      return;
    }
    setChallenge({ id: r.data.challengeId, email: parsed.data, expiresAt: time + r.data.expiresIn * 1000 });
    setRetryAt(time + r.data.resendAfter * 1000);
    setCode(""); setSpent(false);
    setNotice(challenge ? t("useLatest") : "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return send();
    if (pending.current || spent) return;
    if (Date.now() >= challenge.expiresAt) { setNow(Date.now()); setError(t("errExpiredCode")); return; }
    if (!/^\d{6}$/.test(code)) { setError(t("errCodeFormat")); codeInput.current?.focus(); return; }
    pending.current = true;
    setBusy("verify"); setError(""); setNotice("");
    const r = await verifyEmailCode(challenge.id, code);
    if (r.ok) { onVerified(); return; }
    pending.current = false; setBusy(null); setError(emailError(r));
    if (r.code === "expired_code" || r.code === "too_many_attempts") setSpent(true);
    if (r.code === "rate_limited" || r.status === 429) setRetryAt(Date.now() + 60_000);
    codeInput.current?.focus();
  }

  function changeEmail() {
    setChallenge(null); setCode(""); setSpent(false); setError(""); setNotice("");
    requestAnimationFrame(() => emailInput.current?.focus());
  }

  function pasteCode(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/[\s-]/g, "");
    const disabled = busy !== null || pending.current || spent || expired;
    if (!disabled && !/^\d{6}$/.test(pasted)) return;
    // Full codes replace partial input before input-otp's insertion handler runs.
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setCode(pasted); setError("");
  }

  return (
    <form className="auth-email-form" onSubmit={(event) => void submit(event)} noValidate aria-busy={busy !== null} aria-labelledby="auth-heading">
      <div className="auth-heading">
        <h1 id="auth-heading">{challenge ? t("checkEmail") : heading}</h1>
        {challenge && <p id="auth-recipient" className="small muted">{rich(t("sentTo"), { email: <strong>{challenge.email}</strong> })}</p>}
      </div>
      {challenge ? (
        <>
          <div className="field auth-code-field" data-invalid={!!error} data-disabled={busy !== null || spent || expired}>
            <label htmlFor="auth-code">{t("codeLabel")}</label>
            <InputOTP ref={codeInput} id="auth-code" name="code" inputMode="numeric"
              autoComplete="one-time-code" pattern={REGEXP_ONLY_DIGITS} maxLength={6} required value={code}
              onChange={(value) => { setCode(value); setError(""); }}
              onPasteCapture={pasteCode}
              pasteTransformer={(value) => value.replace(/[\s-]/g, "")}
              disabled={busy !== null || spent || expired} aria-describedby="auth-recipient code-help auth-feedback" aria-invalid={!!error}>
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p id="code-help" className="tiny muted">{expired ? t("codeExpiredHelp") : t("codeExpiresIn")}</p>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy !== null || spent || expired}>
            {busy === "verify" ? t("verifying") : t("verify")}
          </button>
          <div className="auth-code-actions">
            <button className="btn btn-ghost btn-small" type="button" onClick={() => void send()} disabled={busy !== null || seconds > 0}>
              {busy === "send" ? t("resending") : seconds > 0 ? t("resendIn", { s: seconds }) : t("resend")}
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={changeEmail} disabled={busy !== null}>{t("changeEmail")}</button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>{t("emailLabel")}</span>
            <input ref={emailInput} className="input" name="email" type="email" autoComplete="email" inputMode="email"
              autoCapitalize="none" spellCheck={false} maxLength={254} required value={email}
              onChange={(event) => { setEmail(event.target.value); setError(""); }} disabled={busy !== null}
              aria-describedby="auth-feedback" aria-invalid={!!error} />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy !== null || seconds > 0}>
            {busy === "send" ? t("sending") : seconds > 0 ? t("continueIn", { s: seconds }) : t("continue")}
          </button>
        </>
      )}
      <div id="auth-feedback">
        {error && <p className="error-box small" role="alert">{error}</p>}
        {notice && <p className="small muted" role="status">{notice}</p>}
      </div>
    </form>
  );
}
