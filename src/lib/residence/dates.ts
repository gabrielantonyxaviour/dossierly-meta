import { computeKpaDeadline, type ComputedDeadline } from "@/lib/legal/deadlines";
import { addDays, addMonths } from "@/lib/legal/calendar";
import { daysBetween } from "@/lib/case/next-step";

/*
 * Residence-case dates. Pure, on YYYY-MM-DD Europe/Warsaw calendar days.
 *  - file by: the last day of legal stay (Ustawa o cudzoziemcach art. 105 ust. 1); MOS is online, so no weekend roll-over;
 *  - start by: 8 weeks earlier (Dossierly's recommendation: the employer annex alone can take weeks);
 *  - appeal: 14 days from delivery of a refusal (KPA art. 129 §2), counted by the KPA engine;
 *  - renewal prep: 3 months before the permit ends (a new application, filed before the old stay ends).
 */

export const START_WEEKS_BEFORE = 8;

export const fileByDate = (legalStayUntil: string): string => legalStayUntil;

export const startByDate = (legalStayUntil: string): string => addDays(fileByDate(legalStayUntil), -START_WEEKS_BEFORE * 7);

export const renewalPrepDate = (permitEnds: string): string => addMonths(permitEnds, -3).date;

/** Days left to file (negative once the last day has passed). */
export const daysToFile = (legalStayUntil: string, today: string): number => daysBetween(today, fileByDate(legalStayUntil));

/** Day N of the wait, counting the filing day as day 0. */
export const daysSinceFiling = (filedOn: string, today: string): number => Math.max(0, daysBetween(filedOn, today));

/** Appeal deadline for a refusal delivered on `deliveredOn` (14 days, KPA art. 129 §2, roll-over per art. 57 §4). */
export function appealDeadline(deliveredOn: string): ComputedDeadline {
  return computeKpaDeadline({ start: { kind: "delivery", date: deliveredOn }, period: { amount: 14, unit: "days" }, legalBasis: "KPA art. 129 §2" });
}

/** Share of the regional average wait already behind the person, 0..1 (can exceed the average: capped at 1). */
export const waitShare = (daysWaited: number, avgDays: number): number => Math.max(0, Math.min(1, avgDays > 0 ? daysWaited / avgDays : 0));

/** "Thursday 14 January 2027": weekday spelled out, for tests, prompts and logs (the UI formats per locale). */
export function weekdayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d).replace(",", "");
}
