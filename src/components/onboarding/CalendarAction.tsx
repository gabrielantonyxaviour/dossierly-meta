"use client";
import { useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import { connectionsApi } from "@/lib/client/onboarding-connections";
import { operationError, requireResult } from "@/lib/client/onboarding-api";
import { longDate } from "@/lib/client/format";
import { useT } from "@/lib/i18n/client";

export function CalendarAction({ date, sample }: { date: string; sample: boolean }) {
  const t = useT("onboarding");
  const samplePrefix = t("sampleTitle", { title: "" }).trim();
  const [calendars, setCalendars] = useState<{ id: string; name: string; primary: boolean }[] | null>(null);
  const [calendar, setCalendar] = useState(""); const [title, setTitle] = useState(sample ? t("sampleTitle", { title: t("eventTitle") }) : t("eventTitle"));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  const key = useRef("");
  async function load() { setBusy(true); setError(""); try { const result = requireResult(await connectionsApi.calendars()); setCalendars(result.calendars); setCalendar(result.calendars.find((item) => item.primary)?.id || result.calendars[0]?.id || ""); } catch (e) { setError(operationError(e)); } finally { setBusy(false); } }
  async function save() {
    setBusy(true); setError("");
    try { if (!key.current) key.current = crypto.randomUUID(); requireResult(await connectionsApi.event({ calendarId: calendar, date, title: sample && !title.startsWith(samplePrefix) ? t("sampleTitle", { title: title.trim() }) : title.trim(), idempotencyKey: key.current })); setSaved(true); }
    catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  return <section className="op-permissions" aria-label={t("addEventAria")}><h3>{t("addEventTitle")}</h3><p>{t("allDayEvent", { date: longDate(date) })}</p>{sample && <p>{t("sampleDateNote")}</p>}
    {error && <p role="alert" className="op-error">{error}</p>}
    {saved ? <p role="status">{t("eventAdded")}</p> : !calendars ? <button type="button" className="btn" disabled={busy} onClick={() => void load()}>{t("chooseCalendar")}</button> : calendars.length ? <><div className="field"><span id="event-calendar-label">{t("catCalendar")}</span><Select labelledBy="event-calendar-label" value={calendar} onChange={(value) => { setCalendar(value); key.current = ""; }} options={calendars.map((item) => ({ value: item.id, label: item.name }))} disabled={busy} /></div><label className="field"><span>{t("eventTitleLabel")}</span><input className="input" maxLength={160} value={title} disabled={busy} onChange={(e) => { setTitle(e.target.value); key.current = ""; }} /></label><button type="button" className="btn btn-primary" disabled={busy || !title.trim() || !calendar} onClick={() => void save()}>{t("confirmAddEvent")}</button></> : <p>{t("noCalendars")}</p>}
  </section>;
}
