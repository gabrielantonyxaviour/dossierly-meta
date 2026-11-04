"use client";

import { useEffect, useState } from "react";
import { sandboxLabel } from "@/lib/client/api";
import { seconds } from "@/lib/client/format";
import { useCase } from "@/lib/client/store";
import type { AgentTask } from "@/lib/client/types";
import { Attribution } from "../../Attribution";

const clean = (t: string) => t.replace(/settla[-_]?/gi, "");

/** Live view of what the personal agent is doing: each step, its tool, and where it ran. */
export function AgentTrace({ task, startedAt }: { task: AgentTask | null; startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt]);

  const sample = useCase().dossier?.sample;
  const agent = sample ? "the shared sample agent" : "your private agent";
  const elapsed = startedAt ? now - startedAt : 0;
  const where = task?.ranOn === "sandbox"
    ? `${agent}${task.sandbox ? ` (${sandboxLabel(task.sandbox)})` : ""}`
    : task?.ranOn === "cloud"
      ? "the cloud fallback · Muse Spark"
      : `waiting for ${agent}`;

  return (
    <section className="card stack" aria-label="Agent activity" aria-live="polite" style={{ ["--gap" as string]: "10px" }}>
      <div className="row between">
        <span className="tab-label">Agent trace</span>
        <span className={`chip ran-on ${task?.ranOn === "sandbox" ? "chip-ok" : ""}`}>
          {task?.status === "done" ? "Ran in " : task?.ranOn ? "Running in " : ""}{where}
        </span>
      </div>
      <ol className="trace">
        {(task?.trace ?? [{ step: "Sending your masked case to the agent", ms: 0 }]).map((s, i) => (
          <li key={i}>
            <span className="tick" aria-hidden="true" />
            <span>{clean(s.step)}{s.tool && <span className="tool"> · {clean(s.tool)}</span>}</span>
            <span className="mono tiny muted">{s.ms ? seconds(s.ms) : ""}</span>
          </li>
        ))}
        {startedAt && (
          <li>
            <span className="spinner" aria-hidden="true" style={{ width: 12, height: 12, marginTop: 4 }} />
            <span className="muted">{task?.status === "running" ? "Working…" : "Queued"}</span>
            <span className="mono tiny muted">{seconds(elapsed)}</span>
          </li>
        )}
      </ol>
      {startedAt && !task?.ranOn && elapsed > 6000 && (
        <p className="tiny muted" style={{ margin: 0 }}>If {agent} does not pick this up within 20 seconds, the same step runs in the cloud and is labelled that way.</p>
      )}
      {task?.run && <Attribution run={task.run} prefix={task.ranOn === "sandbox" ? (sample ? "sample agent" : "private agent") : "cloud fallback"} />}
    </section>
  );
}
