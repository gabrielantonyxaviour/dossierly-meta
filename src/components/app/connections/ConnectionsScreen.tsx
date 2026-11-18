"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, ErrorState, InlineError, Pill, Section, Sheet, Skeleton, TopBar, useToast } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { GmailLogo, GoogleCalendarLogo, OutlookLogo } from "@/components/ui/logos";
import { useT } from "@/lib/i18n/client";
import { call, friendlyError } from "@/lib/client/api";
import { connectionsApi, type Category, type Connections, type Provider } from "@/lib/client/onboarding-connections";
import "@/components/ui/shell.css";
import "./connections.css";

type Address = { address: string; createdAt: number; rotatedAt: number | null; forwardingConfirmation: { code: string | null; link: string | null; receivedAt: number } | null };
const inbound = {
  get: () => call<Address>("/api/inbound/address"),
  rotate: () => call<Address>("/api/inbound/address/rotate", { method: "POST", body: "{}" }),
};

const PROVIDERS: { id: Provider; category: Category; name: string; logo: React.ReactNode }[] = [
  { id: "gmail", category: "mail", name: "Gmail", logo: <GmailLogo /> },
  { id: "outlook", category: "mail", name: "Outlook", logo: <OutlookLogo /> },
  { id: "googlecalendar", category: "calendar", name: "Google Calendar", logo: <GoogleCalendarLogo /> },
  { id: "microsoftcalendar", category: "calendar", name: "Outlook Calendar", logo: <OutlookLogo /> },
];

/** Mail, calendar and the forwarding address, all server-backed. Connecting leaves for the provider's consent screen and comes back here. */
export function ConnectionsScreen() {
  const t = useT("connections");
  const { toast } = useToast();
  const params = useSearchParams();
  const [state, setState] = useState<Connections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addr, setAddr] = useState<Address | null>(null);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([connectionsApi.get(), inbound.get()]);
    if (c.ok) { setState(c.data); setError(null); } else setError(friendlyError(c));
    if (a.ok) { setAddr(a.data); setAddrError(null); } else setAddrError(a.code === "address_pool_empty" ? t("addrPoolEmpty") : friendlyError(a));
  }, [t]);

  useEffect(() => {
    let alive = true;
    void Promise.all([connectionsApi.get(), inbound.get()]).then(([c, a]) => {
      if (!alive) return;
      if (c.ok) setState(c.data); else setError(friendlyError(c));
      if (a.ok) setAddr(a.data); else setAddrError(a.code === "address_pool_empty" ? t("addrPoolEmpty") : friendlyError(a));
    });
    const r = params.get("connection");
    if (r === "connected") toast(t("connectedToast"), { tone: "ok" });
    if (r === "failed") toast(t("failedToast"), { tone: "error" });
    return () => { alive = false; };
  }, [params, t, toast]);

  const connect = async (p: (typeof PROVIDERS)[number]) => {
    setBusy(p.id);
    const r = await connectionsApi.connect(p.category, p.id, "/app/connections");
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(null);
    toast(r.code === "connection_testing" ? t("testingOnly") : friendlyError(r), { tone: "error" });
  };
  const disconnect = async (category: Category) => {
    setBusy(category);
    const r = await connectionsApi.disconnect(category);
    setBusy(null);
    if (r.ok) { toast(t("disconnectedToast")); void load(); } else toast(friendlyError(r), { tone: "error" });
  };
  const rotate = async () => {
    setConfirmRotate(false); setBusy("rotate");
    const r = await inbound.rotate();
    setBusy(null);
    if (r.ok) { setAddr(r.data); toast(t("rotatedToast")); } else toast(r.code === "address_pool_empty" ? t("addrPoolEmpty") : friendlyError(r), { tone: "error" });
  };

  if (!state && error) return <div className="sh-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  if (!state) return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="50%" /><Skeleton h={160} r={20} /><Skeleton h={160} r={20} /></div>;

  const card = (cat: Category) => {
    const current = state.connections[cat];
    return (
      <Card flush className="cn-card">
        {PROVIDERS.filter((p) => p.category === cat).map((p) => {
          const cap = state.capabilities.find((c) => c.provider === p.id);
          const on = current?.provider === p.id;
          const other = !!current && !on;
          return (
            <div key={p.id} className="cn-row">
              <span className="cn-logo" aria-hidden="true">{p.logo}</span>
              <span className="cn-main">
                <b>{p.name}</b>
                <span>{on ? current!.label : cap && !cap.available ? cap.notice ?? t("unavailable") : t(cat === "mail" ? "mailSub" : "calSub")}</span>
              </span>
              {on ? (
                <span className="cn-end">
                  <Pill tone={current!.status === "connected" ? "ok" : "warn"} dot>{current!.status === "connected" ? t("connected") : t("reconnect")}</Pill>
                  <Button size="sm" variant="ghost" loading={busy === cat} onClick={() => void disconnect(cat)}>{t("disconnect")}</Button>
                </span>
              ) : (
                <Button size="sm" variant="secondary" disabled={other || busy !== null || (cap ? !cap.available : false)} loading={busy === p.id} onClick={() => void connect(p)}>{t("connect")}</Button>
              )}
            </div>
          );
        })}
      </Card>
    );
  };

  return (
    <div className="sh-page cn">
      <TopBar title={t("pageTitle")} back={{ href: "/app/settings", label: t("back") }} sub={t("pageIntro")} />
      <Section title={t("mailTitle")}>{card("mail")}<p className="ui-meta">{t("mailNote")}</p></Section>
      <Section title={t("addrTitle")}>
        <Card className="cn-addr">
          <p className="ui-meta">{t("addrIntro")}</p>
          {addr ? (
            <div className="cn-addr-row"><code>{addr.address}</code><CopyButton text={addr.address} label={t("copy")} /></div>
          ) : addrError ? <InlineError message={addrError} onRetry={() => void load()} /> : <Skeleton h={44} r={10} />}
          {addr?.forwardingConfirmation && (
            <div className="cn-confirm">
              <b>{t("gmailConfirmTitle")}</b>
              {addr.forwardingConfirmation.code && <span>{t("gmailConfirmCode")} <code>{addr.forwardingConfirmation.code}</code></span>}
            </div>
          )}
          <ol className="cn-steps"><li>{t("addrStep1")}</li><li>{t("addrStep2")}</li><li>{t("addrStep3")}</li></ol>
          {addr && <Button size="sm" variant="ghost" loading={busy === "rotate"} onClick={() => setConfirmRotate(true)}>{t("rotate")}</Button>}
        </Card>
      </Section>
      <Section title={t("calTitle")}>{card("calendar")}</Section>
      <Sheet open={confirmRotate} onClose={() => setConfirmRotate(false)} title={t("rotateTitle")}
        footer={<><Button variant="ghost" onClick={() => setConfirmRotate(false)}>{t("cancel")}</Button><Button variant="danger" onClick={() => void rotate()}>{t("rotateConfirm")}</Button></>}>
        <p className="ui-body">{t("rotateBody")}</p>
      </Sheet>
    </div>
  );
}
