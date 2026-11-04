"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LANGUAGES, type Language } from "@/lib/schemas";
import { DatePicker } from "@/components/ui/DatePicker";
import { ActionBar, OptionList } from "./mobile";
import { CITIES, orgLabel, REASONS, STAGES, type Reason } from "./options";

type Next = (patch?: Partial<Profile>) => Promise<void>;
export type ScreenProps = { profile: Profile; busy: boolean; next: Next };

const Continue = ({ busy, disabled, form }: { busy: boolean; disabled?: boolean; form?: boolean }) => (
  <button type={form ? "submit" : "button"} className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={busy || disabled}>{busy ? "Saving…" : "Continue"}</button>
);

export function NameScreen({ profile, busy, next }: ScreenProps) {
  const [name, setName] = useState(profile.fullName ?? "");
  const [touched, setTouched] = useState(false);
  const invalid = touched && name.trim().length < 2;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (name.trim().length >= 2) void next({ fullName: name.trim(), country: "PL" }); }}>
      <label className="ob-field">
        <span>Full name</span>
        <input className="input ob-input" autoComplete="name" autoCapitalize="words" enterKeyHint="next" autoFocus maxLength={120} value={name} placeholder="As on your passport"
          onChange={(e) => setName(e.target.value)} aria-invalid={invalid} aria-describedby={invalid ? "ob-name-err" : undefined} />
        {invalid && <small id="ob-name-err" className="ob-field-err">Enter the name I should use for you.</small>}
      </label>
      <ActionBar><Continue busy={busy} form /></ActionBar>
    </form>
  );
}

export function LanguageScreen({ profile, busy, next }: ScreenProps) {
  const [language, setLanguage] = useState<Language>((LANGUAGES as readonly string[]).includes(profile.preferredLanguage) ? (profile.preferredLanguage as Language) : "en");
  return (
    <div className="ob-answer">
      <OptionList<Language> label="Preferred language" layout="grid" value={language} onChange={setLanguage} disabled={busy}
        options={LANGUAGES.map((l) => ({ value: l, title: LANGUAGE_META[l].native, hint: l === "en" ? undefined : LANGUAGE_META[l].english, lang: l }))} />
      <div className="ob-locked"><span className="ob-flag" aria-hidden="true" /><strong>Poland</strong><span>More countries soon</span></div>
      <ActionBar><button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={busy} onClick={() => void next({ preferredLanguage: language, country: "PL" })}>{busy ? "Saving…" : "Continue"}</button></ActionBar>
    </div>
  );
}

export function ReasonScreen({ profile, busy, next, reason, setReason }: ScreenProps & { reason: Reason | null; setReason(r: Reason): void }) {
  const known = reason ?? REASONS.find((r) => r.permit === profile.permitType && r.permit !== "other")?.id ?? null;
  const [pick, setPick] = useState<Reason | null>(known);
  return (
    <div className="ob-answer">
      <OptionList<Reason> label="Reason for living in Poland" value={pick} onChange={setPick} disabled={busy} options={REASONS.map((r) => ({ value: r.id, title: r.title, hint: r.hint }))} />
      <ActionBar>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={busy || !pick}
          onClick={() => { const r = REASONS.find((x) => x.id === pick); if (r) { setReason(r.id); void next({ permitType: r.permit }); } }}>{busy ? "Saving…" : "Continue"}</button>
      </ActionBar>
    </div>
  );
}

export function StageScreen({ profile, busy, next, answered }: ScreenProps & { answered: boolean }) {
  const [pick, setPick] = useState<Profile["stage"] | null>(answered ? profile.stage : null);
  return (
    <div className="ob-answer">
      <OptionList<NonNullable<Profile["stage"]>> label="Residence permit stage" value={pick} onChange={setPick} disabled={busy} options={STAGES.map((s) => ({ value: s.id, title: s.title, hint: s.hint }))} />
      <ActionBar>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={busy || !pick} onClick={() => pick && void next({ stage: pick })}>{busy ? "Saving…" : "Continue"}</button>
      </ActionBar>
    </div>
  );
}

export function CityScreen({ profile, busy, next }: ScreenProps) {
  const known = !!profile.city && CITIES.includes(profile.city);
  const [city, setCity] = useState(profile.city ? (known ? profile.city : "other") : "");
  const [other, setOther] = useState(known ? "" : profile.city ?? "");
  const final = city === "other" ? other.trim() : city;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (final) void next({ city: final }); }}>
      <OptionList label="City" layout="grid" value={city || null} onChange={setCity} disabled={busy}
        options={[...CITIES.map((c) => ({ value: c, title: c })), { value: "other", title: "Another city", wide: true }]} />
      {city === "other" && <input className="input ob-input" aria-label="Your city" autoFocus enterKeyHint="done" maxLength={80} value={other} placeholder="e.g. Szczecin" onChange={(e) => setOther(e.target.value)} />}
      <ActionBar><Continue busy={busy} disabled={!final} form /></ActionBar>
    </form>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function DetailsScreen({ profile, busy, next, reason }: ScreenProps & { reason: Reason | null }) {
  const [org, setOrg] = useState(profile.organisation ?? "");
  const [arrival, setArrival] = useState(profile.arrivalDate ?? "");
  const meta = orgLabel(profile.permitType, reason);
  const needsOrg = profile.permitType === "temporary_residence_study" || profile.permitType === "temporary_residence_work";
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (!needsOrg || org.trim()) void next({ organisation: org.trim() || null, arrivalDate: arrival || null }); }}>
      <label className="ob-field">
        <span>{meta.label}</span>
        <input className="input ob-input" maxLength={160} value={org} placeholder={meta.placeholder} enterKeyHint="next" onChange={(e) => setOrg(e.target.value)} autoComplete="organization" />
      </label>
      <div className="ob-field">
        <span className="ob-field-label" id="ob-arrival">Arrival in Poland <em>(optional)</em></span>
        <DatePicker value={arrival} onChange={setArrival} max={today()} min="2015-01-01" labelledBy="ob-arrival" placeholder="Choose a date" />
      </div>
      <ActionBar><Continue busy={busy} disabled={needsOrg && !org.trim()} form /></ActionBar>
    </form>
  );
}
