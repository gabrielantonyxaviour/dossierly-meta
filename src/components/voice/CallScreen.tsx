"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { tNow } from "@/lib/i18n/current";
import { AgentCall } from "./AgentCall";
import { VoiceScreen } from "./Screen";

/** Onboarding's server-written opening line for the welcome call, from the current case. */
function useWelcomeScript(on: boolean): { script: string | null; error: string | null; retry: () => void } {
  const [state, setState] = useState<{ script: string | null; error: string | null }>({ script: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!on) return;
    fetch("/api/onboarding/welcome", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarAdded: true }) })
      .then(async (r) => ((await r.json().catch(() => ({}))) as { script?: string; error?: string }))
      .then((d) => setState(d.script ? { script: d.script, error: null } : { script: null, error: d.error ?? tNow("voice")("welcomeError") }))
      .catch(() => setState({ script: null, error: tNow("voice")("welcomeError") }));
  }, [on, attempt]);
  const retry = () => {
    setState({ script: null, error: null });
    setAttempt((n) => n + 1);
  };
  return { ...state, retry };
}

/**
 * /app/call: full-screen voice call with the caseworker; starts at once when opened from the app.
 * `welcome` (preview only): onboarding's welcome call on the already-built case, for re-recording it.
 */
export function CallScreen({ welcome = false }: { welcome?: boolean }) {
  const t = useT("voice");
  const router = useRouter();
  const close = () => (history.length > 1 ? router.back() : router.push("/app"));
  const { script, error, retry } = useWelcomeScript(welcome);
  if (!welcome) return <AgentCall mode="agent" immersive autoStart onClose={close} />;
  if (!script) {
    return (
      <VoiceScreen label={t("titleWelcome")} close={close} title={t("titleWelcome")} foot={error ? <Button variant="primary" size="lg" block onClick={retry}>{t("tryAgain")}</Button> : undefined}>
        <p className={error ? "vc-error" : "vs-fine"} role={error ? "alert" : "status"}>{error ?? t("preparingWelcome")}</p>
      </VoiceScreen>
    );
  }
  return <AgentCall mode="welcome" script={script} immersive autoStart onClose={close} />;
}
