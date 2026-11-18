import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from "./locales";
import { translator, type T } from "./translate";
import type { Namespace } from "@/messages";

const BY_TAG = Object.fromEntries(Object.entries(LOCALE_TAGS).map(([l, tag]) => [tag, l])) as Record<string, Locale>;

/** Interface language for code outside React (formatters, error text). In the browser it follows
 *  <html lang>, which the root layout sets from the reader's choice; on the server it is English. */
export function currentLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return BY_TAG[document.documentElement.lang] ?? DEFAULT_LOCALE;
}

/** BCP 47 tag for Intl formatting in the current interface language. */
export const currentTag = (): string => LOCALE_TAGS[currentLocale()];

/** Translator for non-React code. Call it at use time, not at module load. */
export const tNow = (ns: Namespace): T => translator(currentLocale(), ns);
