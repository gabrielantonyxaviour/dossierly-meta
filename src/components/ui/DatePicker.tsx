"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isIsoDate, todayIso } from "@/lib/client/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { Icon } from "../Icon";
import { Chevron, usePopover } from "./usePopover";

type Props = {
  /** ISO YYYY-MM-DD, or "" for no date. */
  value: string;
  onChange(iso: string): void;
  min?: string;
  max?: string;
  labelledBy?: string;
  /** Accessible name when there is no visible label element. */
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/** Month, weekday and date names in the interface language. Weeks still start on Monday. */
function formats(tag: string) {
  const MONTH = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" });
  const SHORT = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const FULL = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  // 2024-01-01 was a Monday.
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)));
  const short = days.map((d) => new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(d));
  const narrow = days.map((d) => new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" }).format(d));
  const long = days.map((d) => new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(d));
  // "Mo Tu …" where short names are short (English, Ukrainian); single narrow letters otherwise (Hindi, Tamil).
  const fits = short.every((w) => [...w].length <= 3);
  const heads = short.map((w, i) => ({ abbr: long[i], text: fits ? w.slice(0, 2) : narrow[i] }));
  /** "Tue 10 Nov 2026" */
  const label = (iso: string) => SHORT.formatToParts(toDate(iso)).filter((p) => p.type !== "literal").map((p) => p.value).join(" ");
  return { MONTH, FULL, heads, label };
}

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
const addMonths = (iso: string, n: number) => {
  const d = toDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, days));
  return toIso(d);
};
/** Monday-first weekday index, 0..6. */
const weekday = (iso: string) => (toDate(iso).getUTCDay() + 6) % 7;
const clamp = (iso: string, min?: string, max?: string) => (min && iso < min ? min : max && iso > max ? max : iso);

/** Six Monday-first weeks covering the month of `iso`. */
function monthGrid(iso: string): string[][] {
  const first = `${iso.slice(0, 7)}-01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export function DatePicker({ value, onChange, min, max, labelledBy, ariaLabel, id, placeholder: placeholderProp, disabled, className }: Props) {
  const t = useT("ui");
  const tag = LOCALE_TAGS[useLocale()];
  const { MONTH, FULL, heads, label } = useMemo(() => formats(tag), [tag]);
  const placeholder = placeholderProp ?? t("chooseDate");
  const auto = useId();
  const triggerId = id ?? `date-${auto}`;
  const headId = `${triggerId}-month`;
  const { open, show, close, placement, wrap, trigger, pop, onBlur } = usePopover();
  const grid = useRef<HTMLTableElement>(null);
  const [focus, setFocus] = useState(() => clamp(isIsoDate(value) ? value : todayIso(), min, max));
  const today = todayIso();
  const valid = isIsoDate(value);
  const out = (iso: string) => (min !== undefined && iso < min) || (max !== undefined && iso > max);

  const openPicker = () => {
    setFocus(clamp(valid ? value : todayIso(), min, max));
    show();
  };

  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focus}"]`)?.focus({ preventScroll: true });
  }, [open, focus]);

  const pick = (iso: string) => {
    if (out(iso)) return;
    onChange(iso);
    close();
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday(focus)),
      End: () => addDays(focus, 6 - weekday(focus)),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setFocus(clamp(moves[e.key](), min, max));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focus);
    }
  };

  const onPopKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const month = focus.slice(0, 7);
  const prevMonth = addMonths(focus, -1);
  const nextMonth = addMonths(focus, 1);
  const canPrev = !min || prevMonth.slice(0, 7) >= min.slice(0, 7);
  const canNext = !max || nextMonth.slice(0, 7) <= max.slice(0, 7);

  return (
    <div ref={wrap} onBlur={onBlur} className={`ui-select ui-date${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        className="ui-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${valid ? label(value) : placeholder}` : undefined}
        aria-labelledby={!ariaLabel && labelledBy ? `${labelledBy} ${triggerId}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <Icon name="calendar" size={18} />
        <span className={`ui-trigger-value${valid ? "" : " is-placeholder"}`}>{valid ? label(value) : placeholder}</span>
        <Chevron />
      </button>
      {open && (
        <>
          {placement === "sheet" && <div className="ui-backdrop" aria-hidden="true" onClick={() => close()} />}
          <div ref={pop} className={`ui-pop ui-pop-${placement} ui-cal`} role="dialog" aria-modal={placement === "sheet"} aria-labelledby={headId} onKeyDown={onPopKey}>
            {placement === "sheet" && <div className="ui-sheet-grip" aria-hidden="true" />}
            <div className="ui-cal-head">
              <button type="button" className="ui-cal-nav" onClick={() => setFocus(clamp(prevMonth, min, max))} disabled={!canPrev} aria-label={t("prevMonth")}>
                <Chevron />
              </button>
              <h2 id={headId} className="ui-cal-title" aria-live="polite">{MONTH.format(toDate(focus))}</h2>
              <button type="button" className="ui-cal-nav ui-cal-next" onClick={() => setFocus(clamp(nextMonth, min, max))} disabled={!canNext} aria-label={t("nextMonth")}>
                <Chevron />
              </button>
            </div>
            <table ref={grid} className="ui-cal-grid" role="grid" aria-labelledby={headId} onKeyDown={onGridKey}>
              <thead>
                <tr>{heads.map((w, i) => <th key={i} scope="col" abbr={w.abbr}>{w.text}</th>)}</tr>
              </thead>
              <tbody>
                {monthGrid(focus).map((week) => (
                  <tr key={week[0]}>
                    {week.map((iso) => {
                      const off = out(iso);
                      const cls = [
                        "ui-day",
                        iso.slice(0, 7) !== month && "is-outside",
                        iso === today && "is-today",
                        iso === value && "is-selected",
                      ].filter(Boolean).join(" ");
                      return (
                        <td key={iso} role="gridcell" aria-selected={iso === value}>
                          <button
                            type="button"
                            className={cls}
                            data-iso={iso}
                            tabIndex={iso === focus ? 0 : -1}
                            aria-disabled={off || undefined}
                            aria-label={iso === today ? t("dayToday", { date: FULL.format(toDate(iso)) }) : FULL.format(toDate(iso))}
                            aria-current={iso === today ? "date" : undefined}
                            onClick={() => (off ? setFocus(iso) : pick(iso))}
                          >
                            {Number(iso.slice(8))}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ui-cal-foot">
              <button type="button" className="btn btn-ghost btn-small" onClick={() => pick(today)} disabled={out(today)}>{t("today")}</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => close()}>{t("close")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
