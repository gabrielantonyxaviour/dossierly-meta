import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./locales";
import { translator, type T } from "./translate";
import type { Namespace } from "@/messages";

/** The reader's interface language for this request (cookie, then Accept-Language, then English). */
export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
}

export async function getT(ns: Namespace): Promise<T> {
  return translator(await getLocale(), ns);
}
