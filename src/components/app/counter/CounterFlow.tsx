"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, ScreenTitle } from "@/components/ui";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";
import { TEST_LINES } from "@/lib/voice/clips";
import { useT } from "@/lib/i18n/client";
import { LatencyLine, useLangName } from "@/components/voice/bits";
import { VoiceScreen } from "@/components/voice/Screen";
import { OfficialHalf, UserHalf } from "./Halves";
import "@/components/voice/voice.css";
import "./counter.css";

/** The test kit is opt-in: /app/counter/live?kit=1 (linked from the Counter tab as "No Polish speaker? Try a test official"). */
const kitRequested = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("kit") === "1";

/** Counter: phone flat on the desk. Top half turned to the official (Polish), bottom half for the user. */
export function CounterFlow() {
  const t = useT("counter");
  const tv = useT("voice");
  const langName = useLangName();
  const call = useAgentCall({ mode: "counter" });
  const [kit] = useState(kitRequested);
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
        label={t("atCounter")}
        close="/app/counter"
        foot={<Button variant="agent" size="lg" icon="mic" block onClick={() => void call.start()}>{call.error ? tv("tryAgain") : t("start")}</Button>}
      >
        <ScreenTitle title={t("atCounter")} sub={t("intro")} />
        <ol className="vs-steps">
          <li>{t("step1", { lang: call.lang ? langName(call.lang) : t("yourLanguage") })}</li>
          <li>{t("step2")}</li>
        </ol>
        {call.error && <p className="vc-error" role="alert">{call.error}</p>}
        <p className="vs-fine">{t("fine")}</p>
      </VoiceScreen>
    );
  }

  const hearing = call.partial !== null;
  const status =
    call.micWaiting ? tv("allowMic") : call.status === "connecting" ? tv("connecting") : call.status === "ended" ? t("statusEnded") : call.clipBusy ? t("statusClip") : call.speaking ? (call.speaking === "official" ? t("toOfficial") : t("toYou")) : hearing ? t("hearingNow") : tv("listening");

  return (
    <div className={`ct ${flat ? "is-flat" : ""}`} role="application" aria-label={t("conversationAria")}>
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
        {live && kit && (
          <Button
            className="ct-test"
            icon="speak"
            disabled={call.clipBusy}
            onClick={() => {
              void call.playClip(clip);
              setClip((i) => (i + 1) % TEST_LINES.length);
            }}
            title={t("testHint")}
          >
            {t(TEST_LINES[clip].who === "user" ? "testReply" : "testOfficial", { n: clip + 1, total: TEST_LINES.length })}
          </Button>
        )}
        <Button className="ct-flip" variant="secondary" icon="flip" onClick={() => setFlat((f) => !f)} aria-pressed={flat} aria-label={flat ? t("flipFlatAria") : t("flipUprightAria")}>
          {flat ? t("flat") : t("upright")}
        </Button>
        {live ? (
          <Button variant="danger" onClick={call.stop}>{tv("end")}</Button>
        ) : call.status === "ended" ? (
          <ButtonLink variant="primary" href="/app/counter">{t("done")}</ButtonLink>
        ) : (
          <ButtonLink variant="secondary" href="/app/counter">{t("cancel")}</ButtonLink>
        )}
      </div>
    </div>
  );
}
