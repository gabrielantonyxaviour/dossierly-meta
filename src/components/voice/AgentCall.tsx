"use client";

import { SampleCaseHint } from "./SampleCaseHint";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import type { VoiceTurn } from "@/lib/voice/protocol";
import { Icon } from "../Icon";
import { Captured, LatencyLine } from "./bits";
import "./voice.css";

export type AgentCallMode = "welcome" | "agent" | "counter" | "rehearse";

export interface AgentCallProps {
  mode: AgentCallMode;
  /** welcome: the server-generated opening line Dossierly speaks first. */
  script?: string;
  onEnd?: () => void;
  /** Start as soon as it mounts (needs a prior user gesture on the page for audio). */
  autoStart?: boolean;
}

const TITLE: Record<AgentCallMode, string> = {
  welcome: "Your welcome call",
  agent: "Talk to Dossierly",
  counter: "Counter",
  rehearse: "Rehearse",
};

function useClock(on: boolean): string {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = Date.now() - s * 1000;
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Line({ t, name }: { t: VoiceTurn; name: string }) {
  return (
    <p className={`vc-line vc-line-${t.who}`}>
      <span className="vc-who">{t.who === "agent" ? "Dossierly" : name}</span>
      {t.text}
    </p>
  );
}

/** Voice call with the caseworker. Used in-app ("Talk to Dossierly") and by Onboarding for the welcome call. */
export function AgentCall({ mode, script, onEnd, autoStart }: AgentCallProps) {
  const call = useAgentCall({ mode, script, onEnd });
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const live = call.status === "live";
  const clock = useClock(live);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void call.start();
    }
  }, [autoStart, call]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [call.turns, call.partial]);

  const last = call.turns[call.turns.length - 1];
  const state = useMemo(() => {
    if (call.micWaiting) return "Allow the microphone to start";
    if (call.status === "connecting") return "Connecting…";
    if (call.status !== "live") return null;
    if (call.speaking) return "Dossierly is speaking";
    if (call.partial) return "Listening…";
    if (last && last.who === "user") return "Thinking…";
    return call.muted ? "Muted" : "Listening";
  }, [call.status, call.speaking, call.partial, call.muted, call.micWaiting, last]);

  const name = call.userName?.split(/\s+/)[0] ?? "You";
  const orbScale = 1 + Math.min(0.35, call.level * 4);

  if (call.status === "idle" || ((call.status === "ended" || call.status === "error") && !call.turns.length)) {
    return (
      <section className="vc card" aria-label={TITLE[mode]}>
        <div className="vc-idle">
          <div className="vc-orb is-idle" aria-hidden><Icon name="speak" size={30} /></div>
          <h2>{TITLE[mode]}</h2>
          <p className="muted">
            {mode === "welcome" ? "Dossierly walks you through what it found in your case." : "Ask anything about your case, out loud. Dossierly knows your letters, deadlines and documents."}
          </p>
          <SampleCaseHint />
          {call.error && <p className="vc-error" role="alert">{call.error}</p>}
          <button className="btn btn-primary vc-start" onClick={() => void call.start()}>
            <Icon name="mic" size={18} /> {call.error ? "Try again" : mode === "welcome" ? "Start the call" : "Call Dossierly"}
          </button>
          <p className="vc-fine">Your voice goes through our server to Meta&rsquo;s speech model, never straight from your browser. You are talking to an AI.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`vc card is-${call.status}`} aria-label={TITLE[mode]}>
      <header className="vc-head">
        <span className={`vc-dot ${live ? "on" : ""}`} aria-hidden />
        <b>{TITLE[mode]}</b>
        <span className="vc-clock">{live ? clock : call.status === "ended" ? "Call ended" : ""}</span>
        <span className="chip chip-ai" title="You are talking to an AI system">AI</span>
      </header>

      <div className="vc-stage">
        <div className={`vc-orb ${call.speaking ? "is-speaking" : ""} ${call.partial ? "is-hearing" : ""}`} style={{ transform: call.partial ? `scale(${orbScale})` : undefined }} aria-hidden>
          <span /><span /><span />
        </div>
        <p className="vc-state" aria-live="polite">{state ?? (call.status === "ended" ? "Call ended" : "")}</p>
      </div>

      <div className="vc-captions" ref={scroller} aria-live="polite">
        {call.turns.slice(-6).map((t) => <Line key={t.id} t={t} name={name} />)}
        {call.partial && <p className="vc-line vc-line-user is-partial"><span className="vc-who">{name}</span>{call.partial}</p>}
      </div>

      <Captured items={call.captured} />
      {call.error && <p className="vc-error" role="alert">{call.error}</p>}
      <LatencyLine metrics={call.metrics} />

      {typing && live && (
        <form className="vc-type" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { call.sendText(draft.trim()); setDraft(""); } }}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type instead of speaking" aria-label="Type a message" autoFocus />
          <button className="btn" type="submit" disabled={!draft.trim()}>Send</button>
        </form>
      )}

      <div className="vc-controls">
        {live ? (
          <>
            <button className={`vc-round ${call.muted ? "is-on" : ""}`} onClick={() => call.setMuted(!call.muted)} aria-pressed={call.muted} aria-label={call.muted ? "Unmute" : "Mute"}>
              <Icon name="mic" size={20} /><small>{call.muted ? "Unmute" : "Mute"}</small>
            </button>
            <button className={`vc-round ${typing ? "is-on" : ""}`} onClick={() => setTyping((v) => !v)} aria-pressed={typing} aria-label="Type">
              <Icon name="keyboard" size={20} /><small>Type</small>
            </button>
            <button className="vc-round vc-end" onClick={call.stop} aria-label="End call">
              <Icon name="out" size={20} /><small>End</small>
            </button>
          </>
        ) : call.status === "connecting" ? (
          <button className="btn btn-block" disabled>Connecting…</button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => void call.start()}>Call again</button>
        )}
      </div>
    </section>
  );
}
