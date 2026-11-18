"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, OptionList, Pill } from "@/components/ui";
import { HOUSEHOLD, PERSON } from "./data";
import { Fact } from "./parts";

/* Stage 0 · Start. Reference A: ReUI Wizard-1 (numbered stepper, one question per step, summary at the end). */

type Situation = "renew" | "family" | "letter" | "first";
type Ground = "work" | "blue" | "family" | "study";
const STEPS = ["Situation", "Permit", "Dates", "Family", "Plan"] as const;

export function StartScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState<Situation | null>("renew");
  const [ground, setGround] = useState<Ground | null>("work");
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : onDone());

  return (
    <div className="rp-screen">
      <ol className="rp-stepper" aria-label="Set up your case">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "is-done" : i === step ? "is-now" : undefined}>
            <span className="rp-stepper-n ui-num">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="rp-stepper-label">{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <h1 className="rp-h1">What brings you here?</h1>
          <OptionList<Situation> label="Your situation" value={situation} onChange={setSituation} options={[
            { value: "renew", icon: "refresh", label: "My permit is ending and I need a new one", sub: "The most common case" },
            { value: "family", icon: "user", label: "A permit for my spouse or child", sub: "Family members of someone working here" },
            { value: "letter", icon: "letter", label: "I got a letter about my case", sub: "Photograph it or forward the email" },
            { value: "first", icon: "case", label: "My first permit in Poland", sub: "You are here on a visa now" },
          ]} />
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="rp-h1">What is your permit for?</h1>
          <OptionList<Ground> label="Permit ground" value={ground} onChange={setGround} options={[
            { value: "work", icon: "case", label: "Work", sub: "Single permit (pobyt i praca)" },
            { value: "blue", icon: "card", label: "EU Blue Card", sub: "Highly qualified work" },
            { value: "family", icon: "user", label: "Joining family", sub: "Spouse or child of a permit holder" },
            { value: "study", icon: "book", label: "Study", sub: "University studies in Poland" },
          ]} />
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="rp-h1">Where and until when?</h1>
          <div className="rp-fields">
            <label className="ui-field"><span className="ui-meta">Where you live</span><span className="ui-input rp-fake-input">Mazowieckie (Warsaw)</span></label>
            <label className="ui-field"><span className="ui-meta">Your current card is valid until</span><span className="ui-input rp-fake-input ui-num">14 January 2027</span></label>
          </div>
          <div className="rp-callout tone-user">
            <b>File by {PERSON.fileBy}</b>
            <span>The last day of your legal stay (art. 105). One day late and the application can be refused.</span>
            <span className="rp-callout-hint">Start preparing on <b>{PERSON.startBy}</b>: the employer step alone can take weeks.</span>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="rp-h1">Who else needs a permit?</h1>
          <p className="rp-lead">Employers often pay for your permit only. Each family member has their own case, linked to yours.</p>
          <div className="rp-stack">
            {HOUSEHOLD.slice(1).map((m) => <Fact key={m.name} icon="user" title={m.name} sub={m.role} end={<Icon name="check" size={16} />} tone="ok" />)}
            <Button variant="secondary" icon="plus" block>Add a family member</Button>
          </div>
          <div className="rp-callout">
            <b>Family permit check</b>
            <span>You have held permits since 2023, so your family can apply now (art. 159). Income needed: 823 zł net a month per person, 2,469 zł for three. Yours is above it.</span>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="rp-h1">Your plan is ready</h1>
          <p className="rp-lead">Three linked cases. Dossierly watches your mail and tells you what to do next, one step at a time.</p>
          <div className="rp-stack">
            {HOUSEHOLD.map((m) => <Fact key={m.name} icon="case" title={m.name} sub={`${m.role} · ${m.fee}`} end={<Pill tone="warn">Prepare</Pill>} />)}
          </div>
          <div className="rp-callout tone-user"><b>Next: open your e-Doręczenia mailbox</b><span>The office sends its letters there. It takes ten minutes with Profil Zaufany.</span></div>
        </>
      )}

      <div className="rp-wizard-foot">
        {step > 0 && <Button variant="ghost" icon="back" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button variant="primary" iconEnd="forward" onClick={next}>{step === STEPS.length - 1 ? "Open my case" : "Continue"}</Button>
      </div>
    </div>
  );
}
