"use client";
import { useMemo, useState } from "react";
import { CheckCircle, Switch } from "@/components/ui";
import type { CalendarResult } from "@/lib/onboarding/commit";
import type { Finding, MailReading } from "@/lib/onboarding/findings";
import type { InboxMessage } from "@/lib/onboarding/inbox";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import type { Profile } from "@/lib/case/types";
import { StageHint, suggestedStage } from "./StageHint";

const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
const daysLeft = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${warsawToday()}T00:00:00Z`)) / 86_400_000);
const keyOf = (f: Finding) =>
  f.kind === "fact" ? `fact:${f.key}` : f.kind === "appointment" ? `apt:${f.date}:${f.time}` : f.kind === "deadline" ? `ddl:${f.dueDate}:${f.title.toLowerCase()}`
  : f.kind === "document" && f.docKind !== "other" && f.docKind !== "letter" ? `document:${f.docKind}`
  : `${f.kind}:${f.title.toLowerCase().replace(/\W+/g, " ").trim()}`;

/** One list across emails: the newest email wins a duplicate (same fact, same appointment, same document). */
function merge(readings: MailReading[]): Finding[] {
  const all = readings.flatMap((r) => r.findings).sort((a, b) => b.source.receivedAt.localeCompare(a.source.receivedAt));
  const seen = new Map<string, Finding>();
  for (const f of all) if (!seen.has(keyOf(f))) seen.set(keyOf(f), f);
  return [...seen.values()];
}

function Source({ f }: { f: Finding }) {
  const subject = f.source.subject.replace(/\s+[—–-]\s+[A-Z]{2,}-[\w./-]+$/, "");
  return <span className="ob-src">From “{subject.length > 64 ? `${subject.slice(0, 63)}…` : subject}” · {dayLabel(f.source.receivedAt.slice(0, 10), { day: "numeric", month: "short" })}</span>;
}

function Item({ f }: { f: Finding }) {
  if (f.kind === "appointment") return (
    <div className="ob-find-body">
      <span className="ob-find-when">{dayLabel(f.date)}{f.time ? ` · ${f.time}` : ""}</span>
      <strong>{f.title}</strong>
      {(f.place || f.address) && <span>{[f.place, f.address].filter(Boolean).join(", ")}</span>}
      {f.bring.length > 0 && <span className="ob-find-bring">Bring: {f.bring.join(", ")}</span>}
      <Source f={f} />
    </div>
  );
  if (f.kind === "deadline") {
    const left = daysLeft(f.dueDate);
    return (
      <div className="ob-find-body">
        <span className="ob-find-when" data-urgent={left <= 7}>{dayLabel(f.dueDate)} · {left < 0 ? `${-left} days ago` : left === 0 ? "today" : `${left} days left`}</span>
        <strong>{f.title}</strong>
        {f.consequence && <span className="ob-find-warn">If missed: {f.consequence}</span>}
        <details className="ob-how"><summary>How I counted</summary>{f.quote && <blockquote lang="pl">{f.quote}</blockquote>}<ol>{f.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></details>
        <Source f={f} />
      </div>
    );
  }
  if (f.kind === "fact") return <div className="ob-find-body ob-find-fact"><span>{f.label}</span><strong>{f.value}</strong><Source f={f} /></div>;
  if (f.kind === "document") return <div className="ob-find-body"><strong>{f.title}</strong><span>{f.status === "requested" ? "Asked for by the office" : f.status === "have" ? "Confirmed received" : "Missing"}</span><Source f={f} /></div>;
  return <div className="ob-find-body"><strong>{f.title}</strong>{f.detail && <span>{f.detail}</span>}<Source f={f} /></div>;
}

const SECTIONS: { kind: Finding["kind"]; title: string }[] = [
  { kind: "deadline", title: "Deadlines" }, { kind: "appointment", title: "Appointments" }, { kind: "fact", title: "Your case" },
  { kind: "document", title: "Documents mentioned" }, { kind: "task", title: "To do" },
];

export function Review({ readings, rows, calendarConnected, onSaved, stage, applyStage }: { readings: MailReading[]; rows: InboxMessage[]; calendarConnected: boolean; onSaved(calendarAdded: boolean, saved: number): void; stage: Profile["stage"]; applyStage(s: Profile["stage"]): Promise<boolean> }) {
  const findings = useMemo(() => merge(readings), [readings]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [toCalendar, setToCalendar] = useState(calendarConnected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CalendarResult[] | null>(null);
  const [hint, setHint] = useState<ReturnType<typeof suggestedStage>>(null);
  const chosen = findings.filter((f) => !off.has(f.id));
  const dated = chosen.filter((f) => f.kind === "deadline" || f.kind === "appointment").length;
  const toggle = (id: string, on: boolean) => setOff((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });

  async function save() {
    setBusy(true); setError("");
    const received = new Map(rows.map((r) => [r.id, r.receivedAt]));
    const summaries = readings.filter((r) => r.summary).map((r) => ({ messageId: r.messageId, summary: r.summary.slice(0, 600), receivedAt: received.get(r.messageId) ?? new Date().toISOString() }));
    const r = await flowApi.commit({ findings: chosen, summaries, addToCalendar: toCalendar && dated > 0 });
    setBusy(false);
    if (!r.ok) { setError(failure(r) ?? "Could not save."); return; }
    const next = suggestedStage(chosen, stage);
    if (!r.data.calendar.length && !next) { onSaved(false, chosen.length); return; }
    setHint(next); setResult(r.data.calendar);
  }

  if (result) {
    const added = result.filter((x) => x.status !== "failed");
    return (
      <div className="ob-answer">
        <div className="ob-note ob-note-ok"><strong>Saved to your case{added.length ? ` and ${added.length} ${added.length === 1 ? "date" : "dates"} added to Google Calendar` : ""}.</strong>{added.length > 0 && <p>Reminders are set for the day before and a few days ahead of each deadline.</p>}</div>
        {hint && <StageHint hint={hint} apply={applyStage} />}
        {result.length > 0 && <ul className="ob-cal">{result.map((x) => (
          <li key={x.findingId} data-status={x.status}><span>{x.title}</span>{x.status === "failed" ? <em>{x.error}</em> : x.url ? <a href={x.url} target="_blank" rel="noreferrer">Open in Calendar</a> : <em>Added</em>}</li>
        ))}</ul>}
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" onClick={() => onSaved(added.length > 0, chosen.length)}>Continue</button>
      </div>
    );
  }
  return (
    <div className="ob-answer">
      {SECTIONS.map((s) => {
        const items = findings.filter((f) => f.kind === s.kind);
        if (!items.length) return null;
        return (
          <section key={s.kind} className="ob-find-group" data-kind={s.kind}>
            <h2>{s.title}</h2>
            <ul>{items.map((f) => (
              <li key={f.id} className="ob-find" data-off={off.has(f.id)}>
                <CheckCircle checked={!off.has(f.id)} onChange={(on) => toggle(f.id, on)} label={`Keep ${"title" in f ? f.title : f.label}`} /><Item f={f} />
              </li>
            ))}</ul>
          </section>
        );
      })}
      <div className="ob-commit">
        {calendarConnected ? (
          <div className="ob-cal-toggle"><span>Add {dated} {dated === 1 ? "date" : "dates"} to Google Calendar, with reminders</span><Switch checked={toCalendar && dated > 0} onChange={setToCalendar} disabled={!dated} label="Add dates to Google Calendar" /></div>
        ) : <p className="ob-more-note">Connect Google Calendar on the previous screen to add these dates with reminders.</p>}
        {error && <div className="ob-alert" role="alert"><p>{error}</p></div>}
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={busy || !chosen.length} onClick={() => void save()}>
          {busy ? "Saving to your case…" : `Confirm ${chosen.length} ${chosen.length === 1 ? "item" : "items"}`}
        </button>
        <p className="ob-more-note">Unticked items are not saved. You can edit anything later.</p>
      </div>
    </div>
  );
}
