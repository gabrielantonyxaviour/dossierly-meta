"use client";
import { useEffect, useRef, useState } from "react";
import type { CalendarResult } from "@/lib/onboarding/commit";
import type { Finding } from "@/lib/onboarding/findings";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { Button, StickyActionBar } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";

export type Dated = Extract<Finding, { kind: "deadline" | "appointment" }>;
const KEY = "ob-cal-dates";
/** The dates survive the Google Calendar consent redirect in this tab only. */
export const pendingDates = {
  get(): Dated[] { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as Dated[]; } catch { return []; } },
  set(d: Dated[]) { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ } },
  clear() { try { sessionStorage.removeItem(KEY); } catch { /* private mode */ } },
};

const dateOf = (d: Dated) => (d.kind === "deadline" ? d.dueDate : d.date);
const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fmt = (tag: string, iso: string, o: Intl.DateTimeFormatOptions) => utc(iso).toLocaleDateString(tag, { timeZone: "UTC", ...o });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
/** A known Monday-to-Sunday week (5–11 Jan 2026), for narrow weekday names in the reader's language. */
const WEEK = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-11"];

/** One month, Monday first, with the case's dates marked. */
function Month({ month, marks, tag }: { month: string; marks: Map<string, Dated["kind"]>; tag: string }) {
  const first = utc(`${month}-01`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const now = today();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <figure className="ob-month">
      <figcaption>{fmt(tag, `${month}-01`, { month: "long", year: "numeric" })}</figcaption>
      <div className="ob-month-grid" role="grid">
        {WEEK.map((w) => <span key={w} className="ob-month-dow">{fmt(tag, w, { weekday: "narrow" })}</span>)}
        {cells.map((d, i) => d ? (
          <span key={d} className="ob-month-day" data-mark={marks.get(d)} data-today={d === now || undefined} aria-label={marks.has(d) ? fmt(tag, d, { weekday: "long", day: "numeric", month: "long" }) : undefined}>{Number(d.slice(8))}</span>
        ) : <span key={`x${i}`} />)}
      </div>
    </figure>
  );
}

/**
 * After the inbox is saved: the case's dates on an in-app calendar, then a separate Google Calendar connection.
 * `added` is true when the person comes back from the Calendar consent: the events are added straight away.
 */
export function CalendarStep({ dates, returned, onAdded, onDone }: { dates: Dated[]; returned: boolean; onAdded(): void; onDone(): void }) {
  const t = useT("onboarding");
  const tag = LOCALE_TAGS[useLocale()];
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CalendarResult[] | null>(null);
  const once = useRef(false);
  const sorted = [...dates].sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const marks = new Map(sorted.map((d) => [dateOf(d), d.kind]));
  const months = [...new Set(sorted.map((d) => dateOf(d).slice(0, 7)))];

  async function add() {
    setBusy(true); setError("");
    const r = await flowApi.commit({ findings: sorted, summaries: [], addToCalendar: true, calendarOnly: true });
    setBusy(false);
    if (!r.ok) { setError(failure(r) ?? t("addDatesError")); return; }
    pendingDates.clear(); setResult(r.data.calendar);
    if (r.data.calendar.some((x) => x.status !== "failed")) onAdded();
  }
  async function connect() {
    setBusy(true); setError("");
    pendingDates.set(sorted);
    const r = await flowApi.connect("calendar", "googlecalendar");
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(false); setError(failure(r) ?? t("openCalendarError"));
  }
  useEffect(() => {
    void flowApi.connections().then((r) => {
      const on = r.ok && r.data.connections.calendar?.provider === "googlecalendar" && r.data.connections.calendar.status === "connected";
      setConnected(on);
      if (on && returned && !once.current) { once.current = true; void add(); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- one status check per visit

  const added = result?.filter((x) => x.status !== "failed") ?? [];
  return (
    <div className="ob-answer">
      <div className="ob-months">{months.map((m) => <Month key={m} month={m} marks={marks} tag={tag} />)}</div>
      <ul className="ob-agenda">
        {sorted.map((d) => {
          const iso = dateOf(d), r = result?.find((x) => x.findingId === d.id);
          return (
            <li key={d.id} data-kind={d.kind}>
              <span className="ob-agenda-date"><small>{iso === today() ? t("todayTag") : fmt(tag, iso, { weekday: "short" })}</small><strong>{fmt(tag, iso, { day: "numeric" })}</strong><small>{fmt(tag, iso, { month: "short" })}</small></span>
              <span className="ob-agenda-body">
                <strong>{d.title}</strong>
                <span>{d.kind === "deadline" ? (d.rule ? t("lastDayRule", { rule: d.rule }) : t("lastDay")) : [d.time, d.place || d.address].filter(Boolean).join(" · ")}</span>
              </span>
              {r && (r.status === "failed" ? <em>{r.error}</em> : r.url ? <a href={r.url} target="_blank" rel="noreferrer">{t("open")}</a> : <em>{t("added")}</em>)}
            </li>
          );
        })}
      </ul>
      {result && <div className="ob-note ob-note-ok" role="status"><strong>{added.length ? (added.length === 1 ? t("addedOne") : t("addedMany", { n: added.length })) : t("nothingAdded")}</strong>{added.length > 0 && <p>{t("remindersSet")}</p>}</div>}
      {error && <div className="ob-alert" role="alert"><p>{error}</p></div>}
      {result ? (
        <StickyActionBar><Button variant="primary" size="lg" onClick={onDone}>{t("continue")}</Button></StickyActionBar>
      ) : (
        <StickyActionBar secondary={<Button variant="ghost" disabled={busy} onClick={() => { pendingDates.clear(); onDone(); }}>{t("notNow")}</Button>}>
          <Button variant="primary" size="lg" icon="calendar" disabled={busy || connected === null} loading={busy || connected === null} onClick={() => void (connected ? add() : connect())}>
            {busy ? (connected ? t("addingCalendar") : t("openingGoogle")) : connected ? (sorted.length === 1 ? t("addOne") : t("addMany", { n: sorted.length })) : t("connectCalendar")}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
