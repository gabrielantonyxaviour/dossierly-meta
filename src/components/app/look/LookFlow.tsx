"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LookKind } from "@/lib/look/types";
import { Icon } from "@/components/Icon";
import { prepareFromUrl, prepareImage } from "./image";
import { LookCanvas } from "./LookCanvas";
import { LookCapture } from "./LookCapture";
import { LookConfirm } from "./LookConfirm";
import { LookItems } from "./LookItems";
import type { SamplePick } from "./LookSamples";
import { useLook } from "./useLook";
import "./look.css";

const KIND: Record<LookKind, string> = {
  letter: "Letter from the office", decision: "Decision", mos_screen: "MOS form screen", upo: "Filing receipt (UPO)",
  inpol_status: "inPOL status", kiosk: "Ticket kiosk", other: "Not an official document",
};
/** Spark grounding is accurate at about 1000 px on the long side and drifts above that. */
const LOOK_SIDE = 1000;
const secs = (ms: number | null) => (ms === null ? "" : `${(ms / 1000).toFixed(1)} s`);

function useElapsed(on: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = Date.now();
    setT(0);
    const id = setInterval(() => setT(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [on]);
  return t;
}

const READ_HINTS = ["Transcribing every line", "Finding the case number and dates", "Looking for what they ask you to do", "Matching it to your case"];

function Progress({ phase, readMs, samMs, count }: { phase: string; readMs: number | null; samMs: number | null; count: number }) {
  const elapsed = useElapsed(phase === "reading");
  const step = (label: string, model: string, state: "wait" | "run" | "ok", time?: string) => (
    <li className={`lk-prog is-${state}`}>
      <span className="lk-prog-dot" aria-hidden="true">{state === "ok" ? <Icon name="check" size={13} /> : null}</span>
      <span className="grow">{label}</span>
      <span className="lk-model">{model}{time ? ` · ${time}` : ""}</span>
    </li>
  );
  return (
    <ol className="lk-progress" aria-live="polite">
      {step(phase === "reading" ? `${READ_HINTS[Math.min(READ_HINTS.length - 1, Math.floor(elapsed / 6))]}…` : "Read and pointed", "Muse Spark 1.3", phase === "reading" ? "run" : "ok", phase === "reading" ? `${elapsed} s` : secs(readMs))}
      {step(count ? `Tracing ${count} exact outlines` : "Tracing exact outlines", "SAM 3.1", phase === "reading" ? "wait" : samMs === null && phase !== "error" && phase !== "done" ? "run" : "ok", secs(samMs))}
    </ol>
  );
}

export function LookFlow() {
  const { state, run, retry, reset } = useLook();
  const [active, setActive] = useState<string | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);

  const start = useCallback(async (get: () => Promise<Awaited<ReturnType<typeof prepareImage>>>, opts: { question: string; sample?: boolean; hint?: LookKind }) => {
    setPrepError(null);
    setActive(null);
    try {
      const img = await get();
      void run(img, { question: opts.question, sample: opts.sample, hint: opts.hint });
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : "That image could not be opened.");
    }
  }, [run]);

  const onFile = useCallback((f: Blob, question: string) => void start(() => prepareImage(f, LOOK_SIDE), { question }), [start]);
  const onSample = useCallback((p: SamplePick, question: string) => void start(() => prepareFromUrl(p.src, LOOK_SIDE), { question, sample: true }), [start]);
  const traced = useMemo(() => new Set(Object.keys(state.outlines)), [state.outlines]);

  if (state.phase === "idle" || !state.image) {
    return (
      <div className="lk-page">
        <header className="lk-head">
          <h1>Look</h1>
          <p className="muted">Show me any letter, MOS screen, receipt or ticket kiosk. I&apos;ll point at exactly what matters and put it in your case.</p>
        </header>
        <LookCapture onFile={onFile} onSample={onSample} error={prepError} />
      </div>
    );
  }

  const { read, image, phase } = state;
  const items = read?.items ?? [];
  return (
    <div className="lk-page lk-result">
      <div className="lk-visual">
        <LookCanvas src={image.dataUrl} width={image.width} height={image.height} phase={phase} items={items} outlines={state.outlines} active={active} onSelect={setActive} />
        {state.sample && <span className="stamp lk-sample-stamp">Fictional sample</span>}
      </div>
      <div className="lk-panel stack" style={{ ["--gap" as string]: "18px" }}>
        <div className="row between">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => { reset(); setActive(null); }}>
            <Icon name="camera" size={16} /> Look at something else
          </button>
        </div>
        <Progress phase={phase} readMs={state.readMs} samMs={state.samMs} count={items.length} />
        {phase === "reading" && !read && (
          <div className="stack" style={{ ["--gap" as string]: "10px" }} aria-hidden="true">
            <div className="skeleton" style={{ width: "40%" }} /><div className="skeleton" style={{ height: 28, width: "85%" }} /><div className="skeleton" style={{ height: 64 }} />
          </div>
        )}
        {state.error && (
          <div className="error-box stack" role="alert" style={{ ["--gap" as string]: "10px" }}>
            <p style={{ margin: 0 }}>{state.error.message}</p>
            {state.error.retryable && <div><button type="button" className="btn btn-small" onClick={retry}>Try again</button></div>}
          </div>
        )}
        {read && (
          <>
            <section className="stack" style={{ ["--gap" as string]: "8px" }}>
              <span className={`chip ${read.kind === "other" ? "" : "chip-official"}`}>{KIND[read.kind]}</span>
              <h2 className="lk-title">{read.title}</h2>
              <p style={{ margin: 0 }}>{read.summary}</p>
            </section>
            {read.actions.length > 0 && (
              <section className="lk-actions" aria-label="What to do">
                <span className="tab-label">What to do</span>
                <ol>{read.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
              </section>
            )}
            <LookItems items={items} uncertain={read.uncertain} active={active} traced={traced} onSelect={setActive} />
            {read.readable && phase === "done" && <LookConfirm key={read.lookId} read={read} />}
          </>
        )}
      </div>
    </div>
  );
}
