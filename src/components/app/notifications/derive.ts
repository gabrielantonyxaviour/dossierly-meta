import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import type { IconName } from "@/components/Icon";
import { latestReady } from "../ready/derive";
import { currentTag, tNow } from "@/lib/i18n/current";
import type { T } from "@/lib/i18n/translate";

const short = (d: string, tag: string) => new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/* In-app notifications are derived from the case itself: nothing is invented, every item links to its source. */
export type Notice = { id: string; at: string; icon: IconName; tone: "deadline" | "official" | "agent" | "neutral" | "ok"; title: string; body: string; href: string; /** Replaces the "x ago" label for dated items. */ when?: string };

const EVENT_ICON: Record<string, IconName> = { email_received: "mail", letter_read: "letter", call: "phone", counter_session: "counter", deadline_created: "clock", document_added: "file", note: "info" };

/** `t` is the "notifications" translator and `tag` the Intl locale; both default to the current interface language. */
export function deriveNotices(c: CaseSnapshot, now = new Date(), t: T = tNow("notifications"), tag: string = currentTag()): Notice[] {
  const today = warsawToday(now);
  const out: Notice[] = [];
  for (const d of c.deadlines.filter((d) => d.status === "open")) {
    const left = daysBetween(today, d.dueDate);
    if (left > 14) continue;
    out.push({
      id: `dl:${d.id}:${left < 0 ? "over" : left <= 3 ? "soon" : "upcoming"}`, at: `${today}T00:00:02Z`, when: t("dueOn", { date: short(d.dueDate, tag) }), icon: "clock", tone: left <= 7 ? "deadline" : "neutral",
      title: left < 0 ? t("overdueT", { title: d.title }) : left === 0 ? t("dueTodayT", { title: d.title }) : left === 1 ? t("leftOne", { title: d.title }) : t("leftMany", { n: left, title: d.title }),
      body: d.computation.rule ? t("countedUnder", { rule: d.computation.rule }) : t("tapHow"), href: `/app/case/deadlines/${d.id}`,
    });
  }
  for (const a of c.appointments) {
    const left = daysBetween(today, warsawDate(a.at));
    if (left < 0 || left > 14) continue;
    out.push({ id: `ap:${a.id}`, at: `${today}T00:00:01Z`, when: short(warsawDate(a.at), tag), icon: "calendar", tone: "official", title: left === 0 ? t("apToday", { title: a.title }) : left === 1 ? t("apInOne", { title: a.title }) : t("apInMany", { n: left, title: a.title }), body: a.location.name, href: `/app/case?tab=dates` });
  }
  const weekAgo = new Date(now.getTime() - 10 * 86_400_000).toISOString();
  const ready = latestReady(c, now);
  const officeLetters = new Set(c.documents.filter((d) => d.kind === "letter" && d.source === "email").map((d) => d.id));
  for (const e of c.events.filter((e) => e.at >= weekAgo).slice(0, 12)) {
    // The 24/7 agent's findings: a new office letter, and the call it placed about it, open what it prepared.
    const isReady = !!ready && (e.id === ready.arrival?.id || e.id === ready.call?.id);
    const letter = e.type === "email_received" && e.refs.some((r) => officeLetters.has(r));
    const review = e.type === "note" && e.id.startsWith("ev-review-");
    const title = e.type === "call" && isReady ? t("called") : letter ? t("newLetter") : review ? t("reviewReady") : eventTitle(e.type, t);
    const body = isReady && e.type === "email_received" && ready && ready.drafts.length ? `${e.summary} ${ready.drafts.length === 1 ? t("draftedOne") : t("draftedMany", { n: ready.drafts.length })}` : e.summary;
    out.push({ id: `ev:${e.id}`, at: e.at, icon: EVENT_ICON[e.type] ?? "info", tone: e.type === "call" ? "agent" : letter || e.type === "letter_read" ? "official" : "neutral", title, body, href: isReady ? "/app/ready" : review ? "/app/case/review" : `/app/case?tab=timeline#${e.id}` });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

const EVENT_TYPES = ["email_received", "letter_read", "call", "counter_session", "deadline_created", "document_added", "note"];
/** `t` is the "notifications" translator. */
export function eventTitle(type: string, t: T = tNow("notifications")): string {
  return t(EVENT_TYPES.includes(type) ? `ev_${type}` : "ev_other");
}

const KEY = "dossierly:notices-read";
export function readIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
export function markRead(ids: string[]) {
  try { const s = readIds(); ids.forEach((i) => s.add(i)); localStorage.setItem(KEY, JSON.stringify([...s].slice(-300))); window.dispatchEvent(new Event("dossierly:notices-read")); } catch { /* storage blocked: unread dots stay */ }
}
