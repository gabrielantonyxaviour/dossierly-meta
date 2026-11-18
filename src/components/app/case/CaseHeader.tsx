"use client";
import { useState } from "react";
import { STAGES, type CaseSnapshot } from "@/lib/case/types";
import { Pill, Sheet, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { currentTag } from "@/lib/i18n/current";
import { stageLabel } from "../format";
import { factLabel, sourceLabel } from "../home/CaseStrip";

const filedLabel = (d: string) => new Intl.DateTimeFormat(currentTag(), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)).replace("Sept", "Sep");

/** Compact: stage track, case number (tap to copy) and a row that opens every fact with its source. */
export function CaseHeader({ c }: { c: CaseSnapshot }) {
  const t = useT("case");
  const th = useT("home");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const at = STAGES.indexOf(c.profile.stage);
  const facts = (["caseNumber", "office", "filedAt", "upoReceivedAt", "mosStatus", "inpolStatus"] as const).flatMap((k) => (c.facts[k] ? [[k, c.facts[k]!] as const] : []));
  const num = c.facts.caseNumber?.value;
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast(t("caseNumberCopied"), { tone: "ok" }); } catch { toast(t("copyFailed"), { tone: "error" }); }
  };
  const filed = c.facts.filedAt?.value;
  return (
    <section className="cs-head ui-card" aria-label={t("caseSummary")}>
      <div className="cs-id">
        <div className="cs-id-top">
          <span className="cs-copy-label">{t("caseNumber")}</span>
          {facts.length > 0 && <button type="button" className="ui-btn ui-btn--sm" onClick={() => setOpen(true)}>{t("details")}<Icon name="forward" size={14} /></button>}
        </div>
        {num ? (
          <button type="button" className="cs-copy" onClick={() => void copy(num)} aria-label={t("copyNumber", { num })}>
            <span className="cs-num">{num}</span><Icon name="copy" size={16} />
          </button>
        ) : <span className="ui-meta">{t("noNumber")}</span>}
        {filed && /^\d{4}-\d{2}-\d{2}$/.test(filed) && <p className="cs-filed">{c.facts.filedAt?.source.type === "email" ? t("filedFromEmail", { date: filedLabel(filed) }) : t("filed", { date: filedLabel(filed) })}</p>}
      </div>
      <ol className="cs-stages" aria-label={t("caseStage")}>
        {STAGES.map((s, i) => (
          <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : undefined} aria-current={i === at ? "step" : undefined}>
            <span className="cs-stage-dot">{i < at && <Icon name="check" size={11} />}</span>
            <span className="cs-stage-label">{stageLabel(s)}</span>
          </li>
        ))}
      </ol>
      {at >= 0 && (
        <p className="cs-stage-caption" aria-hidden="true">
          <span>{STAGES[at + 1] ? t("stepOfNext", { n: at + 1, total: STAGES.length, next: stageLabel(STAGES[at + 1]) }) : t("stepOf", { n: at + 1, total: STAGES.length })}</span>
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("caseDetails")}>
        <dl className="cs-facts">
          {facts.map(([k, f]) => (
            <div key={k} className="cs-fact">
              <dt>{factLabel(th, k)}</dt>
              <dd className={k === "caseNumber" ? "ui-num" : undefined}>{f.value}</dd>
              <Pill tone={f.confirmedByUser ? "ok" : "outline"}>{f.confirmedByUser ? t("confirmed", { source: sourceLabel(th, f.source.type) }) : sourceLabel(th, f.source.type)}</Pill>
            </div>
          ))}
        </dl>
        <p className="ui-meta">{t("factsNote")}</p>
      </Sheet>
    </section>
  );
}
