"use client";
import { useState } from "react";
import { failure, flowApi, type ConnectionStatus } from "@/lib/client/onboarding-flow";
import { useT } from "@/lib/i18n/client";

/** `what` and `scope` are message keys in the "onboarding" namespace; `name` is the provider's brand name. */
type Card = { category: "mail" | "calendar"; provider: string; name: string; what: string; scope: string };
const GOOGLE: Card[] = [
  { category: "mail", provider: "gmail", name: "Gmail", what: "gmailWhat", scope: "gmailScope" },
  { category: "calendar", provider: "googlecalendar", name: "Google Calendar", what: "gcalWhat", scope: "eventsYouApprove" },
];
const OTHER: Card[] = [
  { category: "calendar", provider: "microsoftcalendar", name: "Outlook", what: "outlookWhat", scope: "eventsYouApprove" },
];

function Mark({ provider }: { provider: string }) {
  return <span className="ob-conn-mark" data-provider={provider} aria-hidden="true">{provider === "gmail" ? "M" : provider === "googlecalendar" ? "31" : "O"}</span>;
}

export function ConnectCards({ status, gmail, calendar, returned, only }: { status: ConnectionStatus | null; gmail: boolean; calendar: boolean; returned: string | null; only?: "mail" }) {
  const t = useT("onboarding");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function connect(card: Card) {
    setBusy(card.provider); setError("");
    const r = await flowApi.connect(card.category, card.provider);
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(""); setError(failure(r) ?? t("connectError"));
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
          <div className="ob-conn-head"><strong>{c.name}</strong>{connected && <span className="ob-badge-ok">{t("connected")}</span>}</div>
          <p>{connected ? mine?.label : t(c.what)}</p>
          {!connected && <small>{cap && !cap.available ? cap.reason : t(c.scope)}</small>}
        </div>
        {!status && <span className="ob-checking" aria-live="polite">{t("checking")}</span>}
        {status && !connected && (
          <button type="button" className={`ui-btn ui-btn--sm${next || (!gmail && c.provider === "gmail") ? " ui-btn--primary" : " ui-btn--secondary"}`} disabled={!status || !!busy || (cap ? !cap.available : true)} onClick={() => void connect(c)}>
            {busy === c.provider ? t("opening") : mine?.status === "reconnect" ? t("reconnect") : t("connect")}
          </button>
        )}
      </li>
    );
  };
  return (
    <>
      {returned === "failed" && <div className="ob-alert" role="alert"><p>{t("connectionFailed")}</p></div>}
      {error && <div className="ob-alert" role="alert"><p>{error}</p></div>}
      <ul className="ob-conns" aria-busy={!status}>{GOOGLE.filter((c) => !only || c.category === only).map(row)}</ul>
      {!only && <details className="ob-more">
        <summary>{t("useOutlookApple")}</summary>
        <ul className="ob-conns">{OTHER.map(row)}</ul>
        <p className="ob-more-note">{t("outlookAppleNote")}</p>
      </details>}
    </>
  );
}
