/** Interface languages. The interpreting language at the counter is chosen separately per case. */
export const LOCALES = ["en", "hi", "uk", "ta"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "dl_lang";

/** Each language named in itself, so a reader always finds their own. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिन्दी", uk: "Українська", ta: "தமிழ்" };

/** BCP 47 tags for <html lang> and Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = { en: "en-GB", hi: "hi-IN", uk: "uk-UA", ta: "ta-IN" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Cookie first, then the browser's Accept-Language order, then English. */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const base = part.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
