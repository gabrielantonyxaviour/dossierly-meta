"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { LookSamples, type SamplePick } from "./LookSamples";

interface Props {
  onFile(file: Blob, question: string): void;
  onSample(pick: SamplePick, question: string): void;
  error: string | null;
}

/** Entry: camera on phones, file picker everywhere, drag-drop and paste on desktop. */
export function LookCapture({ onFile, onSample, error }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [samples, setSamples] = useState(false);
  const q = useRef(question);
  q.current = question;

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) {
        e.preventDefault();
        onFile(f, q.current);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f, question);
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "14px" }}>
      <div
        className={`lk-capture${over ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <div className="lk-capture-art" aria-hidden="true">
          <span className="lk-corner tl" /><span className="lk-corner tr" /><span className="lk-corner bl" /><span className="lk-corner br" />
          <Icon name="camera" size={34} />
        </div>
        <div className="lk-capture-actions">
          <button type="button" className="btn btn-primary lk-cta" onClick={() => camera.current?.click()}>
            <Icon name="camera" size={20} /> Take a photo
          </button>
          <button type="button" className="btn lk-cta" onClick={() => picker.current?.click()}>
            <Icon name="file" size={20} /> Choose a photo or screenshot
          </button>
          <p className="tiny muted lk-desk-only" style={{ margin: 0 }}>Or drop an image here, or paste a screenshot.</p>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <div className="error-box small" role="alert">{error}</div>}
      {asking ? (
        <label className="field">
          <span className="small">Ask about it <span className="muted">(optional)</span></span>
          <input className="input" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="Which button do I press for fingerprints?" autoFocus />
        </label>
      ) : (
        <button type="button" className="btn btn-ghost btn-small lk-ask" onClick={() => setAsking(true)}>
          <Icon name="help" size={16} /> Ask a question about it
        </button>
      )}
      <div className="lk-kinds" aria-label="Things Look reads">
        {["Letters from the office", "MOS form screens", "UPO receipts", "inPOL status", "Ticket kiosks"].map((k) => <span key={k} className="chip">{k}</span>)}
      </div>
      <button type="button" className="lk-sample-link" onClick={() => setSamples(true)}>Use a test letter</button>
      {samples && <LookSamples onPick={(p) => { setSamples(false); onSample(p, question); }} onClose={() => setSamples(false)} />}
    </div>
  );
}
