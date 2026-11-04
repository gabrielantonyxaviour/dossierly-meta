"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, ScreenTitle } from "@/components/ui";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import { TEST_LINES } from "@/lib/voice/clips";
import { LANG_NAME } from "@/lib/voice/protocol";
import { LatencyLine } from "@/components/voice/bits";
import { VoiceScreen } from "@/components/voice/Screen";
import { OfficialHalf, UserHalf } from "./Halves";
import "@/components/voice/voice.css";
import "./counter.css";

/** Counter: phone flat on the desk. Top half turned to the official (Polish), bottom half for the user. */
export function CounterFlow() {
  const call = useAgentCall({ mode: "counter" });
  const [flat, setFlat] = useState(true);
  const [clip, setClip] = useState(0);
  const live = call.status === "live";
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
      <VoiceScreen
        label="At the counter"
        close="/app/counter"
        foot={<Button variant="agent" size="lg" icon="mic" block onClick={() => void call.start()}>{call.error ? "Try again" : "Start"}</Button>}
      >
        <ScreenTitle title="At the counter" sub="Lay the phone flat between you and the official, this end toward you." />
        <ol className="vs-steps">
          <li>The top half speaks Polish to the official. The bottom half is yours, in {LANG_NAME[call.lang] ?? "your language"}.</li>
          <li>When they ask for a document, it opens on their half. Tasks go into your case.</li>
          <li>No Polish speaker around? The labelled test kit plays a short scene with a synthetic official.</li>
        </ol>
        {call.error && <p className="vc-error" role="alert">{call.error}</p>}
        <p className="vs-fine">Audio goes through our server to Meta&rsquo;s speech model and is not stored. Dossierly interprets and guides; it is not a lawyer and files nothing for you.</p>
      </VoiceScreen>
    );
  }

  const hearing = call.partial !== null;
  const status =
    call.micWaiting ? "Allow the microphone to start" : call.status === "connecting" ? "Connecting…" : call.status === "ended" ? "Conversation ended" : call.clipBusy ? "Test line playing" : call.speaking ? (call.speaking === "official" ? "Speaking Polish" : "Speaking to you") : hearing ? "Hearing…" : "Listening";

  return (
    <div className={`ct ${flat ? "is-flat" : ""}`} role="application" aria-label="Counter conversation">
      <div className="ct-wrap ct-wrap-official">
        <OfficialHalf call={call} />
      </div>

      <div className="ct-strip">
        <span className={`vc-dot ${live ? "on" : ""}`} aria-hidden />
        <span className="ct-status" aria-live="polite">{status}</span>
        <LatencyLine metrics={call.metrics.slice(-6)} />
      </div>

      <div className="ct-wrap ct-wrap-user">
        <UserHalf call={call} />
      </div>

      <div className="ct-dock">
        {live && (
          <Button
            className="ct-test"
            icon="speak"
            disabled={call.clipBusy}
            onClick={() => {
              void call.playClip(clip);
              setClip((i) => (i + 1) % TEST_LINES.length);
            }}
            title="Plays a synthetic voice into the real speech pipeline"
          >
            {TEST_LINES[clip].who === "user" ? "Test reply" : "Test official"} {clip + 1}/{TEST_LINES.length}
          </Button>
        )}
        <Button className="ct-flip" variant="secondary" icon="flip" onClick={() => setFlat((f) => !f)} aria-pressed={flat} aria-label={flat ? "Official half is upside down for a flat phone; tap for upright" : "Official half upright; tap to turn it for a flat phone"}>
          {flat ? "Flat" : "Upright"}
        </Button>
        {live ? (
          <Button variant="danger" onClick={call.stop}>End</Button>
        ) : call.status === "ended" ? (
          <ButtonLink variant="primary" href="/app/counter">Done</ButtonLink>
        ) : (
          <ButtonLink variant="secondary" href="/app/counter">Cancel</ButtonLink>
        )}
      </div>
    </div>
  );
}
