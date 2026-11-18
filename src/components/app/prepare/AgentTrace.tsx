"use client";

import { useEffect, useState } from "react";
import { sandboxLabel } from "@/lib/client/api";
import { seconds } from "@/lib/client/format";
import { useCase } from "@/lib/client/store";
import { useT } from "@/lib/i18n/client";
import type { AgentTask } from "@/lib/client/types";
import { Attribution } from "../../Attribution";

/** Live view of what the personal agent is doing: each step, its tool, and where it ran. */
export function AgentTrace({ task, startedAt }: { task: AgentTask | null; startedAt: number | null }) {
  const t = useT("prepare");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  const sample = useCase().dossier?.sample;
  const agent = sample ? t("sampleAgent") : t("privateAgent");
  const elapsed = startedAt ? now - startedAt : 0;
  const where = task?.ranOn === "sandbox"
    ? `${agent}${task.sandbox ? ` (${sandboxLabel(task.sandbox)})` : ""}`
    : task?.ranOn === "cloud"
      ? t("cloudFallback")
      : t("waitingFor", { agent });

  return (
    <section className="card stack" aria-label={t("activityAria")} aria-live="polite" style={{ ["--gap" as string]: "10px" }}>
      <div className="row between">
        <span className="tab-label">{t("traceLabel")}</span>
        <span className={`chip ran-on ${task?.ranOn === "sandbox" ? "chip-ok" : ""}`}>
          {task?.status === "done" ? t("ranIn", { where }) : task?.ranOn ? t("runningIn", { where }) : where}
        </span>
      </div>
      <ol className="trace">
        {(task?.trace ?? [{ step: t("firstStep"), ms: 0 }]).map((s, i) => (
          <li key={i}>
            <span className="tick" aria-hidden="true" />
            <span>{s.step}{s.tool && <span className="tool"> · {s.tool}</span>}</span>
            <span className="mono tiny muted">{s.ms ? seconds(s.ms) : ""}</span>
          </li>
        ))}
        {startedAt && (
          <li>
            <span className="spinner" aria-hidden="true" style={{ width: 12, height: 12, marginTop: 4 }} />
            <span className="muted">{task?.status === "running" ? t("traceWorking") : t("queued")}</span>
            <span className="mono tiny muted">{seconds(elapsed)}</span>
          </li>
        )}
      </ol>
      {startedAt && !task?.ranOn && elapsed > 6000 && (
        <p className="tiny muted" style={{ margin: 0 }}>{t("fallbackNote", { agent })}</p>
      )}
      {task?.run && <Attribution run={task.run} prefix={task.ranOn === "sandbox" ? (sample ? t("prefixSample") : t("prefixPrivate")) : t("prefixCloud")} />}
    </section>
  );
}
