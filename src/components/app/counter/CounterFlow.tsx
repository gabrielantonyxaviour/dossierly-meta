"use client";

import { SampleCaseHint } from "@/components/voice/SampleCaseHint";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import { TEST_OFFICIAL_LINES } from "@/lib/voice/clips";
import { LANG_NAME } from "@/lib/voice/protocol";
import { Icon } from "@/components/Icon";
import { LatencyLine } from "@/components/voice/bits";
import { DocSheet } from "./DocSheet";
import { OfficialHalf, UserHalf } from "./Halves";
import "@/components/voice/voice.css";
import "./counter.css";

/** Counter: phone flat on the desk. Top half turned to the official (Polish), bottom half for the user. */
export function CounterFlow() {
  const call = useAgentCall({ mode: "counter" });
  const [flat, setFlat] = useState(true);
  const [clip, setClip] = useState(0);
  const live = call.status === "live";
  const doc = call.docs[call.docs.length - 1] ?? null;

  useEffect(() => {
    if (!live) return;
    const lock = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    let sentinel: { release(): Promise<void> } | null = null;
    lock?.request("screen").then((s) => (sentinel = s)).catch(() => undefined);
    return () => void sentinel?.release().catch(() => undefined);
  }, [live]);

  if (call.status === "idle" || call.status === "error" && !call.turns.length) {
    return (
      <div className="app-pad">
        <section className="card ct-intro">
          <span className="tab-label"><Icon name="meet" size={16} /> Counter</span>
          <h1>At the counter, Dossierly speaks for you</h1>
          <p className="muted">Lay the phone flat between you and the official. The top half turns to them in Polish; the bottom half is yours in {LANG_NAME[call.lang] ?? "your language"}. Dossierly knows your case, so it pulls up the document they ask for and writes down what you must do next.</p>
          <ol className="ct-steps">
            <li>Start, then put the phone down with this end toward you.</li>
            <li>Speak normally. Dossierly says it in Polish and tells you what the official said.</li>
            <li>No Polish speaker around? Use the labelled test official below.</li>
          </ol>
          <SampleCaseHint />
          {call.error && <p className="vc-error" role="alert">{call.error}</p>}
          <button className="btn btn-primary ct-go" onClick={() => void call.start()}><Icon name="mic" size={18} /> {call.error ? "Try again" : "Start at the counter"}</button>
          <p className="vc-fine">Audio goes through our server to Meta&rsquo;s speech model and is not stored. Dossierly interprets and guides; it is not a lawyer and does not file anything for you.</p>
        </section>
      </div>
    );
  }

  const hearing = call.partial !== null;
  const status =
    call.micWaiting ? "Allow the microphone to start" : call.status === "connecting" ? "Connecting…" : call.status === "ended" ? "Conversation ended" : call.clipBusy ? "Test official speaking" : call.speaking ? (call.speaking === "official" ? "Speaking Polish" : "Speaking to you") : hearing ? "Hearing…" : "Listening";

  return (
    <div className={`ct ${flat ? "is-flat" : ""}`} role="application" aria-label="Counter conversation">
      <div className="ct-wrap ct-wrap-official">
        <OfficialHalf call={call} />
      </div>

      <div className="ct-strip">
        <span className={`vc-dot ${live ? "on" : ""}`} aria-hidden />
        <span className="ct-status" aria-live="polite">{status}</span>
        <LatencyLine metrics={call.metrics.slice(-6)} />
        <div className="ct-tools">
          {live && (
            <button
              className="btn btn-small ct-test"
              disabled={call.clipBusy}
              onClick={() => {
                void call.playClip(clip);
                setClip((i) => (i + 1) % TEST_OFFICIAL_LINES.length);
              }}
              title="Plays a synthetic Polish voice into the real speech pipeline"
            >
              <Icon name="speak" size={16} /> Test official {clip + 1}/{TEST_OFFICIAL_LINES.length}
            </button>
          )}
          <button className="btn btn-small btn-ghost" onClick={() => setFlat((f) => !f)} aria-pressed={flat} title="Turn the official's half upside down for a phone lying flat">
            <Icon name="flip" size={16} /><span className="ct-hide-sm">{flat ? "Flat" : "Upright"}</span>
          </button>
          {live ? (
            <button className="btn btn-small btn-danger" onClick={call.stop}>End</button>
          ) : call.status === "ended" ? (
            <Link className="btn btn-small" href="/app">Back to case</Link>
          ) : null}
        </div>
      </div>

      <div className="ct-wrap ct-wrap-user">
        <UserHalf call={call} />
      </div>

      {doc && <DocSheet doc={doc} flat={flat} onClose={() => call.dismissDoc(doc.docId)} />}
    </div>
  );
}
