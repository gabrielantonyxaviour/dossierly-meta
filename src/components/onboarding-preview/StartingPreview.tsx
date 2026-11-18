import { CaseChatPreview, type ChatState } from "./CaseChatPreview";
import { useT } from "@/lib/i18n/client";
import { languageOptions, needLabel, officeRelevant, reasonLabel, sampleFor, stageLabel, type Answers, type Need } from "./content";
import { demoStatus, orderedNeeds, type Demos } from "./journey";
import { providerName, type Tool } from "./providers";

export function StartingPreview({ answers, demos, chat, updateChat, selected, edit, tryExample, restart }: {
  answers: Answers; demos: Demos; chat: ChatState; updateChat(state: ChatState): void; selected: Tool[]; edit(step: number): void; tryExample(need: Need): void; restart(): void;
}) {
  const t = useT("tour");
  const order = orderedNeeds(answers);
  const reviewed = order.filter((need) => demos[need]?.phase === 3 && !demos[need]?.skipped).length;
  return <div className="op-start">
    <header className="op-heading"><span className="op-eyebrow">{t("startEyebrow")}</span><h1 tabIndex={-1} id="op-title">{t("startTitle", { name: answers.name.trim() })}</h1><p>{t("startSummary", { n: order.length, reviewed })}</p></header>
    <CaseChatPreview state={chat} update={updateChat} needs={order} />
    <div className="op-start-grid">
      <section className="op-plans" aria-labelledby="plan-title">
        <div className="op-section-heading"><h2 id="plan-title">{t("planTitle")}</h2><button type="button" className="op-text-button" onClick={() => edit(2)}>{t("editPriorities")}</button></div>
        <p className="op-help">{t("planHelp")}</p>
        {order.map((need, index) => { const sample = sampleFor(need, t); return <article className="op-plan" key={need} data-plan={need}>
          <div className="op-plan-label"><span className="op-eyebrow">{String(index + 1).padStart(2, "0")} · {needLabel(need, t)}</span><span className="op-badge">{demoStatus(demos[need], t)}</span></div>
          <h3>{sample.firstAction}</h3>
          <p className="op-action-copy">{demos[need]?.action || sample.action}</p>
          <details><summary>{t("explorePlan")}</summary><ol>{sample.plan.map((item) => <li key={item}>{item}</li>)}</ol></details>
          <button type="button" className={index === 0 ? "btn btn-primary" : "op-text-button"} onClick={() => tryExample(need)}>{index === 0 ? t("openFirst") : t("openExample", { label: needLabel(need, t).toLocaleLowerCase() })}<span aria-hidden="true">→</span></button>
        </article>; })}
      </section>
      <aside className="op-summary" aria-labelledby="summary-title">
        <div className="op-section-heading"><h2 id="summary-title">{t("summaryTitle")}</h2><button type="button" className="op-text-button" onClick={() => edit(0)}>{t("editDetails")}</button></div>
        <dl>
          <div><dt>{t("dtSituation")}</dt><dd>{reasonLabel(answers.reason, t)} · {stageLabel(answers.stage, t)}{answers.city.trim() && ` · ${answers.city.trim()}`}</dd></div>
          {officeRelevant(answers.stage) && answers.office.trim() && <div><dt>{t("dtOffice")}</dt><dd>{answers.office.trim()}</dd></div>}
          <div><dt>{t("dtLanguage")}</dt><dd>{languageOptions(t).find((item) => item.value === answers.language)?.label}</dd></div>
          <div><dt>{t("dtPriorities")}</dt><dd>{order.map((need) => needLabel(need, t)).join(" · ")}</dd></div>
          <div><dt>{t("dtTools")}</dt><dd>{selected.length ? t("toolsSelected", { tools: selected.map(providerName).join(", ") }) : t("toolsLater")}</dd></div>
        </dl><button type="button" className="op-text-button" onClick={() => edit(4)}>{t("editTools")}</button>
      </aside>
    </div>
    <footer className="op-finish-footer"><p className="op-help">{t("finishNote")}</p><div className="op-edit-links"><button type="button" className="op-text-button" onClick={() => edit(4)}>{t("back")}</button><button type="button" className="op-text-button" onClick={restart}>{t("restart")}</button></div></footer>
  </div>;
}
