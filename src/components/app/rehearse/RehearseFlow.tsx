"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import type { RehearseFeedback } from "@/lib/voice/protocol";
import { useT } from "@/lib/i18n/client";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink, Pill, ScreenTitle } from "@/components/ui";
import { LatencyLine, useLangName } from "@/components/voice/bits";
import { VoiceScreen } from "@/components/voice/Screen";
import "@/components/voice/voice.css";
import "./rehearse.css";

const QUESTIONS = 6;

function Feedback({ fb }: { fb: RehearseFeedback }) {
  const t = useT("rehearse");
  return (
    <section className="rh-feedback" aria-label={t("feedbackAria")}>
      <div className="rh-score" style={{ ["--p" as string]: `${fb.score}%` }} aria-label={t("readinessAria", { score: fb.score })}>
        <b>{fb.score}</b><small>{t("ready")}</small>
      </div>
      <p className="rh-summary">{fb.summary}</p>
      {fb.went_well.length > 0 && (
        <div>
          <h3>{t("wentWell")}</h3>
          <ul className="rh-list">{fb.went_well.map((w) => <li key={w}><Icon name="check" size={16} />{w}</li>)}</ul>
        </div>
      )}
      {fb.practise.length > 0 && (
        <div>
          <h3>{t("practise")}</h3>
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
  const t = useT("rehearse");
  const tv = useT("voice");
  const langName = useLangName();
  const call = useAgentCall({ mode: "rehearse" });
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const live = call.status === "live";
  const asked = call.turns.filter((t) => t.who === "official" && !t.partial).length;
  const lang = langName(call.lang || "en");

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [call.turns, call.coach, call.partial]);

  if (call.feedback) {
    return (
      <VoiceScreen
        label={t("feedbackLabel")}
        title={t("feedbackTitle")}
        close="/app/counter"
        foot={<Button variant="primary" size="lg" block onClick={() => void call.start()}>{t("again")}</Button>}
        secondary={<ButtonLink href="/app/counter" variant="ghost">{t("backCounter")}</ButtonLink>}
      >
        <Feedback fb={call.feedback} />
      </VoiceScreen>
    );
  }

  if (call.status === "idle" || (call.status === "error" && !call.turns.length)) {
    return (
      <VoiceScreen
        label={t("label")}
        close="/app/counter"
        foot={<Button variant="agent" size="lg" icon="mic" block onClick={() => void call.start()}>{call.error ? tv("tryAgain") : t("start")}</Button>}
      >
        <ScreenTitle title={t("introTitle")} sub={t("introSub", { lang })} />
        <ol className="vs-steps">
          <li>{t("step1", { lang })}</li>
          <li>{t("step2", { n: QUESTIONS })}</li>
        </ol>
        {call.error && <p className="vc-error" role="alert">{call.error}</p>}
        <p className="vs-fine">{t("fine")}</p>
      </VoiceScreen>
    );
  }

  const ending = asked >= QUESTIONS || call.status === "ended";
  return (
    <VoiceScreen
      label={t("rehearsal")}
      title={<>{t("rehearsal")}<small>{t("questionOf", { n: Math.min(Math.max(asked, 1), QUESTIONS), total: QUESTIONS })}</small></>}
      close="/app/counter"
      action={<Pill tone="official">{t("aiOfficial")}</Pill>}
      progress={{ at: Math.min(asked, QUESTIONS), of: QUESTIONS }}
      live
      tall={live}
      foot={<>
        {live && (
          <form className="vc-type" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { call.sendText(draft.trim(), "user"); setDraft(""); } }}>
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("typePlaceholder")} aria-label={t("typeAria")} enterKeyHint="send" />
            <Button type="submit" variant="primary" disabled={!draft.trim()}>{t("answer")}</Button>
          </form>
        )}
        <div className="vc-controls">
          {live && <button className={`vc-round ${call.muted ? "is-on" : ""}`} onClick={() => call.setMuted(!call.muted)} aria-pressed={call.muted} aria-label={call.muted ? tv("unmute") : tv("mute")}><Icon name="mic" size={22} /><small>{call.muted ? tv("unmute") : tv("mute")}</small></button>}
          {live && <button className="vc-round vc-end" onClick={call.stop} aria-label={t("endAria")}><Icon name="out" size={22} /><small>{tv("end")}</small></button>}
          {!live && !ending && <Button size="lg" block disabled loading>{tv("connecting")}</Button>}
        </div>
      </>}
    >
      <div className="rh-turns" ref={scroller} aria-live="polite">
        {call.micWaiting && <p className="rh-wait">{t("micWait")}</p>}
        {call.turns.map((turn) =>
          turn.who === "official" ? (
            <div key={turn.id} className="rh-official">
              <p lang="pl">{turn.text}</p>
              {turn.translation && <small>{turn.translation}</small>}
              {call.coach.filter((c) => c.turnId === turn.id).map((c) => <p key={c.toUser} className="rh-tip"><Icon name="help" size={14} /> {c.toUser}</p>)}
            </div>
          ) : (
            <p key={turn.id} className="rh-you"><span>{t("you")}</span>{turn.text}</p>
          ),
        )}
        {call.partial && <p className="rh-you is-partial"><span>{t("you")}</span>{call.partial}</p>}
        {ending && !call.feedback && <p className="rh-wait">{t("preparingFeedback")}</p>}
      </div>
      {call.error && <p className="vc-error" role="alert">{call.error}</p>}
      <LatencyLine metrics={call.metrics} />
    </VoiceScreen>
  );
}
