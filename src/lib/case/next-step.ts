import type { CaseSnapshot } from "./types";

export type NextStep = {
  kind: "deadline" | "appointment" | "task" | "document" | "stage";
  id: string | null;
  title: string;
  /** YYYY-MM-DD (Europe/Warsaw) when the item is dated. */
  date: string | null;
  /** Negative when overdue. */
  daysLeft: number | null;
  overdue: boolean;
  reason: string;
};

export function warsawToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function warsawDate(iso: string): string {
  return warsawToday(new Date(iso));
}

/** Wall-clock time in Warsaw ("10:30"), whatever offset the ISO timestamp was stored with. */
export function warsawTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const STAGE_HINT: Record<string, string> = {
  just_arrived: "Collect the documents for your residence application",
  preparing_application: "Finish preparing your application documents",
  filed: "Confirm your application was received (UPO) and note your case number",
  waiting_decision: "Check your case status and watch your mail for letters",
  decision_received: "Read your decision and note any appeal deadline",
};

/** Most urgent open item: dated items by date (overdue first), then undated tasks, missing documents, stage hint. */
export function nextStep(c: CaseSnapshot, now: Date = new Date()): NextStep | null {
  const today = warsawToday(now);
  const dated: NextStep[] = [];
  const mk = (kind: NextStep["kind"], id: string, title: string, date: string, reason: string): NextStep => {
    const daysLeft = daysBetween(today, date);
    return { kind, id, title, date, daysLeft, overdue: daysLeft < 0, reason };
  };
  const openDeadlines = new Map(c.deadlines.filter((d) => d.status === "open").map((d) => [d.id, d]));
  for (const d of openDeadlines.values()) dated.push(mk("deadline", d.id, d.title, d.dueDate, d.computation.rule ?? "Deadline"));
  for (const a of c.appointments) {
    const date = warsawDate(a.at);
    if (date >= today) dated.push(mk("appointment", a.id, a.title, date, a.purpose || "Appointment"));
  }
  const undated = [];
  for (const t of c.tasks.filter((t) => t.status === "open")) {
    const dl = t.dueDeadlineId ? openDeadlines.get(t.dueDeadlineId) : undefined;
    if (dl) dated.push(mk("task", t.id, t.title, dl.dueDate, `Needed for: ${dl.title}`));
    else undated.push(t);
  }
  // Same date: deadline before task before appointment (the deadline is what hurts).
  const rank = { deadline: 0, task: 1, appointment: 2, document: 3, stage: 4 } as const;
  dated.sort((a, b) => (a.date as string).localeCompare(b.date as string) || rank[a.kind] - rank[b.kind]);
  if (dated[0]) return dated[0];
  const t = undated[0];
  if (t) return { kind: "task", id: t.id, title: t.title, date: null, daysLeft: null, overdue: false, reason: t.detail || "Open task" };
  const doc = c.documents.find((d) => d.status !== "have");
  if (doc) return { kind: "document", id: doc.id, title: `Get: ${doc.title}`, date: null, daysLeft: null, overdue: false, reason: doc.status === "requested" ? "Requested, not yet received" : "Missing document" };
  const hint = STAGE_HINT[c.profile.stage];
  return hint ? { kind: "stage", id: null, title: hint, date: null, daysLeft: null, overdue: false, reason: `Stage: ${c.profile.stage}` } : null;
}
