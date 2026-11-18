"use client";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/case/types";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { Button, StickyActionBar } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export function PhoneStep({ profile, setProfile, onDone }: { profile: Profile; setProfile(p: Profile): void; onDone(): Promise<void> }) {
  const t = useT("onboarding");
  // A verified (demo) number is never put back on screen.
  const [number, setNumber] = useState(profile.phone.number && !profile.phone.verified ? profile.phone.number : "+48 ");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<null | boolean>(profile.phone.number ? profile.phone.callsEnabled : null);
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => { void flowApi.state().then((r) => { if (r.ok) setDemo(r.data.demoPhone); }); }, []);

  async function submit(skip: boolean, useDemo = false) {
    setBusy(true); setError("");
    const r = skip ? await flowApi.skipPhone() : useDemo ? await flowApi.demoPhone() : await flowApi.phone(number);
    setBusy(false);
    if (!r.ok) { setError(failure(r) ?? t("phoneError")); return; }
    setProfile(r.data.profile);
    if (skip) { setBusy(true); await onDone(); setBusy(false); return; }
    setSaved(r.data.callsAvailable);
  }

  if (saved !== null) return (
    <div className="ob-answer">
      <div className={`ob-note${saved ? " ob-note-ok" : ""}`}>
        <strong>{saved ? t("callsOn") : t("numberSaved")}</strong>
        <p>{saved ? t("callsOnBody") : t("callsSoonBody")}</p>
      </div>
      <StickyActionBar secondary={<Button variant="ghost" onClick={() => setSaved(null)}>{t("changeNumber")}</Button>}>
        <Button variant="primary" size="lg" disabled={busy} loading={busy} onClick={() => { setBusy(true); void onDone().finally(() => setBusy(false)); }}>{busy ? t("openingCase") : t("finishSetup")}</Button>
      </StickyActionBar>
    </div>
  );
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
      {demo && <button type="button" className="ob-cal-toggle ob-demo-phone" disabled={busy} onClick={() => void submit(false, true)}><span><strong>{t("useVerified", { last: demo })}</strong><small>{t("alreadyVerified")}</small></span></button>}
      <label className="ob-field">
        <span>{t("mobileNumber")}</span>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" maxLength={32} value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={!!error} />
        <small className="ob-hint">{t("countryCodeHint")}</small>
      </label>
      {error && <p className="ob-field-err" role="alert">{error}</p>}
      <StickyActionBar secondary={<Button variant="ghost" disabled={busy} onClick={() => void submit(true)}>{t("skipPhone")}</Button>}>
        <Button variant="primary" size="lg" type="submit" disabled={busy || number.replace(/\D/g, "").length < 7} loading={busy}>{busy ? t("saving") : t("saveNumber")}</Button>
      </StickyActionBar>
    </form>
  );
}
