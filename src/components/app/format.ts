/* Date/time formatting for case data. Case dates are Europe/Warsaw calendar days.
   Words and month names follow the interface language; the date arithmetic does not change. */
import { currentTag, tNow } from "@/lib/i18n/current";

const TZ = "Europe/Warsaw";

export function dayLabel(isoDate: string, opts: { year?: boolean } = {}): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(currentTag(), { weekday: "short", day: "numeric", month: "short", ...(opts.year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(d);
}

export function longDay(isoDate: string): string {
  return new Intl.DateTimeFormat(currentTag(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat(currentTag(), { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function dateParts(iso: string): { dow: string; day: string; month: string } {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(currentTag(), { ...o, timeZone: TZ }).format(d);
  return { dow: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

export function relDays(days: number): string {
  const t = tNow("time");
  if (days === 0) return t("Today");
  if (days === 1) return t("Tomorrow");
  if (days === -1) return t("Yesterday");
  return days < 0 ? t("DaysAgo", { n: -days }) : t("InDays", { n: days });
}

export function ago(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  const t = tNow("time");
  if (s < 60) return t("justNow");
  if (s < 3600) return t("minAgo", { n: Math.floor(s / 60) });
  if (s < 86400) return t("hAgo", { n: Math.floor(s / 3600) });
  if (s < 86400 * 7) return t("dAgo", { n: Math.floor(s / 86400) });
  return new Intl.DateTimeFormat(currentTag(), { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
}

export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  const t = tNow("time");
  return h < 5 ? t("evening") : h < 12 ? t("morning") : h < 18 ? t("afternoon") : t("evening");
}

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || tNow("time")("there");

const STAGES = ["just_arrived", "preparing_application", "filed", "waiting_decision", "decision_received"];
const PERMITS = ["temporary_residence_study", "temporary_residence_work", "other", "temporary_residence_blue_card", "temporary_residence_family"];

/** Case stage in the interface language ("" for an unknown stage). */
export const stageLabel = (stage: string | null | undefined): string =>
  stage && STAGES.includes(stage) ? tNow("time")(`stage_${stage}`) : "";

/** Permit type in the interface language; "Residence case" when unknown. */
export const permitLabel = (permit: string | null | undefined): string =>
  tNow("time")(`permit_${permit && PERMITS.includes(permit) ? permit : "other"}`);
