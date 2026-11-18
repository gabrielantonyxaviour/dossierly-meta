/* Residence-case date and money formatting in the interface language. Case dates are Europe/Warsaw calendar days. */
import { currentTag } from "@/lib/i18n/current";

const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

/** "Thursday, 14 January 2027" (weekday always spelled out, so nobody has to work it out). */
export const longDate = (ymd: string) =>
  new Intl.DateTimeFormat(currentTag(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at(ymd));

/** "Thu, 14 Jan 2027" */
export const shortDate = (ymd: string) =>
  new Intl.DateTimeFormat(currentTag(), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(at(ymd));

/** "Jan 2027" */
export const monthYear = (ymd: string) => new Intl.DateTimeFormat(currentTag(), { month: "long", year: "numeric", timeZone: "UTC" }).format(at(ymd));

/** "1 370 zł" with the locale's grouping. */
export const zl = (n: number) => `${new Intl.NumberFormat(currentTag()).format(n)} zł`;
