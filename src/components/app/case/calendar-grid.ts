import { warsawDate } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { timeLabel } from "../format";

/* Pure helpers for the case calendar: the dated items of a case, and a Monday-first month grid. */

export type DateItem = {
  key: string;
  /** YYYY-MM-DD, Warsaw calendar day. */
  date: string;
  kind: "deadline" | "appointment";
  title: string;
  sub: string;
  href?: string;
  status?: string;
  time?: string;
};

export function caseDates(c: CaseSnapshot): DateItem[] {
  return [
    ...c.deadlines.map((d) => ({ key: d.id, date: d.dueDate, kind: "deadline" as const, title: d.title, sub: d.computation.rule ?? "Deadline", href: `/app/case/deadlines/${d.id}`, status: d.status })),
    ...c.appointments.map((a) => ({ key: a.id, date: warsawDate(a.at), kind: "appointment" as const, title: a.title, sub: `${a.location.name}${a.location.address ? ` · ${a.location.address}` : ""}`, time: timeLabel(a.at) })),
  ];
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const DAY = 86_400_000;

/** "YYYY-MM" ± n months. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Whole weeks (Monday first) covering the month: 5 or 6 rows of 7 days. */
export function monthGrid(month: string): { date: string; inMonth: boolean }[] {
  const first = Date.parse(`${month}-01T00:00:00Z`);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - lead * DAY;
  const next = Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`);
  const weeks = Math.ceil((lead + (next - first) / DAY) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = iso(start + i * DAY);
    return { date, inMonth: date.startsWith(month) };
  });
}

/** Days strictly after today up to and including the nearest open deadline: the window still left. */
export function deadlineWindow(items: DateItem[], today: string): { from: string; to: string } | null {
  const next = items.filter((i) => i.kind === "deadline" && i.status !== "done" && i.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { from: today, to: next.date } : null;
}

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
