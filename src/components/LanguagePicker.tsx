"use client";
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useSetLocale, useT } from "@/lib/i18n/client";

/** Interface-language switcher. Each language is written in itself; choosing one saves the cookie and reloads. */
export function LanguagePicker({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT("common");
  return (
    <div role="radiogroup" aria-label={t("language")} className={`lang-pick${compact ? " lang-pick--compact" : ""} ${className}`.trim()}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          lang={LOCALE_TAGS[l]}
          aria-checked={l === locale}
          onClick={() => l !== locale && setLocale(l)}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
