"use client";

import Link from "next/link";
import { useState } from "react";
import { longDate } from "@/lib/client/format";
import { LANGUAGE_NAMES } from "@/lib/client/sample";
import { useDossier, type Appointment } from "@/lib/client/store";
import type { AgentTask, ChecklistItem, HubChange, PrepareResult } from "@/lib/client/types";
import { webSpeech } from "@/lib/speech/webspeech";
import { useT } from "@/lib/i18n/client";
import { Icon } from "../../Icon";

const MARK = { have: "✓", missing: "", check: "?" } as const;
const STATUS = { have: "statusHave", missing: "statusMissing", check: "statusCheck" } as const;

function Item({ it }: { it: ChecklistItem }) {
  const t = useT("prepare");
  const [open, setOpen] = useState(false);
  return (
    <li className={`check-item ci-${it.status}`}>
      <span className="ci-mark" aria-hidden="true">{MARK[it.status]}</span>
      <div>
        <span className="ci-status">{t(STATUS[it.status])}</span>
        <p style={{ margin: "2px 0 4px", fontWeight: it.status === "missing" ? 700 : 500 }}>{it.item}</p>
        <button type="button" className="cite" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t("source", { title: it.citation.title })}
        </button>
        {open && (
          <div className="cite-open">
            {it.citation.quote && <p lang="pl" style={{ margin: "0 0 6px" }}>„{it.citation.quote}”</p>}
            <a href={it.citation.url} target="_blank" rel="noreferrer" className="small" style={{ overflowWrap: "anywhere" }}>
              {it.citation.url} <Icon name="external" size={14} />
            </a>
          </div>
        )}
      </div>
    </li>
  );
}

type Props = { result: PrepareResult; task: AgentTask<PrepareResult>; hubChanges: HubChange[]; appointment: Appointment };

export function PrepareResultView({ result, hubChanges, appointment }: Props) {
  const t = useT("prepare");
  const d = useDossier();
  const [saved, setSaved] = useState(false);
  const userLang = LANGUAGE_NAMES[d.case.profile.language];
  const since = d.lastPreparedAt;
  const changes = [...result.changes, ...hubChanges].filter((c, i, all) => all.findIndex((x) => x.title === c.title) === i).slice(0, 6);
  const missing = result.checklist.filter((x) => x.status === "missing").length;

  const save = async () => {
    await d.update((x) => {
      const docs = [...x.case.documents];
      for (const it of result.checklist) {
        const name = it.item.slice(0, 160);
        if (!docs.some((doc) => doc.name.toLowerCase() === name.toLowerCase())) docs.push({ name, have: it.status === "have" });
      }
      return { ...x, nextAppointment: appointment, lastPreparedAt: new Date().toISOString(), case: { ...x.case, documents: docs.slice(0, 40) } };
    });
    setSaved(true);
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "18px" }}>
      {changes.length > 0 && (
        <section className="stack" aria-labelledby="chg-h" style={{ ["--gap" as string]: "10px" }}>
          <h2 id="chg-h" className="h-card">{t("changedSince")}</h2>
          {changes.map((c) => (
            <div key={c.title} className="change">
              <div className="row between">
                <b>{c.title}</b>
                {(!since || c.detectedAt > since) && <span className="chip chip-official">{t("new")}</span>}
              </div>
              <p className="small" style={{ margin: "4px 0" }}>{c.summary}</p>
              <a className="tiny muted" href={c.url} target="_blank" rel="noreferrer">{t("detected", { host: new URL(c.url).hostname, date: longDate(c.detectedAt.slice(0, 10)) })}</a>
            </div>
          ))}
        </section>
      )}

      <section className="stack" aria-labelledby="cl-h" style={{ ["--gap" as string]: "10px" }}>
        <div className="row between">
          <h2 id="cl-h" className="h-card">{t("checklistFor", { date: longDate(appointment.date) })}</h2>
          {missing > 0 && <span className="chip chip-warn">{t("missingCount", { n: missing })}</span>}
        </div>
        <ul className="checklist">{result.checklist.map((it, i) => <Item key={i} it={it} />)}</ul>
      </section>

      {result.phrases.length > 0 && (
        <section className="stack" aria-labelledby="ph-h" style={{ ["--gap" as string]: "10px" }}>
          <h2 id="ph-h" className="h-card">{t("phrasesTitle")}</h2>
          <p className="small muted" style={{ margin: 0 }}>{t("phrasesHint")}</p>
          <div className="phrases">
            {result.phrases.map((p, i) => (
              <div key={i} className="phrase">
                <div>
                  <div className="pl" lang="pl">{p.local}</div>
                  <div className="small muted" lang={d.case.profile.language}>{p.user}</div>
                </div>
                <button className="btn btn-small btn-ghost" aria-label={t("sayPolish", { text: p.local })} onClick={() => void webSpeech.speak(p.local, "pl-PL")}>
                  <Icon name="speak" />
                </button>
              </div>
            ))}
          </div>
          <span className="tiny muted">{t("polishAnd", { lang: userLang.native })}</span>
        </section>
      )}

      <div className="card row between save-bar">
        {saved ? (
          <>
            <span><Icon name="check" size={18} /> {t("saved")}</span>
            <Link className="btn btn-primary btn-small" href="/app/meet">{t("openCounter")}</Link>
          </>
        ) : (
          <>
            <span className="small">{t("saveHint")}</span>
            <button className="btn btn-primary" onClick={() => void save()}>{t("saveCta")}</button>
          </>
        )}
      </div>
    </div>
  );
}
