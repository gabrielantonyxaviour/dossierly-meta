import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { languageOptions, needLabel, sampleFor, type Answers, type Need } from "./content";
import { demoStatus, type Demo, type Demos } from "./journey";
import { evidenceCopy, paperStories } from "./paper-content";
import { SamplePaper } from "./SamplePaper";

type Props = { answers: Answers; active: Need; order: Need[]; demos: Demos; demo: Demo; select(need: Need): void; update(demo: Demo): void; navigation: ReactNode; error: string };
export function WalkthroughStep({ answers, active, order, demos, demo, select, update, navigation, error }: Props) {
  const t = useT("tour");
  const sample = sampleFor(active, t);
  const paper = paperStories[active];
  const language = languageOptions(t).find((item) => item.value === answers.language)!;
  const focus = useRef<HTMLHeadingElement>(null);
  useEffect(() => { focus.current?.focus({ preventScroll: true }); }, [active, demo.phase]);
  function highlight(evidence: Demo["evidence"]) {
    update({ ...demo, evidence, skipped: false, phase: demo.phase === 0 ? 1 : demo.phase });
    requestAnimationFrame(() => document.getElementById("op-evidence-heading")?.scrollIntoView({ block: "nearest", behavior: "instant" }));
  }
  return <div className="op-walkthrough" data-demo={active}>
    <div className="op-journey-heading"><p role="status">{t("exampleOf", { n: order.indexOf(active) + 1, total: order.length })} <span>{t("exampleEach")}</span></p><span className="op-help">{t("startAnywhere")}</span></div>
    <nav aria-label={t("examplesNav")} className="op-journey-nav">
      <ol>{order.map((need, index) => <li key={need}>
        <button type="button" aria-current={need === active ? "step" : undefined} onClick={() => select(need)}
          aria-label={t("exampleAria", { n: index + 1, label: needLabel(need, t), status: demoStatus(demos[need], t) })}>
          <span className="op-example-number">{demos[need]?.phase === 3 ? "✓" : String(index + 1).padStart(2, "0")}</span>
          <span>{needLabel(need, t)}<small>{demoStatus(demos[need], t)}</small></span>
        </button>
      </li>)}</ol>
    </nav>
    <div className="op-workbench">
      <SamplePaper need={active} demo={demo} highlight={highlight} />
      <div className="op-assistant-pane">
        <section className="op-assistant" aria-label={t("assistantAria")}>
          <div className="op-assistant-label"><span className="op-assistant-dot" aria-hidden="true" /><span>{t("assistantLabel")}</span></div>
          <div className="op-assistant-intro"><span className="op-eyebrow">{needLabel(active, t)}</span><h2 ref={focus} tabIndex={-1}>{sample.title}</h2></div>
          {demo.phase === 0 && <div className="op-demo-intro"><p>{t("meetArjun")}</p><p className="op-help">{t("introHelp")}</p></div>}
          {demo.phase > 0 && <section className="op-source-insight" aria-labelledby="op-evidence-heading">
            <div className="op-insight-controls" role="group" aria-label={t("passagesAria")}>
              {(["request", "detail"] as const).map((kind) => <button type="button" key={kind} aria-pressed={demo.evidence === kind} onClick={() => highlight(kind)}>{evidenceCopy(active, kind, t).label}</button>)}
            </div>
            <h3 id="op-evidence-heading">{t("plainLanguage")}</h3>
            <blockquote>{paper[demo.evidence].text}</blockquote>
            <p>{evidenceCopy(active, demo.evidence, t).explanation}</p>
            <button type="button" className="op-text-button" onClick={() => document.getElementById(`source-${active}-${demo.evidence}`)?.focus()}>{t("viewSource")}</button>
          </section>}
          {demo.phase === 1 && <div className="field op-draft">
            <label className="label" htmlFor="sample-action">{sample.actionLabel}</label>
            <textarea id="sample-action" className="input" value={demo.action} maxLength={600} rows={5} aria-invalid={!!error}
              onChange={(event) => update({ ...demo, action: event.target.value, skipped: false })} aria-describedby={error ? "op-error" : "sample-action-help"} />
            <small className="op-help" id="sample-action-help">{t("draftHelp")}</small>
          </div>}
          {demo.phase >= 2 && <section className="op-action-review" aria-labelledby="sample-review-title">
            <span className="op-badge">{t(demo.phase === 3 ? "badgeConfirmed" : "badgePreview")}</span>
            <h3 id="sample-review-title">{t(demo.phase === 3 ? "reviewedTitle" : "reviewTitle")}</h3>
            <p className="op-action-copy">{demo.action}</p>
            <p className="op-help">{t(demo.phase === 3 ? "reviewedHelp" : "reviewHelp")}</p>
            <button className="op-text-button" type="button" onClick={() => update({ ...demo, phase: 1, skipped: false })}>{t("editAction")}</button>
          </section>}
          {demo.phase === 3 && <div className="op-language-note"><p lang={language.value}>{language.phrase}</p><span className="op-help">{t("curatedPhrase", { language: language.label })}</span></div>}
          {navigation}
        </section>
      </div>
    </div>
  </div>;
}
