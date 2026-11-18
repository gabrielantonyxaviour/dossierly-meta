"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n/client";
import { DetailsStep, PrioritiesStep, SituationStep } from "./SetupSteps";
import { WalkthroughStep } from "./WalkthroughStep";
import { ToolsStep } from "./ToolsStep";
import { emptyChat } from "./CaseChatPreview";
import { StartingPreview } from "./StartingPreview";
import { providerGroup } from "./providers";
import { emptyAnswers, stepsFor, type Answers, type Need, type Tool } from "./content";
import { freshDemo, nextPending, orderedNeeds, reconcileDemos, resolved, type Demo, type Demos } from "./journey";

export function OnboardingPreview() {
  const t = useT("tour");
  const steps = stepsFor(t);
  const [step, setStep] = useState(0);
  const [chat, setChat] = useState(emptyChat);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [demos, setDemos] = useState<Demos>({});
  const [active, setActive] = useState<Need>("letters");
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [expandedTool, setExpandedTool] = useState<Tool | null>(null);
  const [error, setError] = useState("");
  const order = orderedNeeds(answers);
  const demo = demos[active] ?? freshDemo(active, t);

  useEffect(() => {
    document.getElementById("op-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  function update(patch: Partial<Answers>) {
    const next = { ...answers, ...patch };
    setDemos((current) => reconcileDemos(next.needs, current, t));
    if (!next.needs.includes(active) || next.main !== answers.main) setActive(next.main || next.needs[0] || "letters");
    setAnswers(next); setError("");
  }
  function updateDemo(value: Demo) { setDemos((current) => ({ ...current, [active]: value })); setError(""); }
  function go(next: number) { setError(""); setStep(next); }
  function selectExample(need: Need) { setActive(need); setError(""); }
  function fail(message: string, selector: string) {
    setError(message);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
  }
  function advanceExample(nextDemos = demos) {
    const pending = nextPending(order, active, nextDemos);
    if (pending) selectExample(pending); else go(4);
  }
  function skipExample() {
    const next = { ...demos, [active]: { ...demo, skipped: true } };
    setDemos(next); advanceExample(next);
  }
  function skipWalkthrough() {
    setDemos(Object.fromEntries(order.map((need) => [need, { ...demos[need]!, skipped: demos[need]?.phase !== 3 }])));
    go(4);
  }
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && !answers.name.trim()) return fail(t("errName"), "#preview-name");
    if (step === 1 && !answers.reason) return fail(t("errReason"), 'input[name="reason"]');
    if (step === 1 && !answers.stage) return fail(t("errStage"), "#preview-stage");
    if (step === 2 && !answers.needs.length) return fail(t("errNeeds"), ".op-needs input");
    if (step === 2) setActive(order.find((need) => !resolved(demos[need])) ?? order[0]);
    if (step === 3) {
      if (demo.phase === 1 && !demo.action.trim()) return fail(t("errAction"), "#sample-action");
      if (demo.phase < 3) updateDemo({ ...demo, skipped: false, phase: demo.phase + 1 }); else advanceExample();
      return;
    }
    go(step + 1);
  }
  function selectTool(tool: Tool) {
    const wasSelected = selectedTools.includes(tool);
    setSelectedTools((selected) => selected.includes(tool) ? selected.filter((item) => item !== tool) : [...selected.filter((item) => providerGroup(item) !== providerGroup(tool)), tool]);
    setExpandedTool(null);
    requestAnimationFrame(() => document.getElementById(`${wasSelected ? "preview" : "remove"}-tool-${tool}`)?.focus());
  }
  function restart() { setAnswers(emptyAnswers()); setChat(emptyChat()); setDemos({}); setActive("letters"); setSelectedTools([]); setExpandedTool(null); go(0); }
  const primary = step === 3 ? [t("btnExplain"), t("btnPreviewAction"), t("btnConfirmAction"), nextPending(order, active, demos) ? t("btnNextExample") : t("btnToTools")][demo.phase]
    : step === 4 ? t("btnStartScreen") : t("btnContinue");
  const navigation = <footer className="op-navigation">
    {error && <p id="op-error" className="op-error" role="alert">{error}</p>}
    <button className="btn btn-primary" type="submit">{primary}<span aria-hidden="true">→</span></button>
    <div className="op-nav-secondary">
      {step > 0 ? <button className="op-text-button" type="button" onClick={() => go(step - 1)}><span aria-hidden="true">←</span> {t("back")}</button> : <span className="op-help">{t("fiveSteps")}</span>}
      {step === 3 && demo.phase < 3 && <button className="op-text-button" type="button" onClick={skipExample}>{t("skipExample")}</button>}
      {step === 4 && <button className="op-text-button" type="button" onClick={() => { setSelectedTools([]); setExpandedTool(null); go(5); }}>{t("connectLater")}</button>}
    </div>
    {step === 3 && <button className="op-skip-walkthrough op-text-button" type="button" onClick={skipWalkthrough}>{t("skipWalkthrough")}</button>}
  </footer>;

  return <main className="op-preview" data-step={step + 1}>
    <div className="op-shell">
      <header className="op-brand"><Link href="/" prefetch={false} aria-label={t("backHome")}><Logo size={29} /></Link><span className="op-preview-tag">{t("previewTag")}</span><p>{t("choicesStay")}</p></header>
      {step < 5 ? <div className="op-layout" data-wide={step === 3}>
        <div className="op-context">
          <div className="op-progress" role="group" aria-label={t("progressAria", { n: step + 1, total: 5, label: steps[step].label })}><div><span>{t("progress", { n: step + 1, total: 5 })}</span><span>{steps[step].label}</span></div><ol>{steps.map((item, index) => <li key={item.label} data-reached={index <= step} aria-current={step === index ? "step" : undefined}><span className="sr-only">{item.label}</span></li>)}</ol></div>
          <header className="op-heading"><h1 id="op-title" tabIndex={-1}>{steps[step].title}</h1><p>{steps[step].description}</p></header>
          {step !== 3 && <div className="op-context-note"><span className="op-context-number">0{step + 1}</span><p>{t(step === 0 ? "note1" : step === 1 ? "note2" : step === 2 ? "note3" : "note5")}</p></div>}
        </div>
        <form className="op-form" onSubmit={next} noValidate aria-labelledby="op-title">
          {step === 0 && <DetailsStep answers={answers} update={update} error={error} />}
          {step === 1 && <SituationStep answers={answers} update={update} error={error} />}
          {step === 2 && <PrioritiesStep answers={answers} update={update} error={error} />}
          {step === 3 && <WalkthroughStep answers={answers} active={active} order={order} demos={demos} demo={demo} select={selectExample} update={updateDemo} navigation={navigation} error={error} />}
          {step === 4 && <ToolsStep selected={selectedTools} expanded={expandedTool} expand={setExpandedTool} select={selectTool} />}
          {step !== 3 && navigation}
        </form>
      </div> : <StartingPreview answers={answers} chat={chat} updateChat={setChat} demos={demos} selected={selectedTools} edit={go} restart={restart} tryExample={(need) => { setActive(need); go(3); }} />}
    </div>
  </main>;
}
