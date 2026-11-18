"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Card, IconButton } from "@/components/ui";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { longDay } from "../format";
import { deadlineWindow, monthGrid, monthLabel, shiftMonth, weekdays, type DateItem } from "./calendar-grid";
import "./calendar.css";

/**
 * The case as a month: today ringed, deadlines red, appointments blue, the days left before the next deadline
 * shaded. Tap a day to see what is on it.
 */
export function CaseCalendar({ items, today, row }: { items: DateItem[]; today: string; row: (i: DateItem) => ReactNode }) {
  const t = useT("case");
  const tag = LOCALE_TAGS[useLocale()];
  const week = useMemo(() => weekdays(tag), [tag]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const byDay = useMemo(() => {
    const m = new Map<string, DateItem[]>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [items]);
  const win = deadlineWindow(items, today);
  const cells = monthGrid(month);
  const picked = [...(byDay.get(selected) ?? [])].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  return (
    <div className="cal">
      <Card className="cal-card">
        <div className="cal-head">
          <h3 className="cal-month" aria-live="polite">{monthLabel(month, tag)}</h3>
          <div className="cal-nav">
            {month !== today.slice(0, 7) && <button type="button" className="cal-today" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>{t("today")}</button>}
            <IconButton icon="back" label={t("prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))} />
            <IconButton icon="forward" label={t("nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))} />
          </div>
        </div>
        <div className="cal-grid" role="grid" aria-label={monthLabel(month, tag)}>
          {week.map((w, i) => <span key={i} className="cal-dow" role="columnheader" aria-label={w.short}><span className="cal-dow-n" aria-hidden="true">{w.narrow}</span><span className="cal-dow-rest" aria-hidden="true">{w.short}</span></span>)}
          {cells.map(({ date, inMonth }) => {
            const on = byDay.get(date) ?? [];
            const dl = on.some((i) => i.kind === "deadline" && i.status !== "done");
            const ap = on.some((i) => i.kind === "appointment");
            const inWin = !!win && date > win.from && date < win.to;
            const cls = ["cal-day", !inMonth && "is-out", date === today && "is-today", date === selected && "is-sel", dl && "has-dl", ap && "has-ap", inWin && "in-win", win && date === win.to && "win-end", win && date === win.from && "win-start"].filter(Boolean).join(" ");
            const label = [longDay(date), ...on.map((i) => i.title), date === today ? t("todayLower") : null].filter(Boolean).join(", ");
            return (
              <button key={date} type="button" role="gridcell" className={cls} aria-label={label} aria-selected={date === selected}
                onClick={() => { setSelected(date); if (!inMonth) setMonth(date.slice(0, 7)); }}>
                <span className="cal-num">{Number(date.slice(8))}</span>
                <span className="cal-marks" aria-hidden="true">{dl && <i className="cal-mark is-dl" />}{ap && <i className="cal-mark is-ap" />}</span>
              </button>
            );
          })}
        </div>
        <div className="cal-legend" aria-hidden="true">
          <span><i className="cal-mark is-ap" />{t("legendAppt")}</span>
          <span><i className="cal-mark is-dl" />{t("deadline")}</span>
          {win && <span><i className="cal-swatch" />{t("legendDaysLeft")}</span>}
        </div>
      </Card>
      <section className="cal-dayitems" aria-live="polite">
        <h3 className="cal-dayhead">{selected === today ? t("todayWithDate", { date: longDay(selected) }) : longDay(selected)}</h3>
        {picked.length ? <Card flush>{picked.map(row)}</Card> : <p className="ui-meta cal-empty">{t("nothingOnDay")}</p>}
      </section>
    </div>
  );
}
