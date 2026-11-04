import type { CaseDocument, CaseEvent, CaseSnapshot, Deadline as CaseDeadline } from "@/lib/case/types";

/*
 * "Ready for you": what the 24/7 agent prepared after a new official letter arrived. Reads the agreed contract only:
 * (a) letter = documents {kind:'letter', source:'email'}; (b) deadline {triggeredBy: letterId, reminders};
 * (c) drafts = documents {source:'agent', extractedFields.draft, extractedFields.triggeredBy: letterId};
 * (d) events 'email_received' (refs letter) and 'call' (refs deadline/drafts).
 */

export type Draft = { doc: CaseDocument; text: string; to: string | null; language: "pl" | "en" | string; subject: string | null };
export type ReadyBundle = {
  letter: CaseDocument;
  arrivedAt: string;
  deadline: CaseDeadline | null;
  drafts: Draft[];
  reminder: { at: string; channel: string } | null;
  arrival: CaseEvent | null;
  call: CaseEvent | null;
};

const isDraft = (d: CaseDocument) => d.source === "agent" && typeof d.extractedFields.draft === "string" && d.extractedFields.draft.trim().length > 0;

function bundleFor(c: CaseSnapshot, letter: CaseDocument, now: Date): ReadyBundle | null {
  const drafts = c.documents.filter((d) => isDraft(d) && d.extractedFields.triggeredBy === letter.id);
  const deadline = c.deadlines.find((d) => d.triggeredBy === letter.id) ?? null;
  if (!drafts.length && !deadline?.reminders.length) return null;
  const arrival = c.events.filter((e) => e.type === "email_received" && e.refs.includes(letter.id)).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const linked = new Set([letter.id, ...(deadline ? [deadline.id] : []), ...drafts.map((d) => d.id)]);
  const call = c.events.filter((e) => e.type === "call" && e.refs.some((r) => linked.has(r))).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const pending = (deadline?.reminders ?? []).filter((r) => !r.sentAt && new Date(r.at).getTime() > now.getTime() - 3600_000).sort((a, b) => a.at.localeCompare(b.at))[0];
  return {
    letter,
    arrivedAt: arrival?.at ?? letter.createdAt,
    deadline,
    drafts: drafts.map((doc) => ({
      doc,
      text: doc.extractedFields.draft.trim(),
      to: doc.extractedFields.to?.trim() || null,
      language: (doc.extractedFields.language ?? "").toLowerCase(),
      subject: doc.extractedFields.subject?.trim() || null,
    })),
    reminder: pending ? { at: pending.at, channel: pending.channel } : null,
    arrival,
    call,
  };
}

/** The most recent letter the agent prepared something for, or null. */
export function latestReady(c: CaseSnapshot, now = new Date()): ReadyBundle | null {
  const letters = c.documents.filter((d) => d.kind === "letter" && d.source === "email");
  const bundles = letters.map((l) => bundleFor(c, l, now)).filter((b): b is ReadyBundle => !!b);
  return bundles.sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt))[0] ?? null;
}

/** Fresh enough to feature on Home: arrived in the last 3 days and its deadline (if any) is still open. */
export function isFresh(b: ReadyBundle, now = new Date()): boolean {
  return now.getTime() - new Date(b.arrivedAt).getTime() < 3 * 86_400_000 && (!b.deadline || b.deadline.status === "open");
}

export const LANG_LABEL: Record<string, string> = { pl: "Polish", en: "English" };
export const CHANNEL_LABEL: Record<string, string> = { call: "Dossierly will call you", push: "Notification on your phone", in_app: "Reminder in the app", email: "Email reminder" };
