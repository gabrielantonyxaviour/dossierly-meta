"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MailReading } from "@/lib/onboarding/findings";
import type { InboxMessage } from "@/lib/onboarding/inbox";
import { failure, flowApi, type ConnectionStatus } from "@/lib/client/onboarding-flow";
import { ConnectCards } from "./ConnectCards";
import { Review } from "./Review";

type Row = { msg: InboxMessage; state: "queued" | "reading" | "done" | "error"; reading?: MailReading; error?: string };
type Phase = "connect" | "listing" | "reading" | "review" | "empty";

export function InboxStep({ onDone, onSkip, setCalendarAdded, returned }: { returned: string | null; onDone(saved: number): void; onSkip(): void; setCalendarAdded(v: boolean): void }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [phase, setPhase] = useState<Phase>("connect");
  const [rows, setRows] = useState<Row[]>([]);
  const [account, setAccount] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);

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

  const gmail = status?.connections.mail?.provider === "gmail" && status.connections.mail.status === "connected";
  const calendar = status?.connections.calendar?.provider === "googlecalendar" && status.connections.calendar.status === "connected";
  // Back from Google with both connected: start reading straight away.
  useEffect(() => {
    if (!gmail || !calendar || started.current || phase !== "connect") return;
    if (returned === "connected") {
      started.current = true;
      window.history.replaceState(null, "", "/onboarding");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the async inbox read once
      void scan();
    }
  }, [gmail, calendar]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = rows.filter((r) => r.state === "done" || r.state === "error").length;
  const finished = phase === "reading" && rows.length > 0 && done === rows.length;

  if (phase === "connect" || phase === "listing") {
    return (
      <div className="ob-answer">
        {statusError && <div className="ob-alert" role="alert"><p>{statusError}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void load()}>Try again</button></div>}
        <ConnectCards status={status} gmail={gmail} calendar={calendar} returned={returned} />
        {error && <div className="ob-alert" role="alert"><p>{error}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void scan()}>Try again</button></div>}
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" disabled={!gmail || phase === "listing"} onClick={() => { started.current = true; void scan(); }}>
          {phase === "listing" ? "Looking for official emails…" : gmail ? "Read my official emails" : "Connect Gmail to continue"}
        </button>
        <button type="button" className="ob-link" onClick={onSkip}>Skip for now, I’ll start from what I told you</button>
      </div>
    );
  }
  if (phase === "empty") {
    return (
      <div className="ob-answer">
        <div className="ob-note"><strong>No official emails in {account || "your inbox"} from the last 120 days.</strong><p>That’s fine. When a letter or MOS email arrives, I’ll read it then. You can also add a letter photo any time in Look.</p></div>
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--lg ui-btn--block" onClick={() => void scan()}>Check again</button>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" onClick={onSkip}>Continue</button>
      </div>
    );
  }
  if (phase === "review") {
    const readings = rows.flatMap((r) => (r.reading?.relevant ? [r.reading] : []));
    return <Review readings={readings} rows={rows.map((r) => r.msg)} calendarConnected={calendar} onSaved={(added, saved) => { setCalendarAdded(added); onDone(saved); }} />;
  }
  const relevant = rows.filter((r) => r.reading?.relevant).length;
  return (
    <div className="ob-answer">
      <p className="ob-progress-line" aria-live="polite">{finished ? `Read ${rows.length} emails · ${relevant} matter for your case` : `Reading ${done + 1 > rows.length ? rows.length : done + 1} of ${rows.length} with Muse Spark…`}</p>
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
      {finished && (relevant > 0
        ? <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" onClick={() => setPhase("review")}>Review what I found</button>
        : <><div className="ob-note"><strong>None of these emails are about your residence case.</strong><p>I’ll keep an eye out for new official mail.</p></div><button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" onClick={onSkip}>Continue</button></>)}
    </div>
  );
}

const sender = (from: string) => from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || from;
