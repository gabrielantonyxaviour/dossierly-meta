"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../Icon";
import { TurnCard } from "./TurnCard";
import type { Turn } from "./useConversation";
import { useListen } from "./useListen";

const COPY = {
  official: { who: "Urzędnik", talk: "Urzędnik mówi", listening: "Słucham… dotknij, aby zakończyć", type: "Wpisz", send: "Tłumacz", placeholder: "Proszę wpisać po polsku", empty: "Proszę mówić krótkimi zdaniami. Tłumaczenie pojawi się tutaj." },
  user: { who: "You", talk: "I speak", listening: "Listening… tap to finish", type: "Type", send: "Interpret", placeholder: "Type what you want to say", empty: "What the official says appears here, in your language." },
} as const;

type Props = {
  side: "official" | "user";
  speechLang: string;
  userLang: string;
  turns: Turn[];
  onSay(text: string): void;
  onRetry(t: Turn): void;
  busy: boolean;
  /** Changes when extra cards (speaking-up, notices) appear, to scroll them into view. */
  bump?: number;
  children?: React.ReactNode;
};

export function SpeakerHalf({ side, speechLang, userLang, turns, onSay, onRetry, busy, bump = 0, children }: Props) {
  const c = COPY[side];
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const listen = useListen(speechLang, onSay, { translate: side === "official" ? "en" : "pl" });
  const recent = turns.slice(-2);
  const scroller = useRef<HTMLDivElement>(null);
  const last = turns.at(-1);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last?.id, last?.pending, bump]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSay(text);
    setText("");
  };

  return (
    <section className={`half half-${side}`} aria-label={side === "official" ? "Strona urzędnika" : "Your side"} lang={side === "official" ? "pl" : undefined}>
      <div className="half-turns" aria-live="polite" ref={scroller}>
        {recent.length === 0 ? <p className="half-empty">{c.empty}</p> : recent.map((t) => (
          <TurnCard key={t.id} turn={t} reader={side} userLang={userLang} onRetry={() => onRetry(t)} />
        ))}
        {children}
      </div>
      {(listen.state === "listening" || listen.state === "transcribing") && listen.interim && <p className="interim" lang={side === "official" ? "pl" : userLang}>{listen.interim}</p>}
      {listen.detail && (
        <p className="asr-note tiny">
          Heard by Muse Voice Transcribe{listen.detail.ms ? ` · ${(listen.detail.ms / 1000).toFixed(1)} s` : ""}
          {listen.detail.translation ? <> · Translation: <span lang={side === "official" ? "en" : "pl"}>{listen.detail.translation}</span></> : null}
        </p>
      )}
      {listen.error && <p className="small half-error" role="status">{listen.error}</p>}
      {typing && (
        <form className="type-row" onSubmit={submit}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={c.placeholder} aria-label={c.placeholder} autoFocus maxLength={1500} />
          <button className="btn btn-small talk-send" disabled={!text.trim() || busy}>{c.send}</button>
        </form>
      )}
      <div className="half-controls">
        <button
          type="button"
          className={`talk talk-${side}${listen.state === "listening" ? " is-on" : ""}`}
          onClick={listen.toggle}
          disabled={!listen.supported}
          aria-pressed={listen.state === "listening"}
        >
          <Icon name="mic" size={26} />
          <span>{listen.state === "listening" ? c.listening : listen.state === "transcribing" ? (side === "official" ? "Przetwarzam…" : "Transcribing…") : listen.supported ? c.talk : side === "official" ? "Mikrofon niedostępny" : "No speech input here"}</span>
        </button>
        <button type="button" className="btn btn-ghost key-btn" onClick={() => setTyping(!typing)} aria-pressed={typing} aria-label={c.type}>
          <Icon name="keyboard" />
          <span className="key-label">{c.type}</span>
        </button>
      </div>
    </section>
  );
}
