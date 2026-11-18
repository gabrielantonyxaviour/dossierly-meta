"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, Pill, Row, Section, TopBar, useToast } from "@/components/ui";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { useCaseData } from "../shell/case-data";
import "@/components/voice/voice.css";
import "./counter.css";

const fmt = (iso: string, tag: string) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(iso));

/** "Dossierly calls you": real Twilio call for the demo accounts, "coming soon" for everyone else. */
function PhoneRow() {
  const t = useT("counter");
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
    toast(r?.ok ? t("calling", { to: d.to ?? t("verifiedNumber") }) : d.error ?? t("callFailed"));
  };
  return (
    <Row
      icon="phone"
      title={t("phoneTitle")}
      sub={t("phoneSub")}
      end={enabled === null ? null : enabled ? <Button variant="primary" loading={busy} onClick={() => void call()}>{t("callMe")}</Button> : <Pill>{t("comingSoon")}</Pill>}
    />
  );
}

/** The Counter tab: start a live counter conversation, rehearse, call, and see past conversations. */
export function CounterHub() {
  const t = useT("counter");
  const tag = LOCALE_TAGS[useLocale()];
  const { snapshot } = useCaseData();
  const past = (snapshot?.events ?? []).filter((e) => e.type === "counter_session" || e.type === "call").slice(0, 5);
  return (
    <div className="sh-page ch">
      <TopBar title={t("title")} sub={t("hubSub")} />
      <Card className="ch-hero" raised>
        <div className="ch-split" aria-hidden>
          <span className="ch-half ch-half-off" lang="pl">Czy ma Pan ubezpieczenie?</span>
          <span className="ch-half ch-half-you">{t("heroYou")}</span>
        </div>
        <h2>{t("atCounter")}</h2>
        <p>{t("heroBody")}</p>
        <ButtonLink href="/app/counter/live" variant="agent" size="lg" icon="mic" block>{t("startCta")}</ButtonLink>
        <Link className="ch-kit" href="/app/counter/live?kit=1">{t("kitLink")}</Link>
      </Card>

      <Section title={t("beforeAfter")}>
        <Row icon="speak" title={t("rehearseTitle")} sub={t("rehearseSub")} href="/app/rehearse/live" chevron />
        <Row icon="chat" title={t("talkTitle")} sub={t("talkSub")} href="/app/call" chevron />
        <PhoneRow />
      </Section>

      <Section title={t("past")}>
        {past.length ? (
          past.map((e) => <Row key={e.id} icon={e.type === "call" ? "phone" : "counter"} title={e.type === "call" ? t("callWith") : t("atCounter")} sub={e.summary} end={<small className="ch-when">{fmt(e.at, tag)}</small>} />)
        ) : (
          <Row icon="info" title={t("nothingYet")} sub={t("nothingSub")} />
        )}
      </Section>
    </div>
  );
}
