"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LANGUAGES } from "@/lib/schemas";
import { DatePicker } from "@/components/ui/DatePicker";
import { CITIES, orgLabel, REASONS, STAGES, type Reason } from "./options";

type Save = (patch: Partial<Profile>) => Promise<void>;
type Base = { profile: Profile; busy: boolean; save: Save };

function Choice({ title, hint, selected, disabled, onPick }: { title: string; hint: string; selected: boolean; disabled: boolean; onPick(): void }) {
  return (
    <button type="button" className="ob-choice" aria-pressed={selected} disabled={disabled} onClick={onPick}>
      <span className="ob-choice-text"><strong>{title}</strong><span>{hint}</span></span>
      <span className="ob-choice-dot" aria-hidden="true" />
    </button>
  );
}

export function YouStep({ profile, busy, save }: Base) {
  const [name, setName] = useState(profile.fullName ?? "");
  const [language, setLanguage] = useState(profile.preferredLanguage || "en");
  const [touched, setTouched] = useState(false);
  const invalid = touched && name.trim().length < 2;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (name.trim().length >= 2) void save({ fullName: name.trim(), preferredLanguage: language, country: "PL" }); }}>
      <label className="ob-field">
        <span>Your full name</span>
        <input className="input ob-input-lg" autoComplete="name" autoFocus maxLength={120} value={name} placeholder="As on your passport"
          onChange={(e) => setName(e.target.value)} aria-invalid={invalid} aria-describedby={invalid ? "ob-name-err" : undefined} />
        {invalid && <small id="ob-name-err" className="ob-field-err">Enter the name I should use for you.</small>}
      </label>
      <fieldset className="ob-field">
        <legend>Language I should speak with you</legend>
        <div className="ob-chips" role="radiogroup" aria-label="Preferred language">
          {LANGUAGES.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={language === l} className="ob-chip" onClick={() => setLanguage(l)}>
              <span lang={l}>{LANGUAGE_META[l].native}</span>{l !== "en" && <small>{LANGUAGE_META[l].english}</small>}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="ob-field">
        <span className="ob-field-label">Country</span>
        <div className="ob-locked"><span className="ob-flag" aria-hidden="true" /><strong>Poland</strong><span>More countries coming soon</span></div>
      </div>
      <button className="btn btn-primary ob-next" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
    </form>
  );
}

export function ReasonStep({ profile, busy, save, reason, setReason }: Base & { reason: Reason | null; setReason(r: Reason): void }) {
  const current = reason ?? REASONS.find((r) => r.permit === profile.permitType && r.permit !== "other")?.id ?? null;
  return (
    <div className="ob-answer ob-choices" role="list">
      {REASONS.map((r) => (
        <Choice key={r.id} title={r.title} hint={r.hint} selected={current === r.id} disabled={busy}
          onPick={() => { setReason(r.id); void save({ permitType: r.permit }); }} />
      ))}
    </div>
  );
}

export function StageStep({ profile, busy, save, answered }: Base & { answered: boolean }) {
  return (
    <div className="ob-answer ob-choices" role="list">
      {STAGES.map((s) => (
        <Choice key={s.id} title={s.title} hint={s.hint} selected={answered && profile.stage === s.id} disabled={busy} onPick={() => void save({ stage: s.id })} />
      ))}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function PlaceStep({ profile, busy, save, reason }: Base & { reason: Reason | null }) {
  const known = profile.city && CITIES.includes(profile.city);
  const [city, setCity] = useState(profile.city ? (known ? profile.city : "other") : "");
  const [otherCity, setOtherCity] = useState(known ? "" : profile.city ?? "");
  const [org, setOrg] = useState(profile.organisation ?? "");
  const [arrival, setArrival] = useState(profile.arrivalDate ?? "");
  const [touched, setTouched] = useState(false);
  const finalCity = city === "other" ? otherCity.trim() : city;
  const meta = orgLabel(profile.permitType, reason);
  const needsOrg = profile.permitType === "temporary_residence_study" || profile.permitType === "temporary_residence_work";
  const missing = !finalCity ? "Choose your city." : needsOrg && !org.trim() ? `Add ${meta.label.toLowerCase()}.` : "";
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => {
      e.preventDefault(); setTouched(true);
      if (!missing) void save({ city: finalCity, organisation: org.trim() || null, arrivalDate: arrival || null });
    }}>
      <fieldset className="ob-field">
        <legend>City</legend>
        <div className="ob-chips" role="radiogroup" aria-label="City">
          {[...CITIES, "other"].map((c) => (
            <button key={c} type="button" role="radio" aria-checked={city === c} className="ob-chip" onClick={() => setCity(c)}>{c === "other" ? "Another city" : c}</button>
          ))}
        </div>
        {city === "other" && <input className="input" aria-label="Your city" autoFocus maxLength={80} value={otherCity} placeholder="e.g. Szczecin" onChange={(e) => setOtherCity(e.target.value)} />}
      </fieldset>
      <label className="ob-field">
        <span>{meta.label}</span>
        <input className="input" maxLength={160} value={org} placeholder={meta.placeholder} onChange={(e) => setOrg(e.target.value)} autoComplete="organization" />
      </label>
      <div className="ob-field">
        <span className="ob-field-label" id="ob-arrival">When did you arrive? <em>(optional)</em></span>
        <DatePicker value={arrival} onChange={setArrival} max={today()} min="2015-01-01" labelledBy="ob-arrival" placeholder="Choose your arrival date" />
      </div>
      {touched && missing && <p className="ob-field-err" role="alert">{missing}</p>}
      <button className="btn btn-primary ob-next" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
    </form>
  );
}
