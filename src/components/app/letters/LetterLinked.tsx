"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { daysUntil, longDate, shortDate } from "@/lib/client/format";
import { downloadIcs } from "@/lib/client/ics";
import { LANGUAGE_NAMES } from "@/lib/client/sample";
import { newId, useDossier } from "@/lib/client/store";
import type { CaseEvent, LetterLink, LetterRead } from "@/lib/client/types";
import { Attribution } from "../../Attribution";
import { CopyButton } from "../../CopyButton";
import { Icon } from "../../Icon";
import { useFiling } from "../useFiling";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";

export function LetterLinked({ read, link, delivery, onDone }: { read: LetterRead; link: LetterLink; delivery: string; onDone(): void }) {
  const t = useT("letters");
  const tag = LOCALE_TAGS[useLocale()];
  const d = useDossier();
  const [tab, setTab] = useState<"pl" | "user">("pl");
  const [savedId, setSavedId] = useState<string | null>(null);
  const filing = useFiling();
  const related = d.case.events.filter((e) => link.link.relatedEventIds.includes(e.id));
  const userLang = LANGUAGE_NAMES[d.case.profile.language].label;
  const title = read.letter.title || t("officialLetter");
  const what = t("replyTo", { title }).slice(0, 280);

  const save = async () => {
    const id = newId("ev-letter");
    const event: CaseEvent = {
      id, date: delivery, kind: "letter", title: title.slice(0, 200),
      summary: link.link.explanation.slice(0, 1500), refs: link.link.relatedEventIds.slice(0, 10),
    };
    const nextCase = {
      ...d.case,
      caseNumber: d.case.caseNumber ?? read.letter.caseNumber ?? undefined,
      events: [...d.case.events, event].slice(-60),
      deadlines: link.deadline ? [...d.case.deadlines, { id: newId("dl"), date: link.deadline.date, what, sourceEventId: id }].slice(-30) : d.case.deadlines,
    };
    await d.update((x) => ({
      ...x,
      case: nextCase,
      letters: [{ id, title, deliveryDate: delivery, deadline: link.deadline?.date ?? null, linkedTo: link.link.relatedEventIds, explanation: link.link.explanation, draftLocal: link.draftLocal, draftUser: link.draftUser }, ...x.letters],
    }));
    setSavedId(id);
    if (link.deadline) void api.reminder(link.deadline.date, `Dossierly: ${title}`);
    filing.file(nextCase, event);
  };

  const ics = () => link.deadline && downloadIcs([{ uid: savedId ?? "letter", date: link.deadline.date, title: t("icsTitle", { title }), description: `${link.deadline.steps.join("\n")}\n\n${t("icsNote")}` }], "dossierly-deadline.ics");

  return (
    <section className="stack" aria-labelledby="linked-h" style={{ ["--gap" as string]: "14px" }}>
      <div className="card link-card">
        <div className="row between">
          <span className="tab-label"><Icon name="link" size={16} /> {t("linkedLabel")}</span>
          <Attribution runs={link.runs} run={link.run} />
        </div>
        <h2 id="linked-h" style={{ margin: "8px 0" }}>
          {related.length ? t(related.length === 1 && related[0].kind === "appointment" ? "linkedConversation" : "linkedEntries", { dates: new Intl.ListFormat(tag).format(related.map((e) => shortDate(e.date))) }) : t("whereFits")}
        </h2>
        {related.length > 0 && (
          <ul className="related">
            {related.map((e) => <li key={e.id}><span className="mono">{shortDate(e.date)}</span> <b>{e.title}</b></li>)}
          </ul>
        )}
        <p style={{ margin: "10px 0 0" }}>{link.link.explanation}</p>
        {link.fallbackLabel && <p className="tiny muted" style={{ margin: "6px 0 0" }}>{link.fallbackLabel}</p>}
        {link.link.stillOpen.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <span className="tab-label">{t("stillOpen")}</span>
            <ul className="still-open">{link.link.stillOpen.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
      </div>

      {link.deadline ? (
        <div className="deadline-hero">
          <div className="row between">
            <span className="tab-label dl-label">{t("replyBy")}</span>
            <span className="dl-count mono">{daysUntil(link.deadline.date) >= 0 ? t("daysLeft", { n: daysUntil(link.deadline.date) }) : t("datePassed")}</span>
          </div>
          <p className="dl-date mono">{longDate(link.deadline.date)}</p>
          <details open className="calc">
            <summary className="small" style={{ fontWeight: 650 }}>{t("howCounted")}</summary>
            <ol className="calc-steps">{link.deadline.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>
        </div>
      ) : (
        <div className="card"><p style={{ margin: 0 }}>{t("noDeadline")}</p></div>
      )}

      <div className="card stack" style={{ ["--gap" as string]: "12px" }}>
        <div className="row between">
          <h2 className="h-card">{t("draftTitle")}</h2>
          <div className="seg" role="tablist" aria-label={t("draftLanguage")}>
            <button role="tab" aria-selected={tab === "pl"} className={`btn btn-small${tab === "pl" ? " btn-primary" : ""}`} onClick={() => setTab("pl")}>{t("polish")}</button>
            <button role="tab" aria-selected={tab === "user"} className={`btn btn-small${tab === "user" ? " btn-primary" : ""}`} onClick={() => setTab("user")}>{userLang}</button>
          </div>
        </div>
        <pre className="draft" lang={tab === "pl" ? "pl" : d.case.profile.language}>{tab === "pl" ? link.draftLocal : link.draftUser}</pre>
        <div className="row">
          <CopyButton text={tab === "pl" ? link.draftLocal : link.draftUser} label={tab === "pl" ? t("copyPolish") : t("copy")} />
          <span className="tiny muted">{t("fillBlanks")}</span>
        </div>
      </div>

      <div className="card stack save-bar" style={{ ["--gap" as string]: "10px" }}>
        {savedId ? (
          <>
            <p style={{ margin: 0, fontWeight: 650 }}><Icon name="check" size={18} /> {link.deadline ? t("addedWithDeadline") : t("added")}</p>
            <p className="small muted" style={{ margin: 0 }}>{filing.label}</p>
            <div className="row">
              {link.deadline && <button className="btn btn-small" onClick={ics}><Icon name="calendar" size={18} /> {t("addCalendar")}</button>}
              <Link className="btn btn-small btn-primary" href="/app">{t("backToCase")}</Link>
              <button className="btn btn-small btn-ghost" onClick={onDone}>{t("readAnother")}</button>
            </div>
          </>
        ) : (
          <div className="row">
            <button className="btn btn-primary" onClick={() => void save()}>{t("addReminder")}</button>
            {link.deadline && <button className="btn" onClick={ics}><Icon name="calendar" size={18} /> {t("calendarFile")}</button>}
          </div>
        )}
      </div>
    </section>
  );
}
