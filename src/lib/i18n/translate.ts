import { DEFAULT_LOCALE, type Locale } from "./locales";
import { MESSAGES, type Namespace } from "@/messages";

export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

/** Translator for one namespace: the locale's string, else English, else the key itself (never blank). */
export function translator(locale: Locale, ns: Namespace): T {
  const own = MESSAGES[locale]?.[ns] as Record<string, string> | undefined;
  const base = MESSAGES[DEFAULT_LOCALE][ns] as Record<string, string>;
  return (key, vars) => fill(own?.[key] ?? base?.[key] ?? key, vars);
}
