"use client";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx, IconButton, IconLink } from "./primitives";

/*
 * Mobile-first primitives (Gabriel's standard, 4 Nov). Below 768px every flow screen is:
 *   <MobileFlowHeader/>  <MobilePage actions> <ScreenTitle/> …content… </MobilePage>  <StickyActionBar/>
 * Styles: ./mobile.css. Desktop (≥1024px) keeps a normal layout: the action bar becomes an inline row.
 */

type Progress = { at: number; of: number };

/** Compact 56px top bar: back (or close) on the left, short title or a thin step progress, optional action right. */
export function MobileFlowHeader({ back, close, title, progress, action, backLabel = "Back" }: {
  back?: string | (() => void); close?: boolean; title?: ReactNode; progress?: Progress; action?: ReactNode; backLabel?: string;
}) {
  const icon = close ? "close" : "back";
  const label = close ? "Close" : backLabel;
  const lead = typeof back === "string" ? <IconLink href={back} icon={icon} label={label} /> : back ? <IconButton icon={icon} label={label} onClick={back} /> : <span />;
  const pct = progress ? Math.max(0, Math.min(1, progress.at / progress.of)) * 100 : 0;
  return (
    <header className="ui-mhead">
      <div className="ui-mhead-row">
        <div className="ui-mhead-lead">{lead}</div>
        <div className="ui-mhead-title">{title}</div>
        <div className="ui-mhead-action">{action}</div>
      </div>
      {progress && (
        <div className="ui-mhead-progress" role="progressbar" aria-label={`Step ${progress.at} of ${progress.of}`} aria-valuemin={0} aria-valuemax={progress.of} aria-valuenow={progress.at}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
}

/** Page container: 16px gutter with safe-area insets; `actions` reserves room so content scrolls clear of the action bar. */
export function MobilePage({ children, actions, wide, className }: { children: ReactNode; actions?: boolean | "double"; wide?: boolean; className?: string }) {
  return <div className={cx("ui-mpage", actions && "ui-mpage--actions", actions === "double" && "ui-mpage--actions2", wide && "ui-mpage--wide", className)}>{children}</div>;
}

/** Screen title (26–28px / 600) with one short helper line. */
export function ScreenTitle({ title, sub, eyebrow }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="ui-mtitle">
      {eyebrow && <span className="ui-mtitle-eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

/** Height of the on-screen keyboard (iOS/Android) from visualViewport, 0 when closed. */
export function useKeyboardInset() {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const h = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKb(h > 80 ? h : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);
  useEffect(() => {
    if (!kb) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable]")) {
      const t = window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
      return () => window.clearTimeout(t);
    }
  }, [kb]);
  return kb;
}

/**
 * Sticky bottom action bar: one full-width primary (52px, radius 14) and an optional secondary text button.
 * Sits 16px from the edges plus the safe area, rides above the keyboard, and above the tab bar inside the app shell.
 * Pass a Button/ButtonLink as children; pair with <MobilePage actions>.
 */
export function StickyActionBar({ children, secondary, note }: { children: ReactNode; secondary?: ReactNode; note?: ReactNode }) {
  const kb = useKeyboardInset();
  return (
    <div className={cx("ui-actionbar", kb > 0 && "is-kb")} style={kb ? { bottom: kb } : undefined}>
      <div className="ui-actionbar-inner">
        {note && <p className="ui-actionbar-note">{note}</p>}
        <div className="ui-actionbar-primary">{children}</div>
        {secondary && <div className="ui-actionbar-secondary">{secondary}</div>}
      </div>
    </div>
  );
}

export type Option<T extends string> = { value: T; label: ReactNode; sub?: ReactNode; icon?: IconName; lead?: ReactNode; disabled?: boolean };
type Choice<T extends string> =
  | { multiple?: false; value: T | null | undefined; onChange: (v: T) => void }
  | { multiple: true; value: T[]; onChange: (v: T[]) => void };
type ChoiceProps<T extends string> = Choice<T> & { options: Option<T>[]; label: string; className?: string };

function useChoice<T extends string>(p: Choice<T>) {
  const selected = (v: T) => (p.multiple ? p.value.includes(v) : p.value === v);
  const toggle = (v: T) => {
    if (p.multiple) p.onChange(p.value.includes(v) ? p.value.filter((x) => x !== v) : [...p.value, v]);
    else p.onChange(v);
  };
  return { selected, toggle, role: p.multiple ? "checkbox" : "radio", group: p.multiple ? "group" : "radiogroup" } as const;
}

/** Arrow keys move focus between options (radio/checkbox group behaviour). */
function arrowNav(e: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"];
  if (!keys.includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
  items[next]?.focus();
}

function Check({ on, multiple }: { on: boolean; multiple?: boolean }) {
  return <span className={cx("ui-opt-check", multiple && "ui-opt-check--multi", on && "is-on")} aria-hidden="true">{on && <Icon name="check" size={14} />}</span>;
}

/** Full-width selectable rows (52–56px): label, secondary text, check on the right. Single or multi select. */
export function OptionList<T extends string>(props: ChoiceProps<T>) {
  const { options, label, className } = props;
  const c = useChoice(props);
  return (
    <div className={cx("ui-optlist", className)} role={c.group} aria-label={label} onKeyDown={arrowNav}>
      {options.map((o) => {
        const on = c.selected(o.value);
        return (
          <button key={o.value} type="button" role={c.role} aria-checked={on} disabled={o.disabled} className={cx("ui-opt", on && "is-on")} onClick={() => c.toggle(o.value)}>
            {o.lead ?? (o.icon && <span className="ui-opt-icon"><Icon name={o.icon} size={20} /></span>)}
            <span className="ui-opt-main">
              <span className="ui-opt-label">{o.label}</span>
              {o.sub && <span className="ui-opt-sub">{o.sub}</span>}
            </span>
            <Check on={on} multiple={props.multiple} />
          </button>
        );
      })}
    </div>
  );
}

/** Equal tiles in a 2-column grid (3 with `columns={3}`), for short visual choices. */
export function OptionGrid<T extends string>(props: ChoiceProps<T> & { columns?: 2 | 3 }) {
  const { options, label, className, columns = 2 } = props;
  const c = useChoice(props);
  return (
    <div className={cx("ui-optgrid", columns === 3 && "ui-optgrid--3", className)} role={c.group} aria-label={label} onKeyDown={arrowNav}>
      {options.map((o) => {
        const on = c.selected(o.value);
        return (
          <button key={o.value} type="button" role={c.role} aria-checked={on} disabled={o.disabled} className={cx("ui-tile", on && "is-on")} onClick={() => c.toggle(o.value)}>
            {o.lead ?? (o.icon && <Icon name={o.icon} size={22} />)}
            <span className="ui-tile-label">{o.label}</span>
            {o.sub && <span className="ui-tile-sub">{o.sub}</span>}
            <Check on={on} multiple={props.multiple} />
          </button>
        );
      })}
    </div>
  );
}
