"use client";
import { useEffect, useState } from "react";
import { Card, Pill, Row, Section } from "@/components/ui";
import { GmailLogo, GoogleCalendarLogo, OutlookLogo } from "@/components/ui/logos";
import { useT } from "@/lib/i18n/client";

type Conn = { provider: string; category: "mail" | "calendar"; label: string; status: "connected" | "reconnect" } | null;
type Status = { connections: { mail: Conn; calendar: Conn } };

const LOGO: Record<string, React.ReactNode> = { gmail: <GmailLogo />, googlecalendar: <GoogleCalendarLogo />, outlook: <OutlookLogo />, microsoftcalendar: <OutlookLogo /> };
const NAME: Record<string, string> = { gmail: "Gmail", googlecalendar: "Google Calendar", outlook: "Outlook", microsoftcalendar: "Outlook Calendar" };

/** Mail and calendar connection status; managing them happens on /app/connections. */
export function ConnectionsSection() {
  const t = useT("settings");
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/connections", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setS).catch(() => setFailed(true));
  }, []);
  const row = (cat: "mail" | "calendar", fallback: string) => {
    const c = s?.connections[cat] ?? null;
    const tile = <span className="st-logo">{c ? LOGO[c.provider] : cat === "mail" ? <GmailLogo /> : <GoogleCalendarLogo />}</span>;
    return (
      <Row icon={tile} href="/app/connections" chevron
        title={c ? NAME[c.provider] ?? c.provider : fallback}
        sub={c ? c.label : failed ? t("statusUnavailable") : s ? t("notConnected") : t("checking")}
        end={c ? <Pill tone={c.status === "connected" ? "ok" : "warn"} dot>{c.status === "connected" ? t("connected") : t("reconnect")}</Pill> : s ? <Pill tone="outline">{t("connect")}</Pill> : undefined} />
    );
  };
  return (
    <Section title={t("connections")}>
      <Card flush>
        {row("mail", t("email"))}
        {row("calendar", t("calendar"))}
      </Card>
      <p className="ui-meta st-note">{t("connectionsNote")}</p>
    </Section>
  );
}
