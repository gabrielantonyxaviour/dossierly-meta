"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { AgentCall } from "@/components/voice/AgentCall";
import { AgentOrb } from "@/components/ui";
import { ActionBar } from "./mobile";

/** The incoming welcome call. The script is written by Muse Spark from the saved case before the person answers. */
export function WelcomeStep({ firstName, calendarAdded }: { firstName: string; calendarAdded: boolean }) {
  const [script, setScript] = useState<{ text: string; language: string } | null>(null);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);
  const [ended, setEnded] = useState(false);
  const asked = useRef(false);
  async function load() {
    setError("");
    const r = await flowApi.welcome(calendarAdded);
    if (r.ok) setScript({ text: r.data.script, language: r.data.language }); else setError(failure(r) ?? "Could not prepare the call.");
  }
  useEffect(() => { if (!asked.current) { asked.current = true; void load(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (ended) return (
    <div className="ob-answer">
      <div className="ob-note ob-note-ok"><strong>You’re all set{firstName ? `, ${firstName}` : ""}.</strong><p>Your case, next step and dates are waiting. Talk to me any time from the call button.</p></div>
      <ActionBar><Link className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" href="/app">Open my case</Link></ActionBar>
    </div>
  );
  // "Answer" is the user gesture that lets the call start audio straight away.
  if (answered && script) return <div className="ob-call-full"><AgentCall mode="welcome" script={script.text} autoStart immersive onEnd={() => setEnded(true)} /></div>;
  return (
    <div className="ob-answer">
      <div className="ob-ring" data-ready={!!script}>
        <AgentOrb size={96} state={script ? "live" : "idle"} />
        <div><strong>Dossierly</strong><span>{script ? "Incoming welcome call" : error ? "Call not ready" : "Preparing your welcome call…"}</span></div>
      </div>
      {error && <div className="ob-alert" role="alert"><p>{error}</p><button type="button" className="ui-btn ui-btn--sm" onClick={() => void load()}>Try again</button></div>}
      <ActionBar>
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block ob-answer-btn" disabled={!script} onClick={() => setAnswered(true)}>{script ? "Answer" : "Preparing…"}</button>
        <Link className="ob-link" href="/app">Not now, open my case</Link>
      </ActionBar>
    </div>
  );
}
