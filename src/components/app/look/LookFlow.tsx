"use client";

import { useCallback, useState } from "react";
import type { LookKind } from "@/lib/look/types";
import { Card, Row, Section, TopBar } from "@/components/ui";
import { prepareFromUrl, prepareImage } from "./image";
import { LookCapture } from "./LookCapture";
import { LookResult } from "./LookResult";
import type { SamplePick } from "./LookSamples";
import { useIsPhone } from "./useIsPhone";
import { useLook } from "./useLook";
import "./look.css";

/** Spark grounding is accurate at about 1000 px on the long side and drifts above that. */
const LOOK_SIDE = 1000;

export function LookFlow() {
  const { state, run, retry, reset } = useLook();
  const phone = useIsPhone();
  const [prepError, setPrepError] = useState<string | null>(null);

  const start = useCallback(async (get: () => Promise<Awaited<ReturnType<typeof prepareImage>>>, opts: { question: string; sample?: boolean; hint?: LookKind }) => {
    setPrepError(null);
    try {
      const img = await get();
      void run(img, { question: opts.question, sample: opts.sample, hint: opts.hint });
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : "That image could not be opened.");
    }
  }, [run]);

  const onFile = useCallback((f: Blob, question: string) => void start(() => prepareImage(f, LOOK_SIDE), { question }), [start]);
  const onSample = useCallback((p: SamplePick, question: string) => void start(() => prepareFromUrl(p.src, LOOK_SIDE), { question, sample: true }), [start]);

  if (state.phase !== "idle" && state.image) {
    return <LookResult key={state.image.dataUrl.length + state.image.width} state={state} phone={phone} onRetry={retry} onClose={reset} />;
  }
  return (
    <div className="sh-page sh-page--wide lk-page lk-home">
      <TopBar title="Look" sub="Show me a letter or a screen. I'll point at what matters and add it to your case." />
      <LookCapture phone={phone} onFile={onFile} onSample={onSample} error={prepError} />
      <Section title="Paperwork tools">
        <Card flush>
          <Row href="/app/mos-sheet" icon="prepare" title="MOS sheet" sub="Every form field in order, from your case" chevron />
          <Row href="/app/photo-check" icon="camera" title="Photo check" sub="Crop to exactly 684 × 883 px" chevron />
          <Row href="/app/visit-plan" icon="calendar" title="Visit plan" sub="What to bring, from official pages" chevron />
        </Card>
      </Section>
    </div>
  );
}
