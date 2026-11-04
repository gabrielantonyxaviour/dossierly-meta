"use client";
import { useState } from "react";
import { failure, flowApi, type ConnectionStatus } from "@/lib/client/onboarding-flow";

type Card = { category: "mail" | "calendar"; provider: string; name: string; what: string; scope: string };
const GOOGLE: Card[] = [
  { category: "mail", provider: "gmail", name: "Gmail", what: "Finds letters from the office, MOS and your university", scope: "Read-only · never sends or deletes" },
  { category: "calendar", provider: "googlecalendar", name: "Google Calendar", what: "Adds the dates you confirm, with reminders", scope: "Only events you approve" },
];
const OTHER: Card[] = [
  { category: "calendar", provider: "microsoftcalendar", name: "Outlook calendar", what: "Microsoft 365 or Outlook.com calendar.", scope: "Only events you approve." },
];

function Mark({ provider }: { provider: string }) {
  return <span className="ob-conn-mark" data-provider={provider} aria-hidden="true">{provider === "gmail" ? "M" : provider === "googlecalendar" ? "31" : "O"}</span>;
}

export function ConnectCards({ status, gmail, calendar, returned }: { status: ConnectionStatus | null; gmail: boolean; calendar: boolean; returned: string | null }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function connect(card: Card) {
    setBusy(card.provider); setError("");
    const r = await flowApi.connect(card.category, card.provider);
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(""); setError(failure(r) ?? "Could not start the connection.");
  }
  const row = (c: Card) => {
    const conn = status?.connections[c.category];
    const mine = conn?.provider === c.provider ? conn : null;
    const cap = status?.capabilities.find((x) => x.provider === c.provider);
    const connected = mine?.status === "connected";
    const next = c.provider === "googlecalendar" && gmail && !calendar;
    return (
      <li key={c.provider} className="ob-conn" data-connected={connected} data-next={next}>
        <Mark provider={c.provider} />
        <div className="ob-conn-body">
          <div className="ob-conn-head"><strong>{c.name}</strong>{connected && <span className="ob-badge-ok">Connected</span>}</div>
          <p>{connected ? mine?.label : c.what}</p>
          {!connected && <small>{cap && !cap.available ? cap.reason : c.scope}</small>}
        </div>
        {!status && <span className="ob-checking" aria-live="polite">Checking…</span>}
        {status && !connected && (
          <button type="button" className={`ui-btn ui-btn--sm${next || (!gmail && c.provider === "gmail") ? " ui-btn--primary" : " ui-btn--secondary"}`} disabled={!status || !!busy || (cap ? !cap.available : true)} onClick={() => void connect(c)}>
            {busy === c.provider ? "Opening…" : mine?.status === "reconnect" ? "Reconnect" : "Connect"}
          </button>
        )}
      </li>
    );
  };
  return (
    <>
      {returned === "failed" && <div className="ob-alert" role="alert"><p>That connection didn’t finish, so nothing was shared. You can try again, or skip this step.</p></div>}
      {error && <div className="ob-alert" role="alert"><p>{error}</p></div>}
      <ul className="ob-conns" aria-busy={!status}>{GOOGLE.map(row)}</ul>
      <details className="ob-more">
        <summary>Use Outlook or Apple Calendar</summary>
        <ul className="ob-conns">{OTHER.map(row)}</ul>
        <p className="ob-more-note">Apple Calendar: every deadline has an .ics download. Outlook mail reading is coming soon.</p>
      </details>
    </>
  );
}
