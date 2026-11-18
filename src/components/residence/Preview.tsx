"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button, cx } from "@/components/ui";
import { STAGES, type StageId } from "./data";
import { StartScreen } from "./StartScreen";
import { FileScreen, PrepareScreen } from "./PrepareFile";
import { LetterScreen, WaitingScreen } from "./WaitLetter";
import { AfterScreen, DecisionScreen, VisitScreen } from "./VisitDecision";
import "./residence.css";

/* Tap-through preview of the approved 8-stage residence flow. The chips jump to any stage; Next follows the
   story in order. Stage order in the story: Start, Prepare, File, Waiting, Letter, Visit, Decision, After. */

const SCREENS: Record<StageId, (p: { go: (s: StageId) => void }) => React.ReactNode> = {
  start: ({ go }) => <StartScreen onDone={() => go("prepare")} />,
  prepare: () => <PrepareScreen />,
  file: () => <FileScreen />,
  waiting: () => <WaitingScreen />,
  letter: () => <LetterScreen />,
  visit: () => <VisitScreen />,
  decision: () => <DecisionScreen />,
  after: () => <AfterScreen />,
};

export function ResidencePreview() {
  const [stage, setStage] = useState<StageId>("start");
  useEffect(() => {
    const h = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the deep-link hash once after hydration
    if (STAGES.some((s) => s.id === h)) setStage(h as StageId);
  }, []);
  const i = STAGES.findIndex((s) => s.id === stage);
  const go = (s: StageId) => {
    setStage(s);
    window.history.replaceState(null, "", `#${s}`);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    document.querySelector(`[data-stage="${stage}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [stage]);
  const cur = STAGES[i]!;

  return (
    <div className="rp">
      <header className="rp-top">
        <div className="rp-top-row">
          <Logo size={22} />
          <span className="rp-top-tag">Preview · residence case</span>
        </div>
        <nav className="rp-chips" aria-label="Stages">
          {STAGES.map((s) => (
            <button key={s.id} type="button" data-stage={s.id} className={cx("rp-chip", s.id === stage && "is-on")} aria-current={s.id === stage ? "step" : undefined} onClick={() => go(s.id)}>
              <span className="ui-num">{s.n}</span>{s.short}
            </button>
          ))}
        </nav>
        <p className="rp-when">{cur.name} · as of {cur.when}</p>
      </header>

      <main className="rp-main" key={stage}>{SCREENS[stage]({ go })}</main>

      {stage !== "start" && (
        <nav className="rp-pager" aria-label="Previous and next stage">
          <Button variant="ghost" icon="back" disabled={i === 0} onClick={() => go(STAGES[i - 1]!.id)}>{STAGES[i - 1]?.short}</Button>
          {i < STAGES.length - 1 && <Button variant="primary" iconEnd="forward" onClick={() => go(STAGES[i + 1]!.id)}>{STAGES[i + 1]!.name}</Button>}
        </nav>
      )}
      <p className="rp-foot">Generated example household. Dossierly organises your case and explains letters; it is not a lawyer and does not give legal advice.</p>
    </div>
  );
}
