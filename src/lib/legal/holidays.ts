/*
 * Polish statutory days off (ustawa z dnia 18 stycznia 1951 r. o dniach wolnych od pracy, as amended).
 * 24 December is a day off from 2025. Every Sunday is a day off; Saturday is NOT a statutory day off
 * (KPA art. 57 §4 names Saturdays separately). All dates are YYYY-MM-DD Europe/Warsaw calendar days.
 */

export interface HolidayName {
  en: string;
  pl: string;
}

const DAY_MS = 86_400_000;
const parseIso = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (d: Date): string => d.toISOString().slice(0, 10);
const shift = (iso: string, days: number): string => toIso(new Date(parseIso(iso).getTime() + days * DAY_MS));

/** Easter Sunday (anonymous Gregorian algorithm), as YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(new Date(Date.UTC(year, month - 1, day)));
}

const cache = new Map<number, Map<string, HolidayName>>();

/** Map of ISO date -> name for the year's statutory holidays (Sundays are not listed here). */
export function polishHolidays(year: number): Map<string, HolidayName> {
  const hit = cache.get(year);
  if (hit) return hit;
  const y = String(year);
  const easter = easterSunday(year);
  const list: Array<[string, HolidayName]> = [
    [`${y}-01-01`, { en: "New Year's Day", pl: "Nowy Rok" }],
    [`${y}-01-06`, { en: "Epiphany", pl: "Święto Trzech Króli" }],
    [easter, { en: "Easter Sunday", pl: "Niedziela Wielkanocna" }],
    [shift(easter, 1), { en: "Easter Monday", pl: "Poniedziałek Wielkanocny" }],
    [`${y}-05-01`, { en: "Labour Day", pl: "Święto Pracy" }],
    [`${y}-05-03`, { en: "Constitution Day", pl: "Święto Konstytucji 3 Maja" }],
    [shift(easter, 49), { en: "Pentecost Sunday", pl: "Niedziela Zielonych Świątek" }],
    [shift(easter, 60), { en: "Corpus Christi", pl: "Boże Ciało" }],
    [`${y}-08-15`, { en: "Assumption Day / Armed Forces Day", pl: "Wniebowzięcie Najświętszej Maryi Panny" }],
    [`${y}-11-01`, { en: "All Saints' Day", pl: "Wszystkich Świętych" }],
    [`${y}-11-11`, { en: "Independence Day", pl: "Narodowe Święto Niepodległości" }],
    ...(year >= 2025 ? ([[`${y}-12-24`, { en: "Christmas Eve", pl: "Wigilia Bożego Narodzenia" }]] as Array<[string, HolidayName]>) : []),
    [`${y}-12-25`, { en: "Christmas Day", pl: "Boże Narodzenie (pierwszy dzień)" }],
    [`${y}-12-26`, { en: "Boxing Day", pl: "Boże Narodzenie (drugi dzień)" }],
  ];
  const out = new Map(list);
  cache.set(year, out);
  return out;
}

/** 0 = Sunday ... 6 = Saturday. */
export const weekdayOf = (iso: string): number => parseIso(iso).getUTCDay();
export const isSunday = (iso: string): boolean => weekdayOf(iso) === 0;
export const isSaturday = (iso: string): boolean => weekdayOf(iso) === 6;

/** Sunday or statutory holiday. Saturdays are not days off by law (see KPA art. 57 §4). */
export function isDayOff(iso: string): boolean {
  return isSunday(iso) || polishHolidays(Number(iso.slice(0, 4))).has(iso);
}

/** English + Polish name of the holiday on that date; Sundays are named too. Null on ordinary days. */
export function holidayName(iso: string): HolidayName | null {
  const holiday = polishHolidays(Number(iso.slice(0, 4))).get(iso);
  if (holiday) return holiday;
  if (isSunday(iso)) return { en: "Sunday", pl: "niedziela" };
  return null;
}
