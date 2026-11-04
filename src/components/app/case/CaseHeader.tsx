"use client";
import { STAGES, type CaseSnapshot } from "@/lib/case/types";
import { Pill, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { STAGE_LABEL } from "../format";
import { FACT_LABEL, SOURCE_LABEL } from "../home/CaseStrip";

/** Stage track + key facts with their sources. */
export function CaseHeader({ c }: { c: CaseSnapshot }) {
  const { toast } = useToast();
  const at = STAGES.indexOf(c.profile.stage);
  const facts = (["caseNumber", "office", "filedAt", "upoReceivedAt", "mosStatus", "inpolStatus"] as const).flatMap((k) => (c.facts[k] ? [[k, c.facts[k]!] as const] : []));
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast("Copied", { tone: "ok" }); } catch { toast("Couldn’t copy", { tone: "error" }); }
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
      {facts.length > 0 ? (
        <dl className="cs-facts">
          {facts.map(([k, f]) => (
            <div key={k} className="cs-fact">
              <dt>{FACT_LABEL[k]}</dt>
              <dd>
                {k === "caseNumber" ? <button type="button" className="cs-copy ui-num" onClick={() => void copy(f.value)} aria-label={`Copy case number ${f.value}`}>{f.value}<Icon name="copy" size={14} /></button> : f.value}
              </dd>
              <Pill tone={f.confirmedByUser ? "ok" : "outline"}>{SOURCE_LABEL[f.source.type]}{f.confirmedByUser ? " · confirmed" : ""}</Pill>
            </div>
          ))}
        </dl>
      ) : (
        <p className="ui-body">No case facts yet. Your case number and office appear here once Dossierly reads them from your email or a letter.</p>
      )}
    </section>
  );
}
