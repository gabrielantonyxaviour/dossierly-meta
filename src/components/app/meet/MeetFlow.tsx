"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import { useDossier } from "@/lib/client/store";
import type { Intro, WrapResult } from "@/lib/client/types";
import { webSpeech } from "@/lib/speech/webspeech";
import { Attribution } from "../../Attribution";
import { Icon } from "../../Icon";
import { ErrorNote, Loading } from "../../States";
import { TableMode } from "./TableMode";
import { useConversation } from "./useConversation";
import { WrapUp } from "./WrapUp";

export function MeetFlow() {
  const d = useDossier();
  const conv = useConversation();
  const [phase, setPhase] = useState<"intro" | "talk" | "wrapping" | "wrap">("intro");
  const [intro, setIntro] = useState<Intro | null>(null);
  const [err, setErr] = useState<ApiFailure | null>(null);
  const [wrap, setWrap] = useState<WrapResult | null>(null);

  const asked = useRef(false);
  const loadIntro = async () => {
    setErr(null);
    const r = await api.intro(d.case.profile.name, d.case.profile.language, d.case.office);
    if (!r.ok) return setErr(r);
    setIntro(r.data);
    d.logRuns("intro", [r.data.run]);
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    // Fetch the introduction once when the screen opens.
    void loadIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = async () => {
    setPhase("wrapping");
    setErr(null);
    const r = await api.wrap(d.case, conv.finished());
    if (!r.ok) {
      setErr(r);
      return setPhase("talk");
    }
    setWrap(r.data);
    d.logRuns("wrap", [r.data.run]);
    setPhase("wrap");
  };

  if (phase === "talk") return <><TableMode conv={conv} onEnd={() => void end()} />{err && <div className="table-err"><ErrorNote failure={err} /></div>}</>;
  if (phase === "wrapping") return <div className="page"><div className="card"><Loading label="Writing the wrap-up from what was actually said…" /></div></div>;
  if (phase === "wrap" && wrap) return <WrapUp wrap={wrap} turns={conv.finished()} />;

  return (
    <div className="page stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">During · meet</span>
        <h1 className="page-title">At the desk</h1>
        <p className="muted" style={{ margin: 0 }}>Show this card to the official first. Then lay the phone flat between you: their half faces them.</p>
      </div>
      <section className="card intro-card" aria-label="Introduction for the official">
        <div className="row between">
          <span className="tab-label" style={{ color: "var(--official)" }}>Dla urzędnika · for the official</span>
          {intro && <Attribution run={intro.run} />}
        </div>
        {!intro && !err && <div className="stack" style={{ marginTop: 14 }}><div className="skeleton" style={{ height: 26 }} /><div className="skeleton" style={{ height: 26, width: "80%" }} /><div className="skeleton" style={{ height: 26, width: "60%" }} /></div>}
        {err && !intro && <div style={{ marginTop: 12 }}><ErrorNote failure={err} onRetry={() => void loadIntro()} /></div>}
        {intro && (
          <>
            <p className="intro-pl" lang="pl">{intro.local}</p>
            <p className="small muted" style={{ margin: 0 }}>{intro.english}</p>
            <button className="btn btn-small" style={{ marginTop: 12 }} onClick={() => void webSpeech.speak(intro.local, "pl-PL")}><Icon name="speak" size={18} /> Read it aloud in Polish</button>
          </>
        )}
      </section>
      <div className="notice small">
        Dossierly interprets. It does not answer for you and gives no legal or medical advice. <b>No audio is stored.</b> In Polish, English and Ukrainian each spoken turn is transcribed by Muse Voice Transcribe and deleted straight after; other languages use your browser&apos;s speech service. Typing always works instead.
      </div>
      <button className="btn btn-primary btn-block talk-start" onClick={() => setPhase("talk")}>Start interpreting</button>
    </div>
  );
}
