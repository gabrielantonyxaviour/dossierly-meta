"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { cx, Pill } from "@/components/ui";
import type { Step } from "./data";

/* Reference A (ReUI Timeline-1, Agent Activity-1) and B (flight-status line), adapted to Dossierly's dark tokens. */

/** Vertical case path: finished stages ticked, the current one open with its detail, later ones dimmed. */
export function CasePath({ items, current }: { items: { id: string; title: string; date: string; detail?: string }[]; current: string }) {
  const at = items.findIndex((i) => i.id === current);
  return (
    <ol className="rp-path" aria-label="Your case path">
      {items.map((it, i) => {
        const state = i < at ? "done" : i === at ? "now" : "next";
        return (
          <li key={it.id} className={cx("rp-path-item", `is-${state}`)} aria-current={state === "now" ? "step" : undefined}>
            <span className="rp-path-mark" aria-hidden="true">{state === "done" ? <Icon name="check" size={13} /> : state === "now" ? <span className="rp-pulse" /> : null}</span>
            <div className="rp-path-body">
              <div className="rp-path-head"><b>{it.title}</b><span className="ui-num">{it.date}</span></div>
              {it.detail && (state === "now" ? <div className="rp-path-card">{it.detail}</div> : <p className="rp-path-sub">{it.detail}</p>)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const STEP_ICON: Record<Step["state"], IconName | null> = { done: "check", now: "refresh", next: null, you: "user" };

/** What Dossierly did and what only you can do, one row per step, with a status tag on the right. */
export function Activity({ title, badge, steps, foot }: { title: string; badge?: ReactNode; steps: Step[]; foot?: ReactNode }) {
  return (
    <section className="rp-act" aria-label={title}>
      <header className="rp-act-head"><b>{title}</b>{badge}</header>
      <ul className="rp-act-list">
        {steps.map((s) => (
          <li key={s.title} className={cx("rp-act-row", `is-${s.state}`)}>
            <span className="rp-act-mark" aria-hidden="true">{STEP_ICON[s.state] && <Icon name={s.icon ?? STEP_ICON[s.state]!} size={14} />}</span>
            <span className="rp-act-main"><span className="rp-act-title">{s.title}</span>{s.sub && <span className="rp-act-sub">{s.sub}</span>}</span>
            {s.tag && <Pill tone={s.tag.tone}>{s.tag.text}</Pill>}
          </li>
        ))}
      </ul>
      {foot && <footer className="rp-act-foot">{foot}</footer>}
    </section>
  );
}

/** One big status word, a line with a marker for where the case is, and the numbers that matter. */
export function StatusLine({ word, sub, pct, left, right, tone = "user" }: { word: string; sub: string; pct: number; left: string; right: string; tone?: "user" | "ok" | "deadline" }) {
  const p = Math.max(2, Math.min(98, pct));
  return (
    <section className={cx("rp-status", `tone-${tone}`)} aria-label={`${word}. ${sub}`}>
      <p className="rp-status-word">{word}</p>
      <div className="rp-status-track" aria-hidden="true">
        <span className="rp-status-fill" style={{ width: `${p}%` }} />
        <span className="rp-status-dot" style={{ left: `${p}%` }} />
      </div>
      <div className="rp-status-ends ui-num"><span>{left}</span><span>{right}</span></div>
      <p className="rp-status-sub">{sub}</p>
    </section>
  );
}

/** Small labelled block used across screens. */
export function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rp-block">
      <header className="rp-block-head"><h2>{title}</h2>{aside}</header>
      {children}
    </section>
  );
}

/** A plain fact row: icon, text, optional end text. */
export function Fact({ icon, title, sub, end, tone }: { icon: IconName; title: ReactNode; sub?: ReactNode; end?: ReactNode; tone?: "ok" | "warn" | "deadline" | "official" }) {
  return (
    <div className={cx("rp-fact", tone && `tone-${tone}`)}>
      <span className="rp-fact-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
      <span className="rp-fact-main"><span className="rp-fact-title">{title}</span>{sub && <span className="rp-fact-sub">{sub}</span>}</span>
      {end && <span className="rp-fact-end">{end}</span>}
    </div>
  );
}
