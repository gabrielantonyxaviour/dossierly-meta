"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Card, IconButton } from "@/components/ui";
import { longDay } from "../format";
import { deadlineWindow, monthGrid, monthLabel, shiftMonth, type DateItem } from "./calendar-grid";
import "./calendar.css";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The case as a month: today ringed, deadlines red, appointments blue, the days left before the next deadline
 * shaded. Tap a day to see what is on it.
 */
export function CaseCalendar({ items, today, row }: { items: DateItem[]; today: string; row: (i: DateItem) => ReactNode }) {
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
          <h3 className="cal-month" aria-live="polite">{monthLabel(month)}</h3>
          <div className="cal-nav">
            {month !== today.slice(0, 7) && <button type="button" className="cal-today" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Today</button>}
            <IconButton icon="back" label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
            <IconButton icon="forward" label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
          </div>
        </div>
        <div className="cal-grid" role="grid" aria-label={monthLabel(month)}>
          {WEEK.map((w) => <span key={w} className="cal-dow" role="columnheader">{w.slice(0, 1)}<span className="cal-dow-rest">{w.slice(1)}</span></span>)}
          {cells.map(({ date, inMonth }) => {
            const on = byDay.get(date) ?? [];
            const dl = on.some((i) => i.kind === "deadline" && i.status !== "done");
            const ap = on.some((i) => i.kind === "appointment");
            const inWin = !!win && date > win.from && date < win.to;
            const cls = ["cal-day", !inMonth && "is-out", date === today && "is-today", date === selected && "is-sel", dl && "has-dl", ap && "has-ap", inWin && "in-win", win && date === win.to && "win-end", win && date === win.from && "win-start"].filter(Boolean).join(" ");
            const label = `${longDay(date)}${on.length ? `, ${on.map((i) => i.title).join(", ")}` : ""}${date === today ? ", today" : ""}`;
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
          <span><i className="cal-mark is-ap" />Appointment</span>
          <span><i className="cal-mark is-dl" />Deadline</span>
          {win && <span><i className="cal-swatch" />Days left</span>}
        </div>
      </Card>
      <section className="cal-dayitems" aria-live="polite">
        <h3 className="cal-dayhead">{selected === today ? `Today · ${longDay(selected)}` : longDay(selected)}</h3>
        {picked.length ? <Card flush>{picked.map(row)}</Card> : <p className="ui-meta cal-empty">Nothing on this day.</p>}
      </section>
    </div>
  );
}
