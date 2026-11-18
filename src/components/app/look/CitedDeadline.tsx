"use client";

import { useState } from "react";
import type { CitedDeadline as Deadline } from "@/lib/look/types";
import { Icon } from "@/components/Icon";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";

const LONG_OPTS: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
/** Pass the reader's BCP 47 tag (LOCALE_TAGS[useLocale()]) so server and client render the same text. */
export const longDate = (iso: string, tag = "en-GB") => new Intl.DateTimeFormat(tag, LONG_OPTS).format(parse(iso));
export const daysUntil = (iso: string) => Math.round((parse(iso).getTime() - parse(warsawToday()).getTime()) / 86_400_000);

/** A computed deadline with every counting step and the verbatim law it rests on. */
export function CitedDeadline({ deadline, title }: { deadline: Deadline; title?: string }) {
  const t = useT("look");
  const tag = LOCALE_TAGS[useLocale()];
  const [open, setOpen] = useState<number | null>(null);
  const left = daysUntil(deadline.dueDate);
  const when = left === -1 ? t("dayAgo") : left < 0 ? t("daysAgo", { n: -left }) : left === 0 ? t("today") : left === 1 ? t("tomorrow") : t("inDays", { n: left });
  return (
    <section className="lk-deadline" aria-label={t("yourDeadline")}>
      <div className="lk-deadline-top">
        <span className="tab-label">{title ?? t("yourDeadline")}</span>
        <span className={`ui-pill ${left < 0 ? "ui-pill--deadline" : left <= 3 ? "ui-pill--deadline" : "ui-pill--warn"}`}>{when}</span>
      </div>
      <p className="lk-due">{longDate(deadline.dueDate, tag)}</p>
      <p className="small muted lk-rule">{t("countedBy", { rule: deadline.rule })}</p>
      <ol className="lk-steps">
        {deadline.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {deadline.citations.length > 0 && (
        <div className="lk-cites">
          <span className="tiny muted">{t("lawVerbatim")}</span>
          {deadline.citations.map((c, i) => (
            <div key={c.label + i} className="lk-cite">
              <button type="button" className="cite" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <Icon name="book" size={15} /> {c.label}
              </button>
              {open === i && (
                <div className="cite-open">
                  <p lang="pl" style={{ margin: 0 }}>{c.quote}</p>
                  <a className="tiny" href={c.url} target="_blank" rel="noreferrer">{t("officialText")} <Icon name="external" size={12} /></a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
