"use client";
import { useState } from "react";
import { STAGES, type CaseSnapshot } from "@/lib/case/types";
import { Pill, Sheet, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { STAGE_LABEL } from "../format";
import { FACT_LABEL, SOURCE_LABEL } from "../home/CaseStrip";

/** Compact: stage track, case number (tap to copy) and a row that opens every fact with its source. */
export function CaseHeader({ c }: { c: CaseSnapshot }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const at = STAGES.indexOf(c.profile.stage);
  const facts = (["caseNumber", "office", "filedAt", "upoReceivedAt", "mosStatus", "inpolStatus"] as const).flatMap((k) => (c.facts[k] ? [[k, c.facts[k]!] as const] : []));
  const num = c.facts.caseNumber?.value;
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast("Case number copied", { tone: "ok" }); } catch { toast("Couldn’t copy", { tone: "error" }); }
  };
  return (
    <section className="cs-head ui-card" aria-label="Case summary">
      <ol className="cs-stages" aria-label="Case stage">
        {STAGES.map((s, i) => (
          <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : undefined} aria-current={i === at ? "step" : undefined}>
            <span className="cs-stage-dot">{i < at && <Icon name="check" size={11} />}</span>
            <span className="cs-stage-label">{STAGE_LABEL[s]}</span>
          </li>
        ))}
      </ol>
      {at >= 0 && (
        <p className="cs-stage-caption" aria-hidden="true">
          <span>Step {at + 1} of {STAGES.length}{STAGES[at + 1] ? ` · Next: ${STAGE_LABEL[STAGES[at + 1]]}` : ""}</span>
        </p>
      )}
      <div className="cs-head-row">
        {num ? (
          <button type="button" className="cs-copy" onClick={() => void copy(num)} aria-label={`Copy case number ${num}`}>
            <span className="cs-copy-label">Case number</span>
            <span className="ui-num">{num} <Icon name="copy" size={14} /></span>
          </button>
        ) : <span className="ui-meta">No case number yet. It arrives by email after you file in MOS.</span>}
        {facts.length > 0 && <button type="button" className="ui-btn ui-btn--sm" onClick={() => setOpen(true)}>Details<Icon name="forward" size={14} /></button>}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Case details">
        <dl className="cs-facts">
          {facts.map(([k, f]) => (
            <div key={k} className="cs-fact">
              <dt>{FACT_LABEL[k]}</dt>
              <dd className={k === "caseNumber" ? "ui-num" : undefined}>{f.value}</dd>
              <Pill tone={f.confirmedByUser ? "ok" : "outline"}>{SOURCE_LABEL[f.source.type]}{f.confirmedByUser ? " · confirmed" : ""}</Pill>
            </div>
          ))}
        </dl>
        <p className="ui-meta">Every fact shows where it came from. Facts you confirmed are marked.</p>
      </Sheet>
    </section>
  );
}
