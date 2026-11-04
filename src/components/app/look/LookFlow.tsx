"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LookKind } from "@/lib/look/types";
import { Card, MobilePage, Row, ScreenTitle, Section } from "@/components/ui";
import { prepareFromUrl, prepareImage } from "./image";
import { LookCapture } from "./LookCapture";
import { LookResult } from "./LookResult";
import type { SamplePick } from "./LookSamples";
import { useIsPhone } from "./useIsPhone";
import { useLook } from "./useLook";
import "./look.css";

/** Spark grounding is accurate at about 1000 px on the long side and drifts above that. */
const LOOK_SIDE = 1000;
const LOOK_ID = /^lk_[A-Za-z0-9]{8,40}$/;
const SAMPLE_ID = /^[a-z0-9-]{1,60}$/;
const sampleSrc = (id: string) => (id.endsWith("-phone") ? `/sample/photos/${id}.jpg` : `/sample/letters/${id}.png`);

function setQuery(look: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("sample");
  if (look) url.searchParams.set("look", look);
  else url.searchParams.delete("look");
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

export function LookFlow() {
  const { state, run, replay, retry, reset } = useLook();
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

  /* Deep links: ?look=<id> draws a saved look again; ?sample=<id> reads a test letter live. */
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const q = new URLSearchParams(window.location.search);
    const look = q.get("look");
    const sample = q.get("sample");
    if (look && LOOK_ID.test(look)) void replay(look).then((m) => m && setPrepError(m));
    else if (sample && SAMPLE_ID.test(sample)) void Promise.resolve().then(() => start(() => prepareFromUrl(sampleSrc(sample), LOOK_SIDE), { question: "", sample: true }));
  }, [replay, start]);

  /* Keep the address pointing at the current look, so a reload or a shared link draws it again. */
  const lookId = state.read?.lookId;
  useEffect(() => {
    if (lookId) setQuery(lookId);
  }, [lookId]);
  const close = useCallback(() => {
    reset();
    setQuery(null);
  }, [reset]);

  const onFile = useCallback((f: Blob, question: string) => void start(() => prepareImage(f, LOOK_SIDE), { question }), [start]);
  const onSample = useCallback((p: SamplePick, question: string) => void start(() => prepareFromUrl(p.src, LOOK_SIDE), { question, sample: true }), [start]);

  if (state.phase !== "idle" && state.image) {
    return <LookResult key={state.image.dataUrl.length + state.image.width} state={state} phone={phone} onRetry={retry} onClose={close} />;
  }
  return (
    <MobilePage actions={phone ? "double" : undefined} wide className="lk-page lk-home">
      <ScreenTitle title="Look" sub="Show me a letter or a screen. I'll point at what matters and add it to your case." />
      <LookCapture phone={phone} onFile={onFile} onSample={onSample} error={prepError} />
      <Section title="Paperwork tools">
        <Card flush>
          <Row href="/app/mos-sheet" icon="prepare" title="MOS sheet" sub="Every form field in order, from your case" chevron />
          <Row href="/app/photo-check" icon="camera" title="Photo check" sub="Crop to exactly 684 × 883 px" chevron />
          <Row href="/app/visit-plan" icon="calendar" title="Visit plan" sub="What to bring, from official pages" chevron />
        </Card>
      </Section>
    </MobilePage>
  );
}
