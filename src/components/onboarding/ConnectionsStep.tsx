"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { connectionsApi, type Category, type Connections, type Provider } from "@/lib/client/onboarding-connections";
import { operationError, requireResult } from "@/lib/client/onboarding-api";
import { downloadIcs } from "@/lib/client/ics";
import { CalendarAction } from "./CalendarAction";
import { Loading } from "../States";
import { useT } from "@/lib/i18n/client";

/** `title` is the provider's brand name; `purpose` is a message key in the "onboarding" namespace. */
const options: { id: Provider; title: string; category: Category; logo: string; purpose: string }[] = [
  { id: "gmail", title: "Gmail", category: "mail", logo: "gmail.png", purpose: "purposeGmail" },
  { id: "outlook", title: "Microsoft Outlook", category: "mail", logo: "outlook.png", purpose: "purposeOutlook" },
  { id: "googlecalendar", title: "Google Calendar", category: "calendar", logo: "google-calendar.png", purpose: "purposeGcal" },
  { id: "microsoftcalendar", title: "Microsoft Calendar", category: "calendar", logo: "microsoft-calendar.png", purpose: "purposeMscal" },
];
export function ConnectionsStep({ beforeLeave, date, sample = false, returnPath = "/onboarding" }: { beforeLeave(): Promise<void>; date?: string | null; sample?: boolean; returnPath?: "/onboarding" | "/app" }) {
  const t = useT("onboarding");
  const [data, setData] = useState<Connections | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<Provider | null>(null);
  const load = useCallback(async () => { try { setData(requireResult(await connectionsApi.get())); setError(""); } catch (e) { setError(operationError(e)); } }, []);
  useEffect(() => { let live = true; void connectionsApi.get().then((result) => { if (!live) return; if (result.ok) setData(result.data); else setError(result.error); }); return () => { live = false; }; }, []);
  async function connect(category: Category, provider: Provider) {
    setBusy(provider); setError("");
    try { await beforeLeave(); const result = requireResult(await connectionsApi.connect(category, provider, returnPath)); const url = new URL(result.redirectUrl); if (url.protocol !== "https:") throw new Error(t("badConnectionUrl")); window.location.assign(url.href); }
    catch (e) { setError(operationError(e)); setBusy(""); }
  }
  async function disconnect(category: Category) {
    setBusy(category); setError("");
    try { const result = requireResult(await connectionsApi.disconnect(category)); await load(); setNotice(result.providerRevocationRequired ? t("disconnectedRevoke") : t("disconnected")); }
    catch (e) { setError(operationError(e)); }
    finally { setBusy(""); }
  }
  return <div className="op-tools"><p className="op-helper-note">{t("connectionsIntro")}</p>
    {data?.cleanupPending && <div className="op-helper-note" role="status"><p>{data.cleanupNotice || t("cleanupNotice")}</p><button type="button" className="op-text-button" disabled={!!busy} onClick={() => void load()}>{t("refreshStatus")}</button></div>}
    {notice && <p role="status" className="op-helper-note">{notice}</p>}
    {error && <div className="op-error" role="alert">{error}<button type="button" className="op-text-button" onClick={() => void load()}>{t("retryStatus")}</button></div>}
    {!data && !error && <Loading label={t("checkingConnections")} />}
    {(["mail", "calendar"] as const).map((category) => <section className="op-provider-category" key={category}><h2>{category === "mail" ? t("catMail") : t("catCalendar")} <span className="op-help">{t("optionalOne")}</span></h2>
      {options.filter((option) => option.category === category).map((option) => {
        const capability = data?.capabilities.find((item) => item.provider === option.id);
        const connected = data?.connections[category]?.provider === option.id ? data.connections[category] : null;
        return <section className="op-tool" key={option.id} aria-labelledby={`real-tool-${option.id}`}><div className="op-tool-heading"><Image className="op-tool-logo" src={`/onboarding-preview/providers/${option.logo}`} width={36} height={36} alt="" unoptimized /><div><h3 id={`real-tool-${option.id}`}>{option.title}</h3><p className="op-help">{t(option.purpose)}</p></div></div>
          {capability?.available && capability.notice && <p className="op-help">{capability.notice}</p>}
          {connected?.status === "connected" ? <div className="op-tool-selection"><span role="status">{t("connectedAs", { label: connected.label })}</span><button type="button" className="op-text-button" disabled={!!busy} onClick={() => void disconnect(category)}>{t("disconnectProvider", { provider: option.title })}</button></div> : <><button type="button" className="op-text-button" disabled={!capability?.available || !!busy} aria-expanded={expanded === option.id} onClick={() => setExpanded(expanded === option.id ? null : option.id)}>{connected ? t("reconnectProvider", { provider: option.title }) : t("setUpProvider", { provider: option.title })}</button>{capability && !capability.available && <p className="op-help">{capability.reason || t("notAvailable")}</p>}</>}
          {expanded === option.id && <div className="op-permissions"><h4>{t("reviewBefore")}</h4><p>{t("composioNote")}</p><p>{category === "mail" ? t("mailApproval") : t("calendarApproval")}</p>{data?.connections[category] && <p>{category === "mail" ? t("replacesMail") : t("replacesCalendar")}</p>}<button type="button" className="btn" disabled={!!busy} onClick={() => void connect(category, option.id)}>{t("continueTo", { provider: option.title })}</button></div>}
        </section>;
      })}
      {category === "calendar" && <section className="op-tool"><div className="op-tool-heading"><Image className="op-tool-logo" src="/onboarding-preview/providers/apple-calendar.png" width={36} height={36} alt="" unoptimized /><div><h3>{t("appleTitle")}</h3><p className="op-help">{t("appleBody")}</p></div></div><button type="button" className="op-text-button" disabled={!date} onClick={() => date && downloadIcs([{ uid: crypto.randomUUID(), date, title: sample ? t("sampleTitle", { title: t("icsTitle") }) : t("icsTitle") }], "dossierly-date.ics")}>{t("downloadIcs")}</button>{!date && <p className="op-help">{t("needDate")}</p>}</section>}
    </section>)}
    {date && data?.connections.calendar?.status === "connected" && <CalendarAction date={date} sample={sample} />}
  </div>;
}
