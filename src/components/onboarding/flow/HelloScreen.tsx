"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { AgentOrb, Button, StickyActionBar } from "@/components/ui";
import { useVoiceIntake } from "./useVoiceIntake";

const STATUS = { idle: "", starting: "Opening the microphone…", listening: "Listening", thinking: "Thinking…", speaking: "Dossierly", done: "Dossierly" } as const;

/**
 * First run, voice first: the person says who they are in their own words and Dossierly answers out loud.
 * `onEmail` is the yes to "Can I look at your email?"; `onType` falls back to the one-question-per-screen setup.
 */
export function HelloScreen({ onProfile, onEmail, onType }: { onProfile(p: Profile): void; onEmail(): void; onType(): void }) {
  const v = useVoiceIntake((r) => onProfile(r.profile));
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const live = v.state === "listening" || v.state === "speaking";
  const busy = v.state === "starting" || v.state === "thinking" || v.state === "speaking";

  return (
    <div className="ob-answer ob-voice">
      <div className="ob-voice-orb" data-state={v.state}>
        <AgentOrb size={112} state={live ? "live" : v.state === "idle" ? "still" : "idle"} icon={v.state === "idle" || v.state === "listening" ? "mic" : undefined} />
        <span className="ob-voice-status" aria-live="polite">{STATUS[v.state]}</span>
      </div>
      {(v.heard || v.state === "listening") && (
        <figure className="ob-voice-line" data-who="you">
          <figcaption>You</figcaption>
          <blockquote>{v.heard || <span className="ob-voice-wait">Go ahead, I’m listening…</span>}</blockquote>
        </figure>
      )}
      {v.reply && (
        <figure className="ob-voice-line" data-who="agent">
          <figcaption>Dossierly</figcaption>
          <blockquote>{v.reply}</blockquote>
        </figure>
      )}
      {typing && v.state === "idle" && (
        <form className="ob-field" onSubmit={(e) => { e.preventDefault(); if (text.trim().length > 1) void v.typed(text.trim()); }}>
          <span>In your own words</span>
          <textarea className="input ob-voice-text" rows={3} maxLength={600} autoFocus value={text} placeholder="I’m Arjun, I study in Warsaw, and I got a letter from the office."
            onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={text.trim().length < 2}>Send</Button>
        </form>
      )}
      {v.error && <div className="ob-alert" role="alert"><p>{v.error}</p></div>}
      {v.state === "done" ? (
        <StickyActionBar secondary={<Button variant="ghost" onClick={onType}>Not now</Button>}>
          <Button variant="primary" size="lg" icon="mail" onClick={onEmail}>Yes, look at my email</Button>
        </StickyActionBar>
      ) : v.state === "listening" ? (
        <StickyActionBar><Button variant="primary" size="lg" icon="stop" onClick={() => void v.stop()}>Done talking</Button></StickyActionBar>
      ) : (
        <StickyActionBar secondary={!busy && <Button variant="ghost" icon="keyboard" onClick={() => (typing ? onType() : setTyping(true))}>{typing ? "Answer step by step instead" : "Type instead"}</Button>}>
          <Button variant="primary" size="lg" icon="mic" disabled={busy} loading={busy} onClick={() => void v.start()}>
            {v.state === "thinking" ? "Thinking…" : v.state === "speaking" ? "Speaking…" : v.state === "starting" ? "Starting…" : v.heard ? "Talk again" : "Tap and talk"}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
