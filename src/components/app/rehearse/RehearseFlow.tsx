"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import { LANG_NAME, type RehearseFeedback } from "@/lib/voice/protocol";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink, Pill, ScreenTitle } from "@/components/ui";
import { LatencyLine } from "@/components/voice/bits";
import { VoiceScreen } from "@/components/voice/Screen";
import "@/components/voice/voice.css";
import "./rehearse.css";

const QUESTIONS = 6;

function Feedback({ fb }: { fb: RehearseFeedback }) {
  return (
    <section className="rh-feedback" aria-label="Your rehearsal feedback">
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

  if (call.feedback) {
    return (
      <VoiceScreen
        label="Rehearsal feedback"
        title="Feedback"
        close="/app/counter"
        foot={<Button variant="primary" size="lg" block onClick={() => void call.start()}>Rehearse again</Button>}
        secondary={<ButtonLink href="/app/counter" variant="ghost">Back to Counter</ButtonLink>}
      >
        <Feedback fb={call.feedback} />
      </VoiceScreen>
    );
  }

  if (call.status === "idle" || (call.status === "error" && !call.turns.length)) {
    return (
      <VoiceScreen
        label="Rehearse"
        close="/app/counter"
        foot={<Button variant="agent" size="lg" icon="mic" block onClick={() => void call.start()}>{call.error ? "Try again" : "Start rehearsal"}</Button>}
      >
        <ScreenTitle title="Practise the interview" sub={`An AI official asks what the office would ask about your case, in Polish with ${lang} subtitles.`} />
        <ol className="vs-steps">
          <li>Answer out loud, in Polish or {lang}. You can type instead.</li>
          <li>After {QUESTIONS} questions you get a readiness score and the phrases worth practising.</li>
        </ol>
        {call.error && <p className="vc-error" role="alert">{call.error}</p>}
        <p className="vs-fine">The official is an AI voice, not a real office. Questions come from your case file.</p>
      </VoiceScreen>
    );
  }

  const ending = asked >= QUESTIONS || call.status === "ended";
  return (
    <VoiceScreen
      label="Rehearsal"
      title={<>Rehearsal<small>Question {Math.min(Math.max(asked, 1), QUESTIONS)} of {QUESTIONS}</small></>}
      close="/app/counter"
      action={<Pill tone="official">AI official</Pill>}
      progress={{ at: Math.min(asked, QUESTIONS), of: QUESTIONS }}
      live
      tall={live}
      foot={<>
        {live && (
          <form className="vc-type" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { call.sendText(draft.trim(), "user"); setDraft(""); } }}>
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Or type your answer" aria-label="Type your answer" enterKeyHint="send" />
            <Button type="submit" variant="primary" disabled={!draft.trim()}>Answer</Button>
          </form>
        )}
        <div className="vc-controls">
          {live && <button className={`vc-round ${call.muted ? "is-on" : ""}`} onClick={() => call.setMuted(!call.muted)} aria-pressed={call.muted} aria-label={call.muted ? "Unmute" : "Mute"}><Icon name="mic" size={22} /><small>{call.muted ? "Unmute" : "Mute"}</small></button>}
          {live && <button className="vc-round vc-end" onClick={call.stop} aria-label="End and get feedback"><Icon name="out" size={22} /><small>End</small></button>}
          {!live && !ending && <Button size="lg" block disabled loading>Connecting…</Button>}
        </div>
      </>}
    >
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
    </VoiceScreen>
  );
}
