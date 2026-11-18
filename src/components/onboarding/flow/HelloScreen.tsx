"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { AgentOrb, Button, StickyActionBar } from "@/components/ui";
import { LatencyLine } from "@/components/voice/bits";
import { useVoiceIntake } from "./useVoiceIntake";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n/client";

/** Message keys for the line under the orb; "speaking" and "done" show the product name. */
const STATUS = { idle: "", starting: "statusStarting", listening: "statusListening", thinking: "statusThinking", speaking: "", done: "" } as const;

/**
 * First run, voice first: the person says who they are in their own words and Dossierly answers out loud.
 * `onEmail` is the yes to "Can I look at your email?"; `onType` falls back to the one-question-per-screen setup.
 */
export function HelloScreen({ onProfile, onEmail, onType }: { onProfile(p: Profile): void; onEmail(): void; onType(): void }) {
  const t = useT("onboarding");
  const v = useVoiceIntake((r) => onProfile(r.profile));
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const live = v.state === "listening" || v.state === "speaking";
  const busy = v.state === "starting" || v.state === "thinking" || v.state === "speaking";

  return (
    <div className="ob-answer ob-voice">
      <LanguagePicker compact className="ob-lang" />
      <div className="ob-voice-orb" data-state={v.state}>
        <button type="button" className="ob-voice-tap" disabled={busy || v.state === "done"} aria-label={v.state === "listening" ? t("stopListening") : t("tapAndTalk")}
          onClick={() => void (v.state === "listening" ? v.stop() : v.start())}>
          <AgentOrb size={112} state={live ? "live" : v.state === "idle" ? "still" : "idle"} icon={v.state === "idle" || v.state === "listening" ? "mic" : undefined} />
        </button>
        <span className="ob-voice-status" aria-live="polite">{v.state === "speaking" || v.state === "done" ? "Dossierly" : STATUS[v.state] ? t(STATUS[v.state]) : ""}</span>
      </div>
      {(v.heard || v.state === "listening") && (
        <figure className="ob-voice-line" data-who="you">
          <figcaption>{t("you")}</figcaption>
          <blockquote>{v.heard || <span className="ob-voice-wait">{t("goAhead")}</span>}</blockquote>
        </figure>
      )}
      {v.reply && (
        <figure className="ob-voice-line" data-who="agent">
          <figcaption>Dossierly</figcaption>
          <blockquote>{v.reply}</blockquote>
        </figure>
      )}
      {v.reply && <LatencyLine metrics={v.metrics} />}
      {typing && v.state === "idle" && (
        <form className="ob-field" onSubmit={(e) => { e.preventDefault(); if (text.trim().length > 1) void v.typed(text.trim()); }}>
          <span>{t("ownWords")}</span>
          <textarea className="input ob-voice-text" rows={3} maxLength={600} autoFocus value={text} placeholder={t("ownWordsPlaceholder")}
            onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={text.trim().length < 2}>{t("send")}</Button>
        </form>
      )}
      {v.error && <div className="ob-alert" role="alert"><p>{v.error}</p></div>}
      {v.state === "done" && (
        <div className="ob-conn ob-conn-ask">
          <span className="ob-conn-mark" data-provider="gmail" aria-hidden="true">M</span>
          <div className="ob-conn-body">
            <div className="ob-conn-head"><strong>Gmail</strong></div>
            <p>{t("gmailWhat")}</p>
            <small>{t("gmailScope")}</small>
          </div>
        </div>
      )}
      {v.state === "done" ? (
        <StickyActionBar secondary={<Button variant="ghost" onClick={onType}>{t("notNow")}</Button>}>
          <Button variant="primary" size="lg" icon="mail" onClick={onEmail}>{t("connectGmail")}</Button>
        </StickyActionBar>
      ) : v.state === "listening" ? (
        <StickyActionBar secondary={<Button variant="ghost" onClick={() => v.stop()}>{t("cancel")}</Button>}>
          <Button variant="primary" size="lg" icon="mic" disabled>{t("listeningJustTalk")}</Button>
        </StickyActionBar>
      ) : (
        <StickyActionBar secondary={!busy && <Button variant="ghost" icon="keyboard" onClick={() => (typing ? onType() : setTyping(true))}>{typing ? t("stepByStep") : t("typeInstead")}</Button>}>
          <Button variant="primary" size="lg" icon="mic" disabled={busy} loading={busy} onClick={() => void v.start()}>
            {v.state === "thinking" ? t("statusThinking") : v.state === "speaking" ? t("speaking") : v.state === "starting" ? t("starting") : v.heard ? t("talkAgain") : t("tapAndTalk")}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
