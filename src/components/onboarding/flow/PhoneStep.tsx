"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { Button, StickyActionBar } from "@/components/ui";

export function PhoneStep({ profile, setProfile, onDone }: { profile: Profile; setProfile(p: Profile): void; onDone(): Promise<void> }) {
  const [number, setNumber] = useState(profile.phone.number ?? "+48 ");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<null | boolean>(profile.phone.number ? profile.phone.callsEnabled : null);

  async function submit(skip: boolean) {
    setBusy(true); setError("");
    const r = skip ? await flowApi.skipPhone() : await flowApi.phone(number);
    setBusy(false);
    if (!r.ok) { setError(failure(r) ?? "Could not save the number."); return; }
    setProfile(r.data.profile);
    if (skip) { setBusy(true); await onDone(); setBusy(false); return; }
    setSaved(r.data.callsAvailable);
  }

  if (saved !== null) return (
    <div className="ob-answer">
      <div className={`ob-note${saved ? " ob-note-ok" : ""}`}>
        <strong>{saved ? "Calls are on for this number." : "Number saved."}</strong>
        <p>{saved ? "If an urgent letter arrives, I’ll phone you and explain it. You can switch calls off any time." : "Phone-call alerts are coming soon. Until then I’ll alert you in the app, and your number stays unverified and unused."}</p>
      </div>
      <StickyActionBar secondary={<Button variant="ghost" onClick={() => setSaved(null)}>Change number</Button>}>
        <Button variant="primary" size="lg" disabled={busy} loading={busy} onClick={() => { setBusy(true); void onDone().finally(() => setBusy(false)); }}>{busy ? "Opening your case…" : "Finish setup"}</Button>
      </StickyActionBar>
    </div>
  );
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
      <label className="ob-field">
        <span>Mobile number</span>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" maxLength={32} value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={!!error} />
        <small className="ob-hint">With country code. A Polish or home number works.</small>
      </label>
      {error && <p className="ob-field-err" role="alert">{error}</p>}
      <StickyActionBar secondary={<Button variant="ghost" disabled={busy} onClick={() => void submit(true)}>Skip, alerts in the app only</Button>}>
        <Button variant="primary" size="lg" type="submit" disabled={busy || number.replace(/\D/g, "").length < 7} loading={busy}>{busy ? "Saving…" : "Save my number"}</Button>
      </StickyActionBar>
    </form>
  );
}
