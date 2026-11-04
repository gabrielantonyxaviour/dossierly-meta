"use client";

import type { CapturedItem, TurnMetric } from "@/lib/voice/protocol";
import { Icon } from "../Icon";

const fmtDate = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Tasks and deadlines the conversation just put in the case. */
export function Captured({ items }: { items: CapturedItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="vc-captured" aria-label="Added to your case">
      {items.map((c) => (
        <li key={c.id} className="vc-cap">
          <Icon name="check" size={16} />
          <span>
            <small>{c.kind === "deadline" ? "Deadline added" : "Task added"}</small>
            <b>{c.title}</b>
          </span>
          {c.dueDate && <em>due {fmtDate(c.dueDate)}</em>}
        </li>
      ))}
    </ul>
  );
}

/** Honest latency: speech end → first translated/spoken audio, measured on the server, last turn and median. */
export function LatencyLine({ metrics }: { metrics: TurnMetric[] }) {
  const done = metrics.filter((m) => typeof m.totalMs === "number");
  if (!done.length) return null;
  const last = done[done.length - 1];
  const sorted = done.map((m) => m.totalMs!).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const s = (ms?: number) => (typeof ms === "number" ? `${(ms / 1000).toFixed(1)} s` : "–");
  return (
    <p className="vc-latency" title="Speech end → first audio back. Hear = Muse Voice Transcribe, think = Muse Spark, voice = ElevenLabs Flash.">
      <span>Last reply {s(last.totalMs)}</span>
      <span>hear {s(last.asrMs)} · think {s(last.llmMs)} · voice {s(last.ttsMs)}</span>
      {done.length > 1 && <span>median {s(median)} over {done.length}</span>}
    </p>
  );
}
