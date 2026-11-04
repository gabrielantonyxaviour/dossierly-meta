"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MailReading } from "@/lib/onboarding/findings";
import type { InboxMessage } from "@/lib/onboarding/inbox";
import { failure, flowApi, type ConnectionStatus } from "@/lib/client/onboarding-flow";
import type { Profile } from "@/lib/case/types";
import { ConnectCards } from "./ConnectCards";
import { Button, StickyActionBar } from "@/components/ui";
import { Review } from "./Review";

type Row = { msg: InboxMessage; state: "queued" | "reading" | "done" | "error"; reading?: MailReading; error?: string };
export type InboxPhase = "connect" | "listing" | "reading" | "review" | "empty" | "saved";
type Phase = Exclude<InboxPhase, "saved">;

const CHAIN = "ob-google-chain";
const chained = () => { try { return sessionStorage.getItem(CHAIN) === "1"; } catch { return false; } };
const chain = (on: boolean) => { try { if (on) sessionStorage.setItem(CHAIN, "1"); else sessionStorage.removeItem(CHAIN); } catch { /* private mode */ } };

export function InboxStep({ onDone, onSkip, setCalendarAdded, returned, stage, applyStage, onPhase, auto }: { auto: boolean; onPhase(p: InboxPhase): void; returned: string | null; stage: Profile["stage"]; applyStage(s: Profile["stage"]): Promise<boolean>; onDone(saved: number): void; onSkip(): void; setCalendarAdded(v: boolean): void }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [phase, setPhase] = useState<Phase>("connect");
  const [rows, setRows] = useState<Row[]>([]);
  const [account, setAccount] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<"" | "mail" | "calendar">("");
  const started = useRef(false);
  useEffect(() => { onPhase(phase === "listing" ? "connect" : phase); }, [phase, onPhase]);

  const load = useCallback(async () => {
    setStatusError("");
    const r = await flowApi.connections();
    if (r.ok) setStatus(r.data); else setStatusError(failure(r) ?? "");
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one status fetch on mount
  useEffect(() => { void load(); }, [load]);

  const patch = (id: string, next: Partial<Row>) => setRows((rs) => rs.map((r) => (r.msg.id === id ? { ...r, ...next } : r)));
  async function readOne(msg: InboxMessage, fresh = false) {
    patch(msg.id, { state: "reading", error: undefined });
    const r = await flowApi.read(msg.id, fresh);
    if (r.ok) patch(msg.id, { state: "done", reading: r.data });
    else patch(msg.id, { state: "error", error: failure(r) ?? "Could not read this email." });
  }
  async function scan() {
    setError(""); setPhase("listing");
    const r = await flowApi.inbox();
    if (!r.ok) { setError(failure(r) ?? ""); setPhase("connect"); return; }
    setAccount(r.data.account);
    if (!r.data.messages.length) { setPhase("empty"); return; }
    const list = r.data.messages.map((msg): Row => ({ msg, state: "queued" }));
    setRows(list); setPhase("reading");
    const queue = [...list.map((x) => x.msg)];
    await Promise.all(Array.from({ length: 4 }, async () => { for (let m = queue.shift(); m; m = queue.shift()) await readOne(m); }));
  }

  /** Google consent, Gmail first then Calendar: one "yes" and two Allow taps, nothing typed. */
  async function google(category: "mail" | "calendar") {
    setOpening(category); setError("");
    const r = await flowApi.connect(category, category === "mail" ? "gmail" : "googlecalendar");
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    chain(false); setOpening(""); setError(failure(r) ?? "Could not open Google.");
  }

  const gmail = status?.connections.mail?.provider === "gmail" && status.connections.mail.status === "connected";
  const calendar = status?.connections.calendar?.provider === "googlecalendar" && status.connections.calendar.status === "connected";
  // Voice "yes" → Gmail consent → Calendar consent → back here with both: start reading straight away.
  useEffect(() => {
    if (!status || started.current || phase !== "connect") return;
    if (returned === "failed") { chain(false); return; }
    const going = auto || chained();
    started.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- one hand-off per visit: open the next consent or start the read */
    if (going && !gmail) void google("mail");
    else if (going && gmail && !calendar) void google("calendar");
    else if (gmail && calendar && (going || returned === "connected")) {
      chain(false);
      window.history.replaceState(null, "", "/onboarding");
      void scan();
    } else started.current = false;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = rows.filter((r) => r.state === "done" || r.state === "error").length;
  const finished = phase === "reading" && rows.length > 0 && done === rows.length;
  const found = rows.some((r) => r.reading?.relevant);
  const failedAny = rows.some((r) => r.state === "error");
  // Everything read and something found: show it after a beat, no tap needed. A failed email keeps the retry in view.
  useEffect(() => {
    if (!finished || !found || failedAny) return;
    const t = setTimeout(() => setPhase("review"), 1400);
    return () => clearTimeout(t);
  }, [finished, found, failedAny]);

  if (phase === "connect" || phase === "listing") {
    return (
      <div className="ob-answer">
        {statusError && <div className="ob-alert" role="alert"><p>{statusError}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void load()}>Try again</button></div>}
        <ConnectCards status={status} gmail={gmail} calendar={calendar} returned={returned} />
        {error && <div className="ob-alert" role="alert"><p>{error}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void scan()}>Try again</button></div>}
        <StickyActionBar secondary={<Button variant="ghost" onClick={() => { chain(false); onSkip(); }}>Skip for now</Button>}>
          {gmail ? (
            <Button variant="primary" size="lg" disabled={phase === "listing" || !!opening} loading={phase === "listing" || !!opening} onClick={() => { started.current = true; void scan(); }}>
              {opening === "calendar" ? "Opening Google Calendar…" : phase === "listing" ? "Looking for official emails…" : "Read my official emails"}
            </Button>
          ) : (
            <Button variant="primary" size="lg" disabled={!status || !!opening} loading={!!opening} onClick={() => { chain(true); started.current = true; void google("mail"); }}>
              {opening ? "Opening Google…" : "Connect Google"}
            </Button>
          )}
        </StickyActionBar>
      </div>
    );
  }
  if (phase === "empty") {
    return (
      <div className="ob-answer">
        <div className="ob-note"><strong>No official emails in {account || "your inbox"} from the last 120 days.</strong><p>You can add a photo of a letter any time in Look.</p></div>
        <StickyActionBar secondary={<Button variant="ghost" onClick={() => void scan()}>Check again</Button>}>
          <Button variant="primary" size="lg" onClick={onSkip}>Continue</Button>
        </StickyActionBar>
      </div>
    );
  }
  if (phase === "review") {
    const readings = rows.flatMap((r) => (r.reading?.relevant ? [r.reading] : []));
    return <Review readings={readings} rows={rows.map((r) => r.msg)} calendarConnected={calendar} stage={stage} applyStage={applyStage} onShowResult={() => onPhase("saved")} onSaved={(added, saved) => { setCalendarAdded(added); onDone(saved); }} />;
  }
  const relevant = rows.filter((r) => r.reading?.relevant).length;
  return (
    <div className="ob-answer">
      <p className="ob-progress-line" aria-live="polite">{finished ? `Read ${rows.length} emails · ${relevant} about your case` : `Reading ${Math.min(done + 1, rows.length)} of ${rows.length}…`}</p>
      <ol className="ob-mail">
        {rows.map((r) => (
          <li key={r.msg.id} className="ob-mail-row" data-state={r.state} data-relevant={r.reading?.relevant ? "yes" : r.state === "done" ? "no" : undefined}>
            <span className="ob-mail-icon" aria-hidden="true" />
            <span className="ob-mail-text">
              <strong>{r.msg.subject}</strong>
              <span>{r.reading?.relevant ? r.reading.summary : r.state === "done" ? "Not about your case" : r.state === "error" ? r.error : sender(r.msg.from)}</span>
            </span>
            {r.state === "error" ? <button type="button" className="ui-btn ui-btn--sm" onClick={() => void readOne(r.msg, true)}>Retry</button>
              : <span className="ob-mail-state">{r.state === "reading" ? "Reading" : r.state === "queued" ? "Waiting" : r.reading?.relevant ? `${r.reading.findings.length} found` : "Skipped"}</span>}
          </li>
        ))}
      </ol>
      {finished && !relevant && <div className="ob-note"><strong>None of these are about your residence case.</strong><p>I’ll keep an eye out for new official mail.</p></div>}
      <StickyActionBar>
        {finished && !relevant
          ? <Button variant="primary" size="lg" onClick={onSkip}>Continue</Button>
          : <Button variant="primary" size="lg" disabled={!finished} loading={!finished} onClick={() => setPhase("review")}>{finished ? "Review what I found" : `Reading ${Math.min(done + 1, rows.length)} of ${rows.length}…`}</Button>}
      </StickyActionBar>
    </div>
  );
}

const sender = (from: string) => from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || from;
