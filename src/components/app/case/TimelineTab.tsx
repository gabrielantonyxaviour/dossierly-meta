"use client";
import { useEffect } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { EmptyState, Pill } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { eventIcon } from "../home/HomeSections";
import { eventTitle } from "../notifications/derive";
import { timeLabel } from "../format";

const TONE: Record<string, string> = { call: "agent", email_received: "official", letter_read: "official", deadline_created: "deadline", counter_session: "user" };

function monthKey(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/Warsaw" }).format(new Date(iso));
}
function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Warsaw" }).format(new Date(iso));
}

/** Everything that happened in the case, newest first, grouped by month. Refs link to documents/deadlines. */
export function TimelineTab({ c }: { c: CaseSnapshot }) {
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  if (!c.events.length) return <EmptyState icon="clock" title="Your timeline starts here">Emails, letters, calls and counter sessions appear here as they happen.</EmptyState>;
  const events = [...c.events].sort((a, b) => b.at.localeCompare(a.at));
  const groups: { month: string; items: typeof events }[] = [];
  for (const e of events) {
    const m = monthKey(e.at);
    if (groups.at(-1)?.month !== m) groups.push({ month: m, items: [] });
    groups.at(-1)!.items.push(e);
  }
  const docs = new Map(c.documents.map((d) => [d.id, d]));
  const dls = new Map(c.deadlines.map((d) => [d.id, d]));
  return (
    <div className="tl">
      {groups.map((g) => (
        <section key={g.month} className="tl-group" aria-label={g.month}>
          <h3 className="ui-eyebrow">{g.month}</h3>
          <ol className="tl-list">
            {g.items.map((e) => (
              <li key={e.id} id={e.id} className={`tl-item tl--${TONE[e.type] ?? "neutral"}`}>
                <span className="tl-icon"><Icon name={eventIcon(e.type)} size={16} /></span>
                <div className="tl-body">
                  <div className="tl-meta"><b>{eventTitle(e.type)}</b><span className="ui-num">{dayKey(e.at)} · {timeLabel(e.at)}</span></div>
                  <p>{e.summary}</p>
                  {e.refs.length > 0 && (
                    <div className="tl-refs">
                      {e.refs.map((r) => docs.get(r) ? <a key={r} href={`/app/case/documents/${r}`}><Pill icon="file">{docs.get(r)!.title}</Pill></a>
                        : dls.get(r) ? <a key={r} href={`/app/case/deadlines/${r}`}><Pill icon="clock" tone="deadline">{dls.get(r)!.title}</Pill></a> : null)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
