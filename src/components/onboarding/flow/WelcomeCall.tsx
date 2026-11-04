"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Interim welcome call: speaks the Spark-written script with the browser voice and shows live captions.
 * Replaced by <AgentCall mode="welcome" script=… onEnd=…/> from the Voice pane (ElevenLabs Flash + live talk-back).
 */
export function WelcomeCall({ script, speechLang, onEnd }: { script: string; speechLang: string; onEnd(): void }) {
  const sentences = script.match(/[^.!?。？！]+[.!?。？！]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [script];
  const [at, setAt] = useState(0);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const ended = useRef(false);
  useEffect(() => { const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || muted) { const t = setTimeout(() => setAt((i) => Math.min(i + 1, sentences.length)), 3200); return () => clearTimeout(t); }
    if (at >= sentences.length) return;
    const u = new SpeechSynthesisUtterance(sentences[at]);
    u.lang = speechLang; u.rate = 1.02;
    u.onend = () => setAt((i) => i + 1);
    u.onerror = () => setAt((i) => i + 1);
    synth.speak(u);
    return () => { u.onend = null; u.onerror = null; synth.cancel(); };
  }, [at, muted]); // eslint-disable-line react-hooks/exhaustive-deps
  const hangUp = () => { if (ended.current) return; ended.current = true; window.speechSynthesis?.cancel(); onEnd(); };
  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="ob-answer">
      <div className="ob-call" aria-live="polite">
        <div className="ob-call-head"><span className="ob-ring-avatar" data-speaking={at < sentences.length} aria-hidden="true"><span /></span><div><strong>Dossierly</strong><span>Welcome call · {mm}</span></div></div>
        <p className="ob-call-captions">{sentences.map((s, i) => <span key={i} data-state={i < at ? "said" : i === at ? "now" : "next"}>{s} </span>)}</p>
      </div>
      <div className="ob-call-actions">
        <button type="button" className="btn" onClick={() => setMuted((m) => !m)}>{muted ? "Speaker on" : "Captions only"}</button>
        <button type="button" className="btn btn-primary ob-hang" onClick={hangUp}>{at >= sentences.length ? "Done" : "End call"}</button>
      </div>
    </div>
  );
}
