"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import type { VoiceTurn } from "@/lib/voice/protocol";
import { AgentOrb, Button, Pill } from "@/components/ui";
import { Icon } from "../Icon";
import { Captured, LatencyLine } from "./bits";
import { SampleCaseHint } from "./SampleCaseHint";
import "./voice.css";

export type AgentCallMode = "welcome" | "agent" | "counter" | "rehearse";

export interface AgentCallProps {
  mode: AgentCallMode;
  /** welcome: the server-generated opening line Dossierly speaks first. */
  script?: string;
  onEnd?: () => void;
  /** Start as soon as it mounts (falls back to a Start button when the browser keeps sound locked). */
  autoStart?: boolean;
  /** Full-height call screen (the /app/call route) instead of an embeddable card. */
  immersive?: boolean;
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
export function AgentCall({ mode, script, onEnd, autoStart, immersive }: AgentCallProps) {
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
  const shell = `vc ${immersive ? "vc--immersive" : "vc--card"} is-${call.status}`;

  if (call.status === "idle" || ((call.status === "ended" || call.status === "error") && !call.turns.length)) {
    return (
      <section className={shell} aria-label={TITLE[mode]}>
        <div className="vc-idle">
          <AgentOrb size={immersive ? 112 : 76} icon="phone" />
          <h2>{TITLE[mode]}</h2>
          <p className="vc-sub">
            {mode === "welcome" ? "Dossierly walks you through what it found in your case." : "Ask anything about your case, out loud. Dossierly knows your letters, deadlines and documents."}
          </p>
          <SampleCaseHint />
          {call.error && <p className="vc-error" role="alert">{call.error}</p>}
          <Button variant="agent" size="lg" icon="mic" onClick={() => void call.start()}>
            {call.error ? "Try again" : mode === "welcome" ? "Start the call" : "Call Dossierly"}
          </Button>
          <p className="vc-fine">Your voice goes through our server to Meta&rsquo;s speech model, never straight from your browser. You are talking to an AI.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={shell} aria-label={TITLE[mode]}>
      <header className="vc-head">
        <Pill tone={live ? "ok" : "neutral"} dot>{live ? clock : call.status === "ended" ? "Ended" : "Connecting"}</Pill>
        <b>{TITLE[mode]}</b>
        <Pill tone="agent">AI</Pill>
      </header>

      <div className="vc-stage">
        <span className="vc-orb" style={{ transform: call.partial ? `scale(${1 + Math.min(0.3, call.level * 4)})` : undefined }}>
          <AgentOrb size={immersive ? 136 : 104} state={call.speaking || call.partial ? "live" : live ? "idle" : "still"} />
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

      {typing && live && (
        <form className="vc-type" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { call.sendText(draft.trim()); setDraft(""); } }}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type instead of speaking" aria-label="Type a message" autoFocus />
          <Button type="submit" variant="primary" disabled={!draft.trim()}>Send</Button>
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
              <Icon name="phone" size={20} /><small>End</small>
            </button>
          </>
        ) : call.status === "connecting" ? (
          <Button block disabled loading>Connecting…</Button>
        ) : (
          <Button variant="agent" block icon="phone" onClick={() => void call.start()}>Call again</Button>
        )}
      </div>
    </section>
  );
}
