"use client";

import { useEffect, useRef, useState } from "react";
import { Button, InlineError, StickyActionBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { LookSamples, type SamplePick } from "./LookSamples";

interface Props {
  phone: boolean;
  onFile(file: Blob, question: string): void;
  onSample(pick: SamplePick, question: string): void;
  error: string | null;
}

/** Entry: camera on phones (primary in the thumb-zone dock), file picker everywhere, drag-drop and paste on desktop. */
export function LookCapture({ phone, onFile, onSample, error }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [samples, setSamples] = useState(false);
  const q = useRef(question);
  useEffect(() => { q.current = question; }, [question]);

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
  const buttons = (
    <>
      <Button variant="primary" size="lg" block icon="camera" onClick={() => camera.current?.click()}>Take a photo</Button>
      <Button variant={phone ? "ghost" : "soft"} size="lg" block icon="file" onClick={() => picker.current?.click()}>Choose a photo or screenshot</Button>
    </>
  );

  return (
    <div className="stack lk-capture-wrap" style={{ ["--gap" as string]: "14px" }}>
      <div
        className={`lk-capture${over ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <div className="lk-capture-art" aria-hidden="true">
          <span className="lk-corner tl" /><span className="lk-corner tr" /><span className="lk-corner bl" /><span className="lk-corner br" />
          <Icon name="camera" size={30} />
        </div>
        <div className="lk-capture-actions">
          <p className="lk-capture-copy">Letters, MOS screens, UPO receipts, inPOL status and ticket kiosks.</p>
          {!phone && buttons}
          {!phone && <p className="small muted lk-desk-only" style={{ margin: 0 }}>Or drop an image here, or paste a screenshot.</p>}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <InlineError message={error} />}
      {asking ? (
        <label className="ui-field">
          <span>Ask about it (optional)</span>
          <input className="ui-input" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="Which button is for fingerprints?" autoFocus />
        </label>
      ) : (
        <div><Button variant="ghost" icon="help" onClick={() => setAsking(true)}>Ask a question about it</Button></div>
      )}
      <div><button type="button" className="lk-sample-link" onClick={() => setSamples(true)}>Use a test letter</button></div>
      <LookSamples open={samples} onPick={(p) => { setSamples(false); onSample(p, question); }} onClose={() => setSamples(false)} />
      {phone && (
        <StickyActionBar secondary={<Button variant="ghost" icon="file" onClick={() => picker.current?.click()}>Choose a photo or screenshot</Button>}>
          <Button variant="primary" icon="camera" onClick={() => camera.current?.click()}>Take a photo</Button>
        </StickyActionBar>
      )}
    </div>
  );
}
