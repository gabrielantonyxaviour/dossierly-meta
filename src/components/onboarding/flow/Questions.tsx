"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LANGUAGES, type Language } from "@/lib/schemas";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { Button, OptionGrid, StickyActionBar } from "@/components/ui";

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
