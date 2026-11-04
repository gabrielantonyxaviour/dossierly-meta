"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, IconLink } from "@/components/ui";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import { TEST_OFFICIAL_LINES } from "@/lib/voice/clips";
import { LANG_NAME } from "@/lib/voice/protocol";
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
  const started = useRef(false);
  const { start } = call;

  // Opened from the Counter tab: start straight away (falls back to the start card if sound is locked).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  useEffect(() => {
    if (!live) return;
    const lock = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    let sentinel: { release(): Promise<void> } | null = null;
    lock?.request("screen").then((s) => (sentinel = s)).catch(() => undefined);
    return () => void sentinel?.release().catch(() => undefined);
  }, [live]);

  if (call.status === "idle" || (call.status === "error" && !call.turns.length)) {
    return (
      <div className="ct-start">
        <div className="ct-start-bar"><IconLink href="/app/counter" icon="close" label="Close" /></div>
        <section className="ct-intro">
          <h1>At the counter</h1>
          <p>Put the phone flat between you and the official, this end toward you. The top half speaks Polish to them; the bottom half is yours in {LANG_NAME[call.lang] ?? "your language"}.</p>
          <ol className="ct-steps">
            <li>Speak normally. Dossierly says it in Polish and tells you what the official said.</li>
            <li>When they ask for a document, it opens for them. Tasks go into your case.</li>
            <li>No Polish speaker around? Use the labelled test official.</li>
          </ol>
          {call.error && <p className="vc-error" role="alert">{call.error}</p>}
          <Button variant="agent" size="lg" icon="mic" block onClick={() => void call.start()}>{call.error ? "Try again" : "Start"}</Button>
          <p className="vc-fine">Audio goes through our server to Meta&rsquo;s speech model and is not stored. Dossierly interprets and guides; it is not a lawyer and files nothing for you.</p>
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
            <Button
              size="sm"
              className="ct-test"
              icon="speak"
              disabled={call.clipBusy}
              onClick={() => {
                void call.playClip(clip);
                setClip((i) => (i + 1) % TEST_OFFICIAL_LINES.length);
              }}
              title="Plays a synthetic Polish voice into the real speech pipeline"
            >
              Test official {clip + 1}/{TEST_OFFICIAL_LINES.length}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon="flip" onClick={() => setFlat((f) => !f)} aria-pressed={flat} title="Turn the official's half upside down for a phone lying flat">
            <span className="ct-hide-sm">{flat ? "Flat" : "Upright"}</span>
          </Button>
          {live ? (
            <Button size="sm" variant="danger" onClick={call.stop}>End</Button>
          ) : call.status === "ended" ? (
            <ButtonLink size="sm" variant="primary" href="/app/counter">Done</ButtonLink>
          ) : (
            <ButtonLink size="sm" variant="ghost" href="/app/counter">Cancel</ButtonLink>
          )}
        </div>
      </div>

      <div className="ct-wrap ct-wrap-user">
        <UserHalf call={call} />
      </div>

      {doc && <DocSheet doc={doc} flat={flat} onClose={() => call.dismissDoc(doc.docId)} />}
    </div>
  );
}
