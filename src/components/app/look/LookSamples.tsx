"use client";

import { useEffect, useState } from "react";
import type { LookKind } from "@/lib/look/types";

export interface SamplePick {
  id: string;
  title: string;
  src: string;
  kind: LookKind;
}

type Catalogue = { letters?: Array<{ id: string; titleEn: string; png: string; phonePhoto: string | null; kind: LookKind }>; screens?: Array<{ id: string; titleEn: string; png: string; kind: LookKind }> };

const FALLBACK: SamplePick[] = [{ id: "wezwanie-sample", title: "Summons for missing documents", src: "/sample/wezwanie-sample.png", kind: "letter" }];

/** Fictional test material for judges and demos. Every file is marked PRZYKŁAD / SAMPLE. */
export function LookSamples({ onPick, onClose }: { onPick(p: SamplePick): void; onClose(): void }) {
  const [picks, setPicks] = useState<SamplePick[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/letters/samples")
      .then((r) => (r.ok ? (r.json() as Promise<Catalogue>) : null))
      .then((c) => {
        if (!live) return;
        const out: SamplePick[] = [];
        for (const l of c?.letters ?? []) {
          if (l.phonePhoto) out.push({ id: `${l.id}-phone`, title: `${l.titleEn} (phone photo)`, src: l.phonePhoto, kind: l.kind });
          out.push({ id: l.id, title: l.titleEn, src: l.png, kind: l.kind });
        }
        for (const s of c?.screens ?? []) out.push({ id: s.id, title: s.titleEn, src: s.png, kind: s.kind });
        setPicks(out.length ? out : FALLBACK);
      })
      .catch(() => live && setPicks(FALLBACK));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lk-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="lk-samples-title">
      <button type="button" className="lk-sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="lk-sheet">
        <div className="row between">
          <h3 id="lk-samples-title" style={{ margin: 0 }}>Test material</h3>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onClose}>Close</button>
        </div>
        <p className="small muted">Fictional documents for a fictional student, Arjun Raman. Each is stamped PRZYKŁAD (sample). They run through the same live models as your own photos.</p>
        {!picks && <div className="lk-sample-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ aspectRatio: "3 / 4" }} />)}</div>}
        {picks && (
          <div className="lk-sample-grid">
            {picks.map((p) => (
              <button key={p.id} type="button" className="lk-sample" onClick={() => onPick(p)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static sample thumbnails */}
                <img src={p.src} alt="" loading="lazy" />
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
