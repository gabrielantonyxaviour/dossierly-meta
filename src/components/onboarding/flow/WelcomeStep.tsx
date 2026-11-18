"use client";
import { useEffect, useRef, useState } from "react";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { AgentCall } from "@/components/voice/AgentCall";
import { AgentOrb, Button, ButtonLink, StickyActionBar } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/** The incoming welcome call. The script is written by Muse Spark from the saved case before the person answers. */
export function WelcomeStep({ firstName, calendarAdded }: { firstName: string; calendarAdded: boolean }) {
  const t = useT("onboarding");
  const [script, setScript] = useState<{ text: string; language: string } | null>(null);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);
  const [ended, setEnded] = useState(false);
  const asked = useRef(false);
  async function load() {
    setError("");
    const r = await flowApi.welcome(calendarAdded);
    if (r.ok) setScript({ text: r.data.script, language: r.data.language }); else setError(failure(r) ?? t("callError"));
  }
  useEffect(() => { if (!asked.current) { asked.current = true; void load(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (ended) return (
    <div className="ob-answer">
      <div className="ob-note ob-note-ok"><strong>{firstName ? t("allSetNamed", { name: firstName }) : t("allSet")}</strong><p>{t("allSetBody")}</p></div>
      <StickyActionBar><ButtonLink variant="primary" size="lg" href="/app">{t("openCase")}</ButtonLink></StickyActionBar>
    </div>
  );
  // "Answer" is the user gesture that lets the call start audio straight away.
  if (answered && script) return <div className="ob-call-full"><AgentCall mode="welcome" script={script.text} autoStart immersive onEnd={() => setEnded(true)} /></div>;
  return (
    <div className="ob-answer">
      <div className="ob-ring" data-ready={!!script}>
        <AgentOrb size={96} state={script ? "live" : "idle"} />
        <div><strong>Dossierly</strong><span>{script ? t("callIncoming") : error ? t("callNotReady") : t("callPreparing")}</span></div>
      </div>
      {error && <div className="ob-alert" role="alert"><p>{error}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void load()}>{t("tryAgain")}</button></div>}
      <StickyActionBar secondary={<ButtonLink variant="ghost" href="/app">{t("notNowOpenCase")}</ButtonLink>}>
        <Button variant="primary" size="lg" className="ob-answer-btn" icon="phone" disabled={!script} loading={!script && !error} onClick={() => setAnswered(true)}>{script ? t("answer") : t("preparing")}</Button>
      </StickyActionBar>
    </div>
  );
}
