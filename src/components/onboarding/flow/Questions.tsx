"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LANGUAGES, type Language } from "@/lib/schemas";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button, OptionGrid, OptionList, StickyActionBar } from "@/components/ui";
import { CITIES, orgLabel, REASONS, STAGES, type Reason } from "./options";

type Next = (patch?: Partial<Profile>) => Promise<void>;
export type ScreenProps = { profile: Profile; busy: boolean; next: Next };

/** The bottom Continue bar. `onClick` for plain screens; without it the button submits its form. */
function Continue({ busy, disabled, onClick }: { busy: boolean; disabled?: boolean; onClick?: () => void }) {
  const t = useT("onboarding");
  return <StickyActionBar><Button variant="primary" size="lg" type={onClick ? "button" : "submit"} disabled={busy || disabled} loading={busy} onClick={onClick}>{t("continue")}</Button></StickyActionBar>;
}

export function NameScreen({ profile, busy, next }: ScreenProps) {
  const t = useT("onboarding");
  const [name, setName] = useState(profile.fullName ?? "");
  const [touched, setTouched] = useState(false);
  const invalid = touched && name.trim().length < 2;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (name.trim().length >= 2) void next({ fullName: name.trim(), country: "PL" }); }}>
      <label className="ob-field">
        <span>{t("fullName")}</span>
        <input className="input" autoComplete="name" autoCapitalize="words" enterKeyHint="next" autoFocus maxLength={120} value={name} placeholder={t("fullNamePlaceholder")}
          onChange={(e) => setName(e.target.value)} aria-invalid={invalid} aria-describedby={invalid ? "ob-name-err" : undefined} />
        {invalid && <small id="ob-name-err" className="ob-field-err">{t("fullNameError")}</small>}
      </label>
      <Continue busy={busy} />
    </form>
  );
}

export function LanguageScreen({ profile, busy, next }: ScreenProps) {
  const t = useT("onboarding");
  const names = new Intl.DisplayNames([LOCALE_TAGS[useLocale()], "en"], { type: "language" });
  const [language, setLanguage] = useState<Language>((LANGUAGES as readonly string[]).includes(profile.preferredLanguage) ? (profile.preferredLanguage as Language) : "en");
  return (
    <div className="ob-answer">
      <OptionGrid<Language> label={t("preferredLanguage")} value={language} onChange={setLanguage}
        options={LANGUAGES.map((l) => ({ value: l, label: <span lang={l}>{LANGUAGE_META[l].native}</span>, sub: l === "en" ? t("languageDefault") : names.of(l) ?? LANGUAGE_META[l].english }))} />
      <div className="ob-locked"><span className="ob-flag" aria-hidden="true" /><strong>{t("poland")}</strong><span>{t("moreCountries")}</span></div>
      <Continue busy={busy} onClick={() => void next({ preferredLanguage: language, country: "PL" })} />
    </div>
  );
}

export function ReasonScreen({ profile, busy, next, reason, setReason }: ScreenProps & { reason: Reason | null; setReason(r: Reason): void }) {
  const t = useT("onboarding");
  const known = reason ?? REASONS.find((r) => r.permit === profile.permitType && r.permit !== "other")?.id ?? null;
  const [pick, setPick] = useState<Reason | null>(known);
  return (
    <div className="ob-answer">
      <OptionList<Reason> label={t("reasonLabel")} value={pick} onChange={setPick} options={REASONS.map((r) => ({ value: r.id, label: t(r.title), sub: t(r.hint) }))} />
      <Continue busy={busy} disabled={!pick} onClick={() => { const r = REASONS.find((x) => x.id === pick); if (r) { setReason(r.id); void next({ permitType: r.permit }); } }} />
    </div>
  );
}

export function StageScreen({ profile, busy, next, answered }: ScreenProps & { answered: boolean }) {
  const t = useT("onboarding");
  const [pick, setPick] = useState<Profile["stage"] | null>(answered ? profile.stage : null);
  return (
    <div className="ob-answer">
      <OptionList<NonNullable<Profile["stage"]>> label={t("stageLabel")} value={pick} onChange={setPick} options={STAGES.map((s) => ({ value: s.id, label: t(s.title), sub: t(s.hint) }))} />
      <Continue busy={busy} disabled={!pick} onClick={() => pick && void next({ stage: pick })} />
    </div>
  );
}

export function CityScreen({ profile, busy, next }: ScreenProps) {
  const t = useT("onboarding");
  const known = !!profile.city && CITIES.includes(profile.city);
  const [city, setCity] = useState(profile.city ? (known ? profile.city : "other") : "");
  const [other, setOther] = useState(known ? "" : profile.city ?? "");
  const final = city === "other" ? other.trim() : city;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (final) void next({ city: final }); }}>
      <OptionGrid label={t("city")} value={city || null} onChange={setCity} className="ob-cities"
        options={[...CITIES.map((c) => ({ value: c, label: c })), { value: "other", label: t("anotherCity") }]} />
      {city === "other" && <input className="input" aria-label={t("yourCity")} autoFocus enterKeyHint="done" maxLength={80} value={other} placeholder={t("cityPlaceholder")} onChange={(e) => setOther(e.target.value)} />}
      <Continue busy={busy} disabled={!final} />
    </form>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function DetailsScreen({ profile, busy, next, reason }: ScreenProps & { reason: Reason | null }) {
  const t = useT("onboarding");
  const [org, setOrg] = useState(profile.organisation ?? "");
  const [arrival, setArrival] = useState(profile.arrivalDate ?? "");
  const meta = orgLabel(profile.permitType, reason, t);
  const needsOrg = profile.permitType === "temporary_residence_study" || profile.permitType === "temporary_residence_work";
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (!needsOrg || org.trim()) void next({ organisation: org.trim() || null, arrivalDate: arrival || null }); }}>
      <label className="ob-field">
        <span>{meta.label}</span>
        <input className="input" maxLength={160} value={org} placeholder={meta.placeholder} enterKeyHint="next" onChange={(e) => setOrg(e.target.value)} autoComplete="organization" />
      </label>
      <div className="ob-field">
        <span className="ob-field-label" id="ob-arrival">{t("arrival")} <em>{t("optional")}</em></span>
        <DatePicker value={arrival} onChange={setArrival} max={today()} min="2015-01-01" labelledBy="ob-arrival" placeholder={t("chooseDate")} />
      </div>
      <Continue busy={busy} disabled={needsOrg && !org.trim()} />
    </form>
  );
}
