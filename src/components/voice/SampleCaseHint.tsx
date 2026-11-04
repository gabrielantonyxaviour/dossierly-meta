"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/** Preview deployments only: offers Arjun's labelled SAMPLE case when the signed-in case is empty. */
export function SampleCaseHint() {
  const [state, setState] = useState<"hidden" | "offer" | "loading" | "done" | "error">("hidden");

  useEffect(() => {
    if (!/^dossierly-(voice|app|onboarding|look)\./.test(location.host) && location.hostname !== "localhost") return;
    fetch("/api/case")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { documents?: unknown[]; deadlines?: unknown[] } | null) => {
        if (c && !c.documents?.length && !c.deadlines?.length) setState("offer");
      })
      .catch(() => undefined);
  }, []);

  if (state === "hidden") return null;
  return (
    <p className="vc-sample" role="status">
      {state === "done" ? "Sample case loaded. Start when ready." : state === "error" ? "Could not load the sample case." : "Your case is empty on this preview."}
      {(state === "offer" || state === "error") && (
        <Button
          size="sm"
          onClick={async () => {
            setState("loading");
            const r = await fetch("/api/voice/demo-seed", { method: "POST" }).catch(() => null);
            setState(r?.ok ? "done" : "error");
            if (r?.ok) window.dispatchEvent(new Event("dossierly:case-changed"));
          }}
        >
          Load Arjun&rsquo;s sample case
        </Button>
      )}
      {state === "loading" && <span>Loading…</span>}
    </p>
  );
}
