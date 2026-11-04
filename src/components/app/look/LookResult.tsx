"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommitResult, LookKind } from "@/lib/look/types";
import { Button, ButtonLink, FullScreenFlow, InlineError, Pill, Skeleton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { LookCanvas } from "./LookCanvas";
import { canSave, LookConfirm, LookSaved } from "./LookConfirm";
import { LookItems } from "./LookItems";
import type { LookState } from "./useLook";

const KIND: Record<LookKind, string> = {
  letter: "Letter from the office", decision: "Decision", mos_screen: "MOS form screen", upo: "Filing receipt (UPO)",
  inpol_status: "inPOL status", kiosk: "Ticket kiosk", other: "Not an official document",
};
const secs = (ms: number | null) => (ms === null ? "" : `${(ms / 1000).toFixed(1)} s`);
const READ_HINTS = ["Transcribing every line", "Finding the case number and dates", "Looking for what they ask you to do", "Matching it to your case"];

function useElapsed(on: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = Date.now();
    const id = setInterval(() => setT(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [on]);
  return on ? t : 0;
}

function Progress({ phase, readMs, samMs, count }: { phase: string; readMs: number | null; samMs: number | null; count: number }) {
  const elapsed = useElapsed(phase === "reading");
  const step = (label: string, model: string, state: "wait" | "run" | "ok", time?: string) => (
    <li className={`lk-prog is-${state}`}>
      <span className="lk-prog-dot" aria-hidden="true">{state === "ok" ? <Icon name="check" size={13} /> : null}</span>
      <span className="grow">{label}</span>
      <span className="lk-model">{model}{time ? ` · ${time}` : ""}</span>
    </li>
  );
  const reading = phase === "reading";
  return (
    <ol className="lk-progress" aria-live="polite">
      {step(reading ? `${READ_HINTS[Math.min(READ_HINTS.length - 1, Math.floor(elapsed / 6))]}…` : "Read and pointed", "Muse Spark 1.3", reading ? "run" : "ok", reading ? `${elapsed} s` : secs(readMs))}
      {step(count ? `Traced ${count} exact outlines` : "Tracing exact outlines", "SAM 3.1", reading ? "wait" : samMs === null && phase !== "error" && phase !== "done" ? "run" : "ok", secs(samMs))}
    </ol>
  );
}

interface Props {
  state: LookState;
  phone: boolean;
  onRetry(): void;
  onClose(): void;
}

export function LookResult({ state, phone, onRetry, onClose }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState<CommitResult | null>(null);
  const traced = useMemo(() => new Set(Object.keys(state.outlines)), [state.outlines]);
  const { read, image, phase } = state;
  if (!image) return null;
  const items = read?.items ?? [];
  const savable = !!read && phase === "done" && canSave(read);
  const done = (r: CommitResult) => { setSaved(r); setSheet(false); };

  const visual = (
    <div className="lk-visual">
      <LookCanvas src={image.dataUrl} width={image.width} height={image.height} phase={phase} items={items} outlines={state.outlines} active={active} onSelect={setActive} />
      {state.sample && <Pill tone="official" className="lk-sample-stamp">Fictional sample</Pill>}
    </div>
  );
  const panel = (
    <div className="lk-panel stack" style={{ ["--gap" as string]: "18px" }}>
      <Progress phase={phase} readMs={state.readMs} samMs={state.samMs} count={items.length} />
      {phase === "reading" && !read && (
        <div className="stack" style={{ ["--gap" as string]: "10px" }} aria-hidden="true"><Skeleton w="40%" /><Skeleton h={28} w="85%" /><Skeleton h={64} /></div>
      )}
      {state.error && <InlineError message={state.error.message} onRetry={state.error.retryable ? onRetry : undefined} />}
      {read && (
        <>
          {saved && <LookSaved result={saved} />}
          <section className="stack" style={{ ["--gap" as string]: "8px" }}>
            <div><Pill tone={read.kind === "other" ? "neutral" : "official"}>{KIND[read.kind]}</Pill></div>
            <h2 className="lk-title">{read.title}</h2>
            <p className="lk-summary">{read.summary}</p>
          </section>
          {read.actions.length > 0 && (
            <section className="lk-actions" aria-label="What to do">
              <span className="tab-label">What to do</span>
              <ol>{read.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
            </section>
          )}
          <LookItems items={items} uncertain={read.uncertain} active={active} traced={traced} onSelect={setActive} />
          {savable && !saved && !phone && <LookConfirm key={read.lookId} read={read} onDone={done} />}
        </>
      )}
    </div>
  );

  if (!phone) {
    return (
      <div className="sh-page sh-page--wide lk-page lk-result">
        {visual}
        <div className="stack" style={{ ["--gap" as string]: "12px" }}>
          <div><Button variant="ghost" size="sm" icon="camera" onClick={onClose}>Look at something else</Button></div>
          {panel}
        </div>
      </div>
    );
  }

  const footer = saved ? (
    <><Button variant="secondary" size="lg" icon="camera" onClick={onClose}>Look again</Button><ButtonLink variant="primary" size="lg" href="/app">Open my case</ButtonLink></>
  ) : savable ? (
    <Button variant="primary" size="lg" block onClick={() => setSheet(true)}>{read?.letter?.deadlineRule.amount ? "Work out my deadline" : "Add to my case"}</Button>
  ) : phase === "error" || phase === "done" ? (
    <Button variant="secondary" size="lg" block icon="camera" onClick={onClose}>{phase === "error" ? "Try another photo" : "Look at something else"}</Button>
  ) : undefined;

  return (
    <FullScreenFlow title="Look" onClose={onClose} footer={footer} dark>
      <div className="lk-phone stack" style={{ ["--gap" as string]: "16px" }}>
        {visual}
        {panel}
      </div>
      {read && savable && !saved && <LookConfirm key={read.lookId} read={read} onDone={done} sheet={{ open: sheet, onClose: () => setSheet(false) }} />}
    </FullScreenFlow>
  );
}
