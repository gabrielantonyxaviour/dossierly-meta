"use client";

import { useState } from "react";
import type { CitedDeadline as Deadline } from "@/lib/look/types";
import { Icon } from "@/components/Icon";

const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
export const longDate = (iso: string) => LONG.format(parse(iso));
export const daysUntil = (iso: string) => Math.round((parse(iso).getTime() - parse(warsawToday()).getTime()) / 86_400_000);

/** A computed deadline with every counting step and the verbatim law it rests on. */
export function CitedDeadline({ deadline, title }: { deadline: Deadline; title?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const left = daysUntil(deadline.dueDate);
  const when = left < 0 ? `${-left} day${left === -1 ? "" : "s"} ago` : left === 0 ? "Today" : left === 1 ? "Tomorrow" : `In ${left} days`;
  return (
    <section className="lk-deadline" aria-label="Your deadline">
      <div className="lk-deadline-top">
        <span className="tab-label">{title ?? "Your deadline"}</span>
        <span className={`chip ${left < 0 ? "chip-deadline" : left <= 3 ? "chip-deadline" : "chip-warn"}`}>{when}</span>
      </div>
      <p className="lk-due">{longDate(deadline.dueDate)}</p>
      <p className="small muted lk-rule">Counted by {deadline.rule}. Computed in code from the letter&apos;s wording, not guessed by a model.</p>
      <ol className="lk-steps">
        {deadline.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {deadline.citations.length > 0 && (
        <div className="lk-cites">
          <span className="tiny muted">The law, word for word</span>
          {deadline.citations.map((c, i) => (
            <div key={c.label + i} className="lk-cite">
              <button type="button" className="cite" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <Icon name="book" size={15} /> {c.label}
              </button>
              {open === i && (
                <div className="cite-open">
                  <p lang="pl" style={{ margin: 0 }}>{c.quote}</p>
                  <a className="tiny" href={c.url} target="_blank" rel="noreferrer">Official text (Sejm ELI) <Icon name="external" size={12} /></a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
