"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, Pill, Row, Section, TopBar, useToast } from "@/components/ui";
import { useCaseData } from "../shell/case-data";
import "@/components/voice/voice.css";
import "./counter.css";

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(iso));

/** "Dossierly calls you": real Twilio call for the demo accounts, "coming soon" for everyone else. */
function PhoneRow() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    fetch("/api/twilio/call").then((r) => (r.ok ? r.json() : { enabled: false })).then((d: { enabled?: boolean }) => setEnabled(!!d.enabled)).catch(() => setEnabled(false));
  }, []);
  const call = async () => {
    setBusy(true);
    const r = await fetch("/api/twilio/call", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string; to?: string };
    setBusy(false);
    toast(r?.ok ? `Calling your phone (${d.to ?? "verified number"}) now.` : d.error ?? "The call could not be placed.");
  };
  return (
    <Row
      icon="phone"
      title="Dossierly calls you"
      sub="When something urgent lands and you haven’t opened the app, Dossierly phones you and explains it."
      end={enabled === null ? null : enabled ? <Button variant="primary" loading={busy} onClick={() => void call()}>Call me now</Button> : <Pill>Coming soon</Pill>}
    />
  );
}

/** The Counter tab: start a live counter conversation, rehearse, call, and see past conversations. */
export function CounterHub() {
  const { snapshot } = useCaseData();
  const past = (snapshot?.events ?? []).filter((e) => e.type === "counter_session" || e.type === "call").slice(0, 5);
  return (
    <div className="sh-page ch">
      <TopBar title="Counter" sub="Dossierly speaks for you at the office, and knows your case while it does." />
      <Card className="ch-hero" raised>
        <div className="ch-split" aria-hidden>
          <span className="ch-half ch-half-off" lang="pl">Czy ma Pan ubezpieczenie?</span>
          <span className="ch-half ch-half-you">Do you have health insurance?</span>
        </div>
        <h2>At the counter</h2>
        <p>Phone flat between you and the official: Polish on top for them, your language below for you. Documents and next steps come up as you talk.</p>
        <ButtonLink href="/app/counter/live" variant="agent" size="lg" icon="mic" block>Start at the counter</ButtonLink>
        <Link className="ch-kit" href="/app/counter/live?kit=1">No Polish speaker? Try a test official</Link>
      </Card>

      <Section title="Before and after">
        <Row icon="speak" title="Rehearse the interview" sub="A Polish AI official asks what the office will ask about your case, then gives feedback." href="/app/rehearse/live" chevron />
        <Row icon="chat" title="Talk to Dossierly" sub="A voice call about your case, any time." href="/app/call" chevron />
        <PhoneRow />
      </Section>

      <Section title="Past conversations">
        {past.length ? (
          past.map((e) => <Row key={e.id} icon={e.type === "call" ? "phone" : "counter"} title={e.type === "call" ? "Call with Dossierly" : "At the counter"} sub={e.summary} end={<small className="ch-when">{fmt(e.at)}</small>} />)
        ) : (
          <Row icon="info" title="Nothing yet" sub="Conversations at the counter and calls appear here with what was agreed." />
        )}
      </Section>
    </div>
  );
}
