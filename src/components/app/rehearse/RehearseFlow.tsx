"use client";

import { SampleCaseHint } from "@/components/voice/SampleCaseHint";
import { useEffect, useRef, useState } from "react";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import { LANG_NAME, type RehearseFeedback } from "@/lib/voice/protocol";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink, IconLink, Pill } from "@/components/ui";
import { LatencyLine } from "@/components/voice/bits";
import "@/components/voice/voice.css";
import "./rehearse.css";

const QUESTIONS = 6;

function Feedback({ fb, onAgain }: { fb: RehearseFeedback; onAgain: () => void }) {
  return (
    <section className="rh-card rh-feedback" aria-label="Your rehearsal feedback">
      <div className="rh-score" style={{ ["--p" as string]: `${fb.score}%` }} aria-label={`Readiness ${fb.score} out of 100`}>
        <b>{fb.score}</b><small>ready</small>
      </div>
      <p className="rh-summary">{fb.summary}</p>
      {fb.went_well.length > 0 && (
        <div>
          <h3>Went well</h3>
          <ul className="rh-list">{fb.went_well.map((w) => <li key={w}><Icon name="check" size={16} />{w}</li>)}</ul>
        </div>
      )}
      {fb.practise.length > 0 && (
        <div>
          <h3>Practise these</h3>
          <ul className="rh-phrases">
            {fb.practise.map((p) => <li key={p.phrase_pl}><b lang="pl">{p.phrase_pl}</b><span>{p.meaning}</span></li>)}
          </ul>
        </div>
      )}
      <div className="rh-actions">
        <Button variant="primary" onClick={onAgain}>Rehearse again</Button>
        <ButtonLink href="/app/counter">Back to Counter</ButtonLink>
      </div>
    </section>
  );
}

/** Rehearse: a simulated Polish official interviews the user about their real case, then gives feedback. */
export function RehearseFlow() {
  const call = useAgentCall({ mode: "rehearse" });
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const live = call.status === "live";
  const asked = call.turns.filter((t) => t.who === "official" && !t.partial).length;
  const lang = LANG_NAME[call.lang] ?? "English";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [call.turns, call.coach, call.partial]);

  if (call.feedback) return <div className="rh-screen"><div className="ct-start-bar"><IconLink href="/app/counter" icon="close" label="Close" /></div><div className="rh-body"><Feedback fb={call.feedback} onAgain={() => void call.start()} /></div></div>;

  if (call.status === "idle" || (call.status === "error" && !call.turns.length)) {
    return (
      <div className="rh-screen"><div className="ct-start-bar"><IconLink href="/app/counter" icon="close" label="Close" /></div><div className="rh-body">
        <section className="rh-card rh-intro">
          <span className="tab-label"><Icon name="speak" size={16} /> Rehearse</span>
          <h1>Practise the interview before the real one</h1>
          <p className="muted">A simulated official asks you what the office would ask about your case, in Polish, with {lang} subtitles. Answer out loud in Polish or {lang}. After {QUESTIONS} questions you get feedback and the phrases worth practising.</p>
          <SampleCaseHint />
          {call.error && <p className="vc-error" role="alert">{call.error}</p>}
          <Button variant="agent" size="lg" icon="mic" className="rh-go" onClick={() => void call.start()}>{call.error ? "Try again" : "Start rehearsal"}</Button>
          <p className="vc-fine">The official is an AI voice, not a real office. Questions come from your case file.</p>
        </section>
      </div></div>
    );
  }

  const ending = asked >= QUESTIONS || call.status === "ended";
  return (
    <div className="rh-screen"><div className="ct-start-bar"><IconLink href="/app/counter" icon="close" label="Close" /></div><div className="rh-body">
      <section className="rh-card rh-live" aria-label="Rehearsal">
        <header className="vc-head">
          <span className={`vc-dot ${live ? "on" : ""}`} aria-hidden />
          <b>Rehearsal</b>
          <span className="rh-progress" aria-label={`Question ${Math.min(asked, QUESTIONS)} of ${QUESTIONS}`}>
            {Array.from({ length: QUESTIONS }, (_, i) => <i key={i} className={i < asked ? "on" : ""} />)}
          </span>
          <Pill tone="official">AI official</Pill>
        </header>
        <div className="rh-turns" ref={scroller} aria-live="polite">
          {call.micWaiting && <p className="rh-wait">Allow the microphone to start.</p>}
          {call.turns.map((t) =>
            t.who === "official" ? (
              <div key={t.id} className="rh-official">
                <p lang="pl">{t.text}</p>
                {t.translation && <small>{t.translation}</small>}
                {call.coach.filter((c) => c.turnId === t.id).map((c) => <p key={c.toUser} className="rh-tip"><Icon name="help" size={14} /> {c.toUser}</p>)}
              </div>
            ) : (
              <p key={t.id} className="rh-you"><span>You</span>{t.text}</p>
            ),
          )}
          {call.partial && <p className="rh-you is-partial"><span>You</span>{call.partial}</p>}
          {ending && !call.feedback && <p className="rh-wait">Preparing your feedback…</p>}
        </div>
        {call.error && <p className="vc-error" role="alert">{call.error}</p>}
        <LatencyLine metrics={call.metrics} />
        {live && (
          <form className="vc-type" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { call.sendText(draft.trim(), "user"); setDraft(""); } }}>
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Or type your answer" aria-label="Type your answer" />
            <Button type="submit" variant="primary" disabled={!draft.trim()}>Answer</Button>
          </form>
        )}
        <div className="vc-controls">
          {live && <button className={`vc-round ${call.muted ? "is-on" : ""}`} onClick={() => call.setMuted(!call.muted)} aria-pressed={call.muted}><Icon name="mic" size={20} /><small>{call.muted ? "Unmute" : "Mute"}</small></button>}
          {live && <button className="vc-round vc-end" onClick={call.stop} aria-label="End and get feedback"><Icon name="out" size={20} /><small>End</small></button>}
        </div>
      </section>
    </div></div>
  );
}
