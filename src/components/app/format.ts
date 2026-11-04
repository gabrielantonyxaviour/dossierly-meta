/* Date/time formatting for case data. Case dates are Europe/Warsaw calendar days. */
const TZ = "Europe/Warsaw";

export function dayLabel(isoDate: string, opts: { year?: boolean } = {}): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", ...(opts.year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(d);
}

export function longDay(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function dateParts(iso: string): { dow: string; day: string; month: string } {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: TZ }).format(d);
  return { dow: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

export function relDays(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days < 0 ? `${-days} days ago` : `In ${days} days`;
}

export function ago(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
}

export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";

export const STAGE_LABEL: Record<string, string> = {
  just_arrived: "Just arrived",
  preparing_application: "Preparing application",
  filed: "Application filed",
  waiting_decision: "Waiting for decision",
  decision_received: "Decision received",
};
export const PERMIT_LABEL: Record<string, string> = {
  temporary_residence_study: "Temporary residence · studies",
  temporary_residence_work: "Temporary residence · work",
  other: "Residence case",
};
