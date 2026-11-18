"use client";

import { useEffect, useRef, useState } from "react";
import { api, pollTask, sandboxLabel } from "@/lib/client/api";
import type { Case, CaseEvent } from "@/lib/client/types";
import { useT } from "@/lib/i18n/client";

type FileResult = { filed: boolean; summary: string };

/** Files an event into the personal agent's memory and reports where it ran. */
export function useFiling() {
  const t = useT("shell");
  const [label, setLabel] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const file = (c: Case, event: CaseEvent) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setLabel(t("filingStart"));
    void (async () => {
      const r = await api.fileEvent(c, event);
      if (!r.ok) return setLabel(t("filingOffline"));
      const done = await pollTask<FileResult>(r.data.taskId, (task) => {
        if (task.status === "running") setLabel(task.ranOn === "sandbox" ? t("filingSandbox") : t("filingCloud"));
      }, ctl.signal);
      if (!done.ok || done.data.status !== "done") return setLabel(t("filingUnconfirmed"));
      setLabel(done.data.ranOn === "sandbox" ? (done.data.sandbox ? t("filedSandboxAt", { sandbox: sandboxLabel(done.data.sandbox) }) : t("filedSandbox")) : t("filedCloud"));
    })();
  };
  return { label, file };
}
