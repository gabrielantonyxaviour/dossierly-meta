"use client";

import { useRef, useState } from "react";
import { fileToPages, urlToPages } from "@/lib/client/pages";
import { Icon } from "../../Icon";
import { Dropzone } from "../../ui/Dropzone";

export function LetterPicker({ sample, onPages, onError }: { sample: boolean; freeUsed: boolean; onPages(p: string[]): void; onError(m: string): void }) {
  const camera = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const take = async (file?: File | null) => {
    if (!file) return;
    setPreparing(true);
    try {
      const { pages } = await fileToPages(file);
      if (!pages.length) throw new Error("That file has no pages we can read.");
      onPages(pages);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not open that file.");
    } finally {
      setPreparing(false);
    }
  };

  const loadSample = async () => {
    setPreparing(true);
    try {
      onPages(await urlToPages("/sample/wezwanie-sample.png"));
    } catch {
      onError("Could not load the sample letter.");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className="card stack" aria-label="Add a letter">
      <div className="ui-picker">
        <button className="pick ui-picker-camera" onClick={() => camera.current?.click()} disabled={preparing}>
          <Icon name="camera" size={28} />
          <b>Photograph the letter</b>
          <small>Flat surface, all four corners in view</small>
        </button>
        <Dropzone
          accept="application/pdf,image/*"
          onFile={(f) => void take(f)}
          hint="PDF or photo from e-Doręczenia or email, up to 4 pages"
          compactLabel="Or choose a PDF or photo"
          disabled={preparing}
        />
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void take(e.target.files?.[0])} aria-label="Letter photo" />
      {sample && (
        <div className="sample-letter row">
          <span className="stamp">Sample</span>
          <span className="grow small">Arjun&apos;s letter from the Mazowiecki office: a <i>wezwanie</i> about missing documents.</span>
          <button className="btn btn-primary btn-small" onClick={() => void loadSample()} disabled={preparing}>Use the sample letter</button>
        </div>
      )}
      {preparing && <p className="small muted" role="status" style={{ margin: 0 }}>Preparing pages on your device…</p>}
      <p className="tiny muted" style={{ margin: 0 }}>Reading letters is free.</p>
    </section>
  );
}
