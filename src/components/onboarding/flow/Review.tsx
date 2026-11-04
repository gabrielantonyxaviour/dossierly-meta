"use client";
import { useMemo, useState } from "react";
import { CheckCircle, Switch } from "@/components/ui";
import type { CalendarResult } from "@/lib/onboarding/commit";
import type { Finding, MailReading } from "@/lib/onboarding/findings";
import type { InboxMessage } from "@/lib/onboarding/inbox";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import type { Profile } from "@/lib/case/types";
import { Button, StickyActionBar } from "@/components/ui";
import { StageHint, suggestedStage } from "./StageHint";
import { mergeDocuments } from "@/lib/onboarding/merge";
import { HowCounted, rowFor } from "./FoundRow";

const keyOf = (f: Finding) =>
  f.kind === "fact" ? `fact:${f.key}` : f.kind === "appointment" ? `apt:${f.date}:${f.time}` : f.kind === "deadline" ? `ddl:${f.dueDate}:${f.title.toLowerCase()}`
  : `${f.kind}:${f.title.toLowerCase().replace(/\W+/g, " ").trim()}`;

/** One list across emails: one document per kind (a copy beats a request), the newest email wins other duplicates. */
function merge(readings: MailReading[]): Finding[] {
  const all = readings.flatMap((r) => r.findings).sort((a, b) => b.source.receivedAt.localeCompare(a.source.receivedAt));
  const seen = new Map<string, Finding>();
  for (const f of all) if (f.kind !== "document" && !seen.has(keyOf(f))) seen.set(keyOf(f), f);
  return [...seen.values(), ...mergeDocuments(all)];
}

const DOC_ORDER = ["rental_agreement", "health_insurance", "university_certificate", "passport", "photo"];
/** The headline list ("Found in your inbox") and everything else that is saved with it. */
function split(findings: Finding[]) {
  const main: Finding[] = [], more: Finding[] = [];
  const docRank = (f: Finding) => (f.kind !== "document" ? 99 : (f.status === "have" ? 0 : 10) + Math.max(0, DOC_ORDER.indexOf(f.docKind)));
  for (const f of findings) {
    const headline = (f.kind === "fact" && f.key === "caseNumber") || f.kind === "deadline" || f.kind === "appointment" || (f.kind === "document" && f.docKind !== "upo" && f.docKind !== "other" && f.docKind !== "letter");
    (headline ? main : more).push(f);
  }
  const order = (f: Finding) => (f.kind === "fact" ? 0 : f.kind === "deadline" ? 1 : f.kind === "appointment" ? 2 : 3);
  main.sort((a, b) => order(a) - order(b) || docRank(a) - docRank(b));
  more.sort((a, b) => order(a) - order(b));
  return { main, more };
}

export function Review({ readings, rows, calendarConnected, onSaved, onShowResult, stage, applyStage }: { onShowResult(): void; readings: MailReading[]; rows: InboxMessage[]; calendarConnected: boolean; onSaved(calendarAdded: boolean, saved: number): void; stage: Profile["stage"]; applyStage(s: Profile["stage"]): Promise<boolean> }) {
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
    setHint(next); setResult(r.data.calendar); onShowResult();
  }

  if (result) {
    const added = result.filter((x) => x.status !== "failed");
    return (
      <div className="ob-answer">
        <div className="ob-note ob-note-ok"><strong>Saved to your case{added.length ? ` and ${added.length} ${added.length === 1 ? "date" : "dates"} added to Google Calendar` : ""}.</strong>{added.length > 0 && <p>Reminders are set for the day before and a few days ahead of each deadline.</p>}</div>
        {hint && <StageHint hint={hint} apply={applyStage} auto={stage === "just_arrived"} />}
        {result.length > 0 && <ul className="ob-cal">{result.map((x) => (
          <li key={x.findingId} data-status={x.status}><span>{x.title}</span>{x.status === "failed" ? <em>{x.error}</em> : x.url ? <a href={x.url} target="_blank" rel="noreferrer">Open in Calendar</a> : <em>Added</em>}</li>
        ))}</ul>}
        <StickyActionBar><Button variant="primary" size="lg" onClick={() => onSaved(added.length > 0, chosen.length)}>Continue</Button></StickyActionBar>
      </div>
    );
  }
  const { main, more } = split(findings);
  const list = (items: Finding[], small = false) => (
    <ul className="ob-found" data-small={small || undefined}>{items.map((f) => {
      const r = rowFor(f);
      return (
        <li key={f.id} className="ob-find" data-off={off.has(f.id)} onClick={(e) => { if (!(e.target as HTMLElement).closest("details, a, button")) toggle(f.id, off.has(f.id)); }}>
          <CheckCircle checked={!off.has(f.id)} onChange={(on) => toggle(f.id, on)} label={`Keep ${r.label}`} />
          <div className="ob-find-body">
            <div className="ob-find-head"><strong>{r.label}</strong>{r.tag && <span className="ob-tag" data-tone={r.tag.tone}>{r.tag.text}</span>}</div>
            {r.value && <span className="ob-find-value">{r.value}</span>}
            <HowCounted f={f} />
          </div>
        </li>
      );
    })}</ul>
  );
  return (
    <div className="ob-answer">
      {list(main)}
      {more.length > 0 && <section className="ob-find-group"><h2>Also saved</h2>{list(more, true)}</section>}
      {calendarConnected ? (
        <label className="ob-cal-toggle"><span><strong>Add {dated} {dated === 1 ? "date" : "dates"} to Google Calendar</strong><small>With reminders before each one</small></span><Switch checked={toCalendar && dated > 0} onChange={setToCalendar} disabled={!dated} label="Add dates to Google Calendar" /></label>
      ) : <p className="ob-more-note">Connect Google Calendar on the previous screen to add these dates with reminders.</p>}
      {error && <div className="ob-alert" role="alert"><p>{error}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void save()}>Try again</button></div>}
      <StickyActionBar>
        <Button variant="primary" size="lg" disabled={busy || !chosen.length} loading={busy} onClick={() => void save()}>
          {busy ? "Saving to your case…" : `Save ${chosen.length} ${chosen.length === 1 ? "item" : "items"} to my case`}
        </Button>
      </StickyActionBar>
    </div>
  );
}
