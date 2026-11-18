"use client";
import { useState } from "react";
import { OptionGrid } from "@/components/ui";
import { Checkbox } from "@/components/ui/Checkbox";
import type { Profile } from "@/lib/case/types";
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, type Locale } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { Continue } from "./StartSteps";

/* Onboarding steps 7 (name and language) and 8 (anything else, or a letter to read). */

export function YouStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { fullName: string; preferredLanguage: Locale }) => void }) {
  const t = useT("residence");
  const ui = useLocale();
  const [name, setName] = useState(profile.fullName ?? "");
  const [lang, setLang] = useState<Locale>((LOCALES as readonly string[]).includes(profile.preferredLanguage) ? (profile.preferredLanguage as Locale) : ui);
  const [tried, setTried] = useState(false);
  const bad = name.trim().length < 2;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (bad) return setTried(true); onNext({ fullName: name.trim(), preferredLanguage: lang }); }}>
      <label className="ob-field">
        <span>{t("fullName")}</span>
        <input className="input" autoComplete="name" autoCapitalize="words" maxLength={120} value={name} placeholder={t("fullNamePh")}
          aria-invalid={tried && bad} aria-describedby={tried && bad ? "rs-name-err" : undefined} onChange={(e) => setName(e.target.value)} />
        {tried && bad && <small id="rs-name-err" className="ob-field-err" role="alert">{t("fullNameError")}</small>}
      </label>
      <OptionGrid<Locale> label={t("language")} value={lang} onChange={setLang}
        options={LOCALES.map((l) => ({ value: l, label: <span lang={LOCALE_TAGS[l]}>{LOCALE_NAMES[l]}</span> }))} />
      <p className="rp-note">{t("languageNote")}</p>
      <Continue busy={busy} />
    </form>
  );
}

const LETTER_KEY = "ob-letter";
/** Whether to open Look on the letter after setup (kept for this tab only). */
export function wantsLetter(fallback: boolean): boolean {
  try { const v = sessionStorage.getItem(LETTER_KEY); return v === null ? fallback : v === "1"; } catch { return fallback; }
}

export function ExtraStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { note: string }) => void }) {
  const t = useT("residence");
  const [note, setNote] = useState("");
  const [letter, setLetter] = useState(() => wantsLetter(profile.situation === "letter"));
  const toggle = (v: boolean) => { setLetter(v); try { sessionStorage.setItem(LETTER_KEY, v ? "1" : "0"); } catch { /* private mode: default stays */ } };
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); onNext({ note: note.trim() }); }}>
      <label className="ob-field">
        <span>{t("extraLabel")} <em className="rs-optional">{t("optional")}</em></span>
        <textarea className="input rs-textarea" rows={4} maxLength={600} value={note} placeholder={t("extraPh")} onChange={(e) => setNote(e.target.value)} />
        <small className="rs-hint">{t("extraHint")}</small>
      </label>
      <div className="rs-member-form">
        <Checkbox checked={letter} onChange={toggle}>{t("letterToggle")}</Checkbox>
        <p className="rp-note">{t("letterToggleSub")}</p>
      </div>
      <Continue busy={busy} label={note.trim() ? t("next") : t("skip")} />
    </form>
  );
}
