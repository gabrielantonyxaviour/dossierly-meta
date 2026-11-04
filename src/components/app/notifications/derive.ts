import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import type { IconName } from "@/components/Icon";
import { latestReady } from "../ready/derive";

const short = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/* In-app notifications are derived from the case itself: nothing is invented, every item links to its source. */
export type Notice = { id: string; at: string; icon: IconName; tone: "deadline" | "official" | "agent" | "neutral" | "ok"; title: string; body: string; href: string; /** Replaces the "x ago" label for dated items. */ when?: string };

const EVENT_ICON: Record<string, IconName> = { email_received: "mail", letter_read: "letter", call: "phone", counter_session: "counter", deadline_created: "clock", document_added: "file", note: "info" };

export function deriveNotices(c: CaseSnapshot, now = new Date()): Notice[] {
  const today = warsawToday(now);
  const out: Notice[] = [];
  for (const d of c.deadlines.filter((d) => d.status === "open")) {
    const left = daysBetween(today, d.dueDate);
    if (left > 14) continue;
    out.push({
      id: `dl:${d.id}:${left < 0 ? "over" : left <= 3 ? "soon" : "upcoming"}`, at: `${today}T00:00:02Z`, when: `Due ${short(d.dueDate)}`, icon: "clock", tone: left <= 7 ? "deadline" : "neutral",
      title: left < 0 ? `Overdue: ${d.title}` : left === 0 ? `Due today: ${d.title}` : `${left} day${left === 1 ? "" : "s"} left: ${d.title}`,
      body: d.computation.rule ? `Counted under ${d.computation.rule}. Tap to see how.` : "Tap to see how the date was counted.", href: `/app/case/deadlines/${d.id}`,
    });
  }
  for (const a of c.appointments) {
    const left = daysBetween(today, warsawDate(a.at));
    if (left < 0 || left > 14) continue;
    out.push({ id: `ap:${a.id}`, at: `${today}T00:00:01Z`, when: `${short(warsawDate(a.at))}`, icon: "calendar", tone: "official", title: left === 0 ? `Today: ${a.title}` : `In ${left} day${left === 1 ? "" : "s"}: ${a.title}`, body: a.location.name, href: `/app/case?tab=dates` });
  }
  const weekAgo = new Date(now.getTime() - 10 * 86_400_000).toISOString();
  const ready = latestReady(c, now);
  const officeLetters = new Set(c.documents.filter((d) => d.kind === "letter" && d.source === "email").map((d) => d.id));
  for (const e of c.events.filter((e) => e.at >= weekAgo).slice(0, 12)) {
    // The 24/7 agent's findings: a new office letter, and the call it placed about it, open what it prepared.
    const isReady = !!ready && (e.id === ready.arrival?.id || e.id === ready.call?.id);
    const letter = e.type === "email_received" && e.refs.some((r) => officeLetters.has(r));
    const title = e.type === "call" && isReady ? "Dossierly called you" : letter ? "New letter from the office" : eventTitle(e.type);
    const body = isReady && e.type === "email_received" && ready ? `${e.summary}${ready.drafts.length ? ` Dossierly drafted ${ready.drafts.length === 1 ? "a reply" : `${ready.drafts.length} replies`} for you.` : ""}` : e.summary;
    out.push({ id: `ev:${e.id}`, at: e.at, icon: EVENT_ICON[e.type] ?? "info", tone: e.type === "call" ? "agent" : letter || e.type === "letter_read" ? "official" : "neutral", title, body, href: isReady ? "/app/ready" : `/app/case?tab=timeline#${e.id}` });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function eventTitle(type: string): string {
  return ({ email_received: "New email in your case", letter_read: "Letter read", call: "Call with Dossierly", counter_session: "Counter session", deadline_created: "New deadline counted", document_added: "Document added", note: "Case note" } as Record<string, string>)[type] ?? "Case update";
}

const KEY = "dossierly:notices-read";
export function readIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
export function markRead(ids: string[]) {
  try { const s = readIds(); ids.forEach((i) => s.add(i)); localStorage.setItem(KEY, JSON.stringify([...s].slice(-300))); window.dispatchEvent(new Event("dossierly:notices-read")); } catch { /* storage blocked: unread dots stay */ }
}
