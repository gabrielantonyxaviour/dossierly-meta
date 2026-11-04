"use client";

import { useEffect, useRef, useState } from "react";
import { api, pollTask, sandboxLabel } from "@/lib/client/api";
import type { Case, CaseEvent } from "@/lib/client/types";

type FileResult = { filed: boolean; summary: string };

/** Files an event into the personal agent's memory and reports where it ran. */
export function useFiling() {
  const [label, setLabel] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const file = (c: Case, event: CaseEvent) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setLabel("Filing it into your private agent's memory…");
    void (async () => {
      const r = await api.fileEvent(c, event);
      if (!r.ok) return setLabel("Saved on this device. Your agent will be updated next time it is online.");
      const done = await pollTask<FileResult>(r.data.taskId, (t) => {
        if (t.status === "running") setLabel(t.ranOn === "sandbox" ? "Your private agent is filing it…" : "Filing it (cloud fallback)…");
      }, ctl.signal);
      if (!done.ok || done.data.status !== "done") return setLabel("Saved on this device. Your agent did not confirm the filing yet.");
      setLabel(done.data.ranOn === "sandbox" ? `Filed by your private agent${done.data.sandbox ? ` (${sandboxLabel(done.data.sandbox)})` : ""}.` : "Filed by the cloud fallback; your agent picks it up when it is online.");
    })();
  };
  return { label, file };
}
