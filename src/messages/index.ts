/* Interface strings per locale and namespace. English is the source; a missing key falls back to it.
   Add a namespace by creating src/messages/<locale>/<ns>.json for all four locales and listing it here. */
import type { Locale } from "@/lib/i18n/locales";
import enCommon from "./en/common.json";
import enPricing from "./en/pricing.json";
import hiCommon from "./hi/common.json";
import ukCommon from "./uk/common.json";
import taCommon from "./ta/common.json";

const en = { common: enCommon, pricing: enPricing } as const;
export type Namespace = keyof typeof en;
type Dict = { [N in Namespace]?: Record<string, string> };

export const MESSAGES: Record<Locale, Dict> & { en: typeof en } = {
  en,
  hi: { common: hiCommon },
  uk: { common: ukCommon },
  ta: { common: taCommon },
};
