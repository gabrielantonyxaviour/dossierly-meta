"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import type { VoiceTurn } from "@/lib/voice/protocol";
import { AgentOrb, Button, Pill } from "@/components/ui";
import { Icon } from "../Icon";
import { Captured, LatencyLine } from "./bits";
import { VoiceScreen } from "./Screen";
import "./voice.css";

export type AgentCallMode = "welcome" | "agent" | "counter" | "rehearse";

export interface AgentCallProps {
  mode: AgentCallMode;
  /** welcome: the server-generated opening line Dossierly speaks first. */
  script?: string;
  onEnd?: () => void;
  /** Start as soon as it mounts (falls back to a Start button when the browser keeps sound locked). */
  autoStart?: boolean;
  /** Full-screen call (the /app/call route) instead of an embeddable card. */
  immersive?: boolean;
  /** Immersive only: the close control in the top bar. */
  onClose?: () => void;
}

const TITLE: Record<AgentCallMode, string> = { welcome: "Your welcome call", agent: "Talk to Dossierly", counter: "Counter", rehearse: "Rehearse" };

function useClock(on: boolean): string {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
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

/** Voice call with the caseworker. In-app ("Talk to Dossierly") and Onboarding's welcome call. */
export function AgentCall({ mode, script, onEnd, autoStart, immersive, onClose }: AgentCallProps) {
  const call = useAgentCall({ mode, script, onEnd });
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const live = call.status === "live";
  const clock = useClock(live);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const { start } = call;

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
  }, [autoStart, start]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [call.turns, call.partial]);

  const last = call.turns[call.turns.length - 1];
  const state = useMemo(() => {
    if (call.micWaiting) return "Allow the microphone to start";
    if (call.status === "connecting") return "Connecting…";
    if (call.status !== "live") return call.status === "ended" ? "Call ended" : "";
    if (call.speaking) return "Speaking";
    if (call.partial) return "Listening…";
    if (last && last.who === "user") return "Thinking…";
    return call.muted ? "Muted" : "Listening";
  }, [call.status, call.speaking, call.partial, call.muted, call.micWaiting, last]);

  const name = call.userName?.split(/\s+/)[0] ?? "You";

  const idle = call.status === "idle" || ((call.status === "ended" || call.status === "error") && !call.turns.length);
  const sub = mode === "welcome" ? "Dossierly walks you through what it found in your case." : "Ask anything about your case, out loud. Dossierly knows your letters, deadlines and documents.";
  const fine = <p className="vc-fine">Your voice goes through our server to Meta&rsquo;s speech model, never straight from your browser. You are talking to an AI.</p>;
  const startBtn = (
    <Button variant="agent" size="lg" block={immersive} icon="mic" onClick={() => void call.start()}>
      {call.error ? "Try again" : mode === "welcome" ? "Start the call" : "Call Dossierly"}
    </Button>
  );

  const typeForm = typing && live && (
    <form className="vc-type" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { call.sendText(draft.trim()); setDraft(""); } }}>
      <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type instead of speaking" aria-label="Type a message" enterKeyHint="send" autoFocus />
      <Button type="submit" variant="primary" disabled={!draft.trim()}>Send</Button>
    </form>
  );
  const controls = (
    <div className="vc-controls">
      {live ? (
        <>
          <button className={`vc-round ${call.muted ? "is-on" : ""}`} onClick={() => call.setMuted(!call.muted)} aria-pressed={call.muted} aria-label={call.muted ? "Unmute" : "Mute"}>
            <Icon name="mic" size={22} /><small>{call.muted ? "Unmute" : "Mute"}</small>
          </button>
          <button className={`vc-round ${typing ? "is-on" : ""}`} onClick={() => setTyping((v) => !v)} aria-pressed={typing} aria-label="Type">
            <Icon name="keyboard" size={22} /><small>Type</small>
          </button>
          <button className="vc-round vc-end" onClick={call.stop} aria-label="End call">
            <Icon name="phone" size={22} /><small>End</small>
          </button>
        </>
      ) : call.status === "connecting" ? (
        <Button size="lg" block disabled loading>Connecting…</Button>
      ) : (
        <Button variant="agent" size="lg" block icon="phone" onClick={() => void call.start()}>Call again</Button>
      )}
    </div>
  );
  const body = idle ? (
    <div className="vc-idle">
      <AgentOrb size={immersive ? 112 : 76} icon="phone" />
      <h2>{TITLE[mode]}</h2>
      <p className="vc-sub">{sub}</p>
      {call.error && <p className="vc-error" role="alert">{call.error}</p>}
      {!immersive && startBtn}
      {fine}
    </div>
  ) : (
    <>
      <div className="vc-stage">
        <span className="vc-orb" style={{ transform: call.partial ? `scale(${1 + Math.min(0.3, call.level * 4)})` : undefined }}>
          <AgentOrb size={immersive ? 120 : 104} state={call.speaking || call.partial ? "live" : live ? "idle" : "still"} />
        </span>
        <p className="vc-state" aria-live="polite">{state}</p>
      </div>
      <div className="vc-captions" ref={scroller} aria-live="polite">
        {call.turns.slice(-6).map((t) => <Line key={t.id} t={t} name={name} />)}
        {call.partial && <p className="vc-line vc-line-user is-partial"><span className="vc-who">{name}</span>{call.partial}</p>}
      </div>
      <Captured items={call.captured} />
      {call.error && <p className="vc-error" role="alert">{call.error}</p>}
      <LatencyLine metrics={call.metrics} />
    </>
  );

  if (immersive) {
    return (
      <VoiceScreen
        label={TITLE[mode]}
        close={onClose ?? "/app"}
        closeLabel="Close call"
        title={idle ? undefined : <>{TITLE[mode]}<small>{live ? clock : call.status === "ended" ? "Ended" : "Connecting…"}</small></>}
        end={idle ? undefined : <Pill tone="agent">AI</Pill>}
        center={idle}
        foot={idle ? startBtn : <>{typeForm}{controls}</>}
      >
        <section className={`vc vc--immersive is-${call.status}`} aria-label={TITLE[mode]}>{body}</section>
      </VoiceScreen>
    );
  }

  return (
    <section className={`vc vc--card is-${call.status}`} aria-label={TITLE[mode]}>
      {!idle && (
        <header className="vc-head">
          <Pill tone={live ? "ok" : "neutral"} dot>{live ? clock : call.status === "ended" ? "Ended" : "Connecting"}</Pill>
          <b>{TITLE[mode]}</b>
          <Pill tone="agent">AI</Pill>
        </header>
      )}
      {body}
      {!idle && typeForm}
      {!idle && controls}
    </section>
  );
}
