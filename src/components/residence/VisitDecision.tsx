"use client";
import { useState } from "react";
import { Button, Pill, Segmented } from "@/components/ui";
import { HELP, HOUSEHOLD, PATH, PERSON } from "./data";
import { Activity, Block, CasePath, Fact, StatusLine } from "./parts";

/* Stage 5 · Fingerprint visit, stage 6 · Decision, stage 7 · Card and after. */

export function VisitScreen() {
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 5 of 7 · Office visit</p>
      <h1 className="rp-h1">Fingerprints on Thursday</h1>
      <div className="rp-deadline">
        <div><span className="ui-meta">Thu 18 Mar 2027 · 10:40</span><b>{PERSON.address}</b></div>
        <div className="rp-deadline-left"><b className="ui-num">2</b><span>days</span></div>
      </div>
      <div className="rp-callout tone-deadline">
        <b>Do not miss this visit</b>
        <span>If you do not come, the office closes your case (art. 106i). If you cannot make it, ask for a new date before Thursday.</span>
      </div>
      <Block title="Bring">
        <div className="rp-stack">
          <Fact icon="card" tone="ok" title="Your passport" sub="The original. They check it against your application." />
          <Fact icon="letter" tone="ok" title="The summons" sub="On your phone is fine" />
        </div>
        <p className="rp-note">In Warsaw the counter takes only fingerprints and your signature. Documents go by e-Doręczenia, not on paper.</p>
      </Block>
      <Activity
        title="At the counter"
        steps={[
          { state: "done", title: "Rehearsed on Tuesday", sub: "Six questions the official may ask, in Polish" },
          { state: "next", title: "Phone flat on the desk", sub: "The official reads Polish, you read English, both hear it spoken" },
          { state: "next", title: "Wrap-up saved to your case", sub: "What was asked, what you said, what to do next" },
        ]}
        foot={<><span className="ui-meta">Polish on her side, your language on yours</span><Button size="sm" variant="primary" icon="counter">Open Counter</Button></>}
      />
    </div>
  );
}

export function DecisionScreen() {
  const [result, setResult] = useState<"yes" | "no">("yes");
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 6 of 7 · Decision</p>
      <Segmented<"yes" | "no"> label="Preview outcome" value={result} onChange={setResult} options={[{ value: "yes", label: "Approved" }, { value: "no", label: "Refused" }]} />
      {result === "yes" ? (
        <>
          <StatusLine word="Approved" tone="ok" sub="Your permit is granted until 30 Sep 2029. The card is being printed." pct={100} left="Filed 8 Dec 2026" right="Decided 12 Nov 2027" />
          <Block title="Collect your card">
            <div className="rp-stack">
              <Fact icon="calendar" tone="ok" title="Mon 6 Dec 2027 · 09:20" sub={PERSON.address} />
              <Fact icon="check" tone="ok" title="Card fee already paid" sub="100 zł, receipt in your case since 3 Dec 2026" />
              <Fact icon="card" title="Bring your passport" sub="Collection is in person" />
            </div>
          </Block>
        </>
      ) : (
        <>
          <StatusLine word="Refused" tone="deadline" sub="You can appeal. The last day is Fri 26 Nov 2027." pct={100} left="Delivered 12 Nov" right="14 days to appeal" />
          <div className="rp-callout tone-deadline">
            <b>Get a person to look at this today</b>
            <span>An appeal goes to the Head of the Office for Foreigners through the voivode, within 14 days of delivery (KPA art. 129). Dossierly gathers your documents and dates; a lawyer or legal aid writes the appeal.</span>
          </div>
          <div className="rp-stack">{HELP.map((h) => <Fact key={h.name} icon="scale" title={h.name} sub={h.sub} />)}</div>
        </>
      )}
    </div>
  );
}

export function AfterScreen() {
  return (
    <div className="rp-screen">
      <p className="rp-eyebrow">Stage 7 of 7 · Card and after</p>
      <h1 className="rp-h1">Card collected</h1>
      <StatusLine word="Valid" tone="ok" sub="Start preparing your next permit in July 2029. We will remind you and your family." pct={4} left="Today" right="Card ends 30 Sep 2029" />
      <Block title="While your card is valid">
        <div className="rp-stack">
          <Fact icon="case" tone="warn" title="Lose your job?" sub="Report it to the office within 15 working days (art. 121)" />
          <Fact icon="pin" tone="warn" title="Move house?" sub="Register the new address, then exchange the card within 14 days" />
          <Fact icon="alert" title="Card lost or damaged?" sub="Apply for a new one; you get a free temporary certificate" />
        </div>
      </Block>
      <Block title="Your household">
        <div className="rp-stack">
          {HOUSEHOLD.map((m, i) => (
            <Fact key={m.name} icon="user" title={m.name} sub={m.role} end={<Pill tone={i === 0 ? "ok" : "warn"}>{i === 0 ? "Card collected" : "Decision pending"}</Pill>} />
          ))}
        </div>
        <p className="rp-note">Family permits end with yours, so all three renew together. Start preparing on Mon 2 Jul 2029.</p>
      </Block>
      <Block title="The whole case"><CasePath items={PATH} current="after" /></Block>
    </div>
  );
}
