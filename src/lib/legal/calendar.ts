/* Calendar-day arithmetic on YYYY-MM-DD strings (Europe/Warsaw calendar days). UTC maths only, so no DST or timezone drift. */

export class DeadlineInputError extends Error {
  readonly code: "invalid_date" | "invalid_period";
  constructor(code: "invalid_date" | "invalid_period", message: string) {
    super(message);
    this.name = "DeadlineInputError";
    this.code = code;
  }
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86_400_000;

export function parseIsoDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new DeadlineInputError("invalid_date", `Not a YYYY-MM-DD date: ${String(iso)}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new DeadlineInputError("invalid_date", `Not a real calendar date: ${iso}`);
  }
  return date;
}

export const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (iso: string, days: number): string => toIsoDate(new Date(parseIsoDate(iso).getTime() + days * DAY_MS));

/** Same day-of-month `months` later; if that month is too short, its last day. Also reports whether it was clamped. */
export function addMonths(iso: string, months: number): { date: string; clamped: boolean } {
  const start = parseIsoDate(iso);
  const total = start.getUTCFullYear() * 12 + start.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDay);
  return { date: toIsoDate(new Date(Date.UTC(year, month, day))), clamped: start.getUTCDate() > lastDay };
}

/** "Tuesday, 27 October 2026" */
export function formatDay(iso: string): string {
  const d = parseIsoDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Saturday 26 December" without year, for chains of days off. */
export function formatShort(iso: string): string {
  const d = parseIsoDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
