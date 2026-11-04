import { daysBetween, warsawDate, warsawToday } from "../case/next-step";
import type { Finding } from "../onboarding/findings";
import { warsawIso } from "../onboarding/time";
import { sha256Hex } from "../server/util";

/* Pure builders for the agreed data contract: (a) letter doc, (b) deadline, (c) draft docs, (d) event. */

export const URGENT_DEADLINE_DAYS = 30;
export const URGENT_APPOINTMENT_DAYS = 14;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function stableDocId(prefix: string, messageId: string, part = ""): Promise<string> {
  return `${prefix}_${(await sha256Hex(`dossierly-watch:${messageId}:${part}`)).slice(0, 24)}`;
}
type Of<K extends Finding["kind"]> = Extract<Finding, { kind: K }>;
export const deadlineOf = (fs: Finding[]) => fs.find((f): f is Of<"deadline"> => f.kind === "deadline");
export const requestedDoc = (fs: Finding[]) => fs.find((f): f is Of<"document"> => f.kind === "document" && f.status === "requested");
export const eventId = (messageId: string) => `evt_${messageId}`.slice(0, 64);

export type Draft = { kind: "reply" | "institution"; title: string; to: string; subject: string; body: string; language: "pl" | "en" };
export const DRAFT_TITLES = { reply: "Reply to the office", institution: "Request to the dean’s office" } as const;

/** Tomorrow 09:00 Warsaw wall-clock, as an ISO timestamp with the right offset. */
export function tomorrowNine(now: Date): string {
  const d = new Date(`${warsawToday(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return warsawIso(d.toISOString().slice(0, 10), "09:00");
}

export const asksOf = (findings: Finding[]): string => clip(findings.flatMap((f) => (f.kind === "deadline" ? [f.title] : f.kind === "document" && f.status === "requested" ? [f.title] : f.kind === "task" ? [f.title] : [])).join("; "), 1000);

/** A letter is actionable when it asks the person to do or send something. */
export const isActionable = (findings: Finding[]) => findings.some((f) => f.kind === "deadline" || f.kind === "task" || (f.kind === "document" && f.status === "requested"));

export function urgency(findings: Finding[], now: Date): { urgent: boolean; dueDate: string | null; deadlineId: string | null } {
  const today = warsawToday(now);
  const dl = deadlineOf(findings);
  const apt = findings.find((f): f is Of<"appointment"> => f.kind === "appointment");
  const dlUrgent = !!dl && daysBetween(today, dl.dueDate) <= URGENT_DEADLINE_DAYS;
  const aptUrgent = !!apt && daysBetween(today, apt.date) >= 0 && daysBetween(today, apt.date) <= URGENT_APPOINTMENT_DAYS;
  return {
    urgent: dlUrgent || aptUrgent,
    dueDate: dlUrgent && dl ? dl.dueDate : aptUrgent && apt ? apt.date : null,
    deadlineId: dl?.id ?? null,
  };
}

export function letterDoc(a: { id: string; title: string; msg: { receivedAt: string; from: string; subject: string }; sender: string; asks: string }) {
  return {
    id: a.id, kind: "letter", source: "email", status: "have", title: clip(a.title, 200),
    extractedFields: { received: warsawDate(a.msg.receivedAt), asks: a.asks, sender: clip(a.sender || a.msg.from, 300), subject: clip(a.msg.subject, 300) },
  };
}

export function draftDoc(id: string, d: Draft, letterId: string) {
  return {
    id, kind: "letter", source: "agent", status: "have", title: d.title,
    extractedFields: { draft: clip(d.body, 1000), to: clip(d.to, 300), language: d.language, subject: clip(d.subject, 300), triggeredBy: letterId },
  };
}

export const deadlinePatch = (letterId: string, now: Date, call: boolean) => ({
  triggeredBy: letterId,
  reminders: [{ at: tomorrowNine(now), channel: call ? "call" : "in_app", sentAt: null }],
});
