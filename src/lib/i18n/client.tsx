"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { LOCALE_COOKIE, type Locale } from "./locales";
import { translator, type T } from "./translate";
import type { Namespace } from "@/messages";

const LocaleContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = (): Locale => useContext(LocaleContext);

export function useT(ns: Namespace): T {
  const locale = useLocale();
  return useMemo(() => translator(locale, ns), [locale, ns]);
}

/** Saves the choice for a year and reloads so server-rendered text follows it. */
export function useSetLocale(): (l: Locale) => void {
  return useCallback((l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    window.location.reload();
  }, []);
}
