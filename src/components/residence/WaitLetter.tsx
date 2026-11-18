"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BottomSheet, Button, Pill } from "@/components/ui";
import { HELP, LETTER, PERSON, WAIT_PATH } from "./data";
import { Activity, Block, CasePath, Fact, StatusLine } from "./parts";

/* Stage 3 · Waiting (reference B's status line over reference A's timeline) and stage 4 · Letter arrives
   (reference A: Agent Activity-1, "what Dossierly did" and "what only you can do"). */

export function WaitingScreen() {
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 3 of 7 · Waiting</p>
      <StatusLine word="Waiting" sub="Nothing for you to do. Dossierly reads every letter and email the day it arrives." pct={(55 / 394) * 100} left="Day 55" right="Average: 394 days" />
      <Block title="What you can do now">
        <div className="rp-stack">
          <Fact icon="shield" tone="ok" title="Stay and work in Poland" sub="Your certificate of legal stay (zaświadczenie, 21 Dec) covers you until the decision" />
          <Fact icon="alert" tone="deadline" title="Do not travel outside Poland" sub="The certificate is not a travel document. Your card expired on 14 Jan." />
          <Fact icon="case" tone="warn" title="Changing job? Tell us first" sub="A new employer means a change application. Losing your job must be reported within 15 working days." />
        </div>
      </Block>
      <Block title="Your case" aside={<span className="ui-meta">{PERSON.caseNo}</span>}>
        <CasePath items={WAIT_PATH} current="review" />
      </Block>
      <p className="rp-note">Mazowieckie decided 89% of cases in more than 6 months and 41% in more than 12 (MSWiA, July 2026). A long wait is normal and does not mean something is wrong.</p>
    </div>
  );
}

export function LetterScreen() {
  const [polish, setPolish] = useState(false);
  const [help, setHelp] = useState(false);
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 4 of 7 · A letter arrived</p>
      <div className="rp-letter-head">
        <Pill tone="official" icon="letter">{LETTER.kind}</Pill>
        <h1 className="rp-h1">The office wants two documents</h1>
        <p className="rp-lead">From {LETTER.from}, delivered to your {LETTER.via} box on {LETTER.delivered}.</p>
      </div>

      <div className="rp-deadline">
        <div><span className="ui-meta">Last day</span><b className="ui-num">{LETTER.deadline}</b></div>
        <div className="rp-deadline-left"><b className="ui-num">{LETTER.daysLeft}</b><span>days left</span></div>
      </div>

      <Block title="What it asks for" aside={<button type="button" className="rp-link" onClick={() => setPolish(!polish)}>{polish ? "Hide Polish" : "Show the Polish"}</button>}>
        {polish && <blockquote className="rp-quote" lang="pl">{LETTER.polish}</blockquote>}
        <div className="rp-stack">
          {LETTER.asks.map((a) => <Fact key={a.what} icon={a.have ? "check" : "file"} tone={a.have ? "ok" : "warn"} title={a.what} sub={a.sub} end={a.have ? "In your case" : "Missing"} />)}
        </div>
      </Block>

      <Activity
        title="Handled so far"
        badge={<Pill tone="warn">Needs you</Pill>}
        steps={[
          { state: "done", title: "Read the letter", sub: "The Polish text is kept beside the explanation" },
          { state: "done", title: "Linked it to your case", sub: PERSON.caseNo },
          { state: "done", title: "Counted the deadline", sub: `${LETTER.basis}: at least 14 days` },
          { state: "done", title: "Told you", sub: "Email and app alert, Tue 16 Feb 07:12" },
          { state: "you", title: "Ask HR for the certificate", sub: "Email to Northwind HR drafted for you", tag: { tone: "warn", text: "Stops for you" } },
          { state: "you", title: "Send both documents", sub: "Cover note drafted with your case number", tag: { tone: "deadline", text: "Your approval" } },
        ]}
        foot={<><span className="ui-meta">Step 5 of 6</span><Button size="sm" variant="primary" icon="mail">Open the HR email</Button></>}
      />

      <Block title="How the deadline is counted">
        <ol className="rp-count">{LETTER.count.map((c) => <li key={c}>{c}</li>)}</ol>
        <p className="rp-note">If HR cannot deliver in time, tell Dossierly before the last day: it drafts a request to the office for more time.</p>
      </Block>

      <Block title="Your plan" aside={<span className="ui-meta">Tap a day to move it</span>}>
        <ul className="rp-plan">
          {LETTER.plan.map((p) => (
            <li key={p.day} className={p.deadline ? "is-deadline" : undefined}>
              <span className="rp-plan-day ui-num">{p.day}</span><span>{p.what}</span>{!p.deadline && <Icon name="calendar" size={16} />}
            </li>
          ))}
        </ul>
      </Block>

      <Button variant="secondary" icon="help" block onClick={() => setHelp(true)}>Talk to a person about this</Button>
      <BottomSheet open={help} onClose={() => setHelp(false)} title="Talk to a person">
        <p className="rp-lead">Dossierly is not a lawyer. For anything you are unsure about, these can help:</p>
        <div className="rp-stack">{HELP.map((h) => <Fact key={h.name} icon="scale" title={h.name} sub={h.sub} end={<Icon name="external" size={16} />} />)}</div>
      </BottomSheet>
    </div>
  );
}
