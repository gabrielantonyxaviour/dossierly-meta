"use client";

import { useEffect, useState } from "react";
import type { LookKind } from "@/lib/look/types";
import { Sheet, Skeleton } from "@/components/ui";

export interface SamplePick {
  id: string;
  title: string;
  src: string;
  kind: LookKind;
}

type Catalogue = { letters?: Array<{ id: string; titleEn: string; png: string; phonePhoto: string | null; kind: LookKind }>; screens?: Array<{ id: string; titleEn: string; png: string; kind: LookKind }> };

const FALLBACK: SamplePick[] = [{ id: "wezwanie-sample", title: "Summons for missing documents", src: "/sample/wezwanie-sample.png", kind: "letter" }];

/** Fictional test material for judges and demos, in a bottom sheet. Every file is marked PRZYKŁAD / SAMPLE. */
export function LookSamples({ open, onPick, onClose }: { open: boolean; onPick(p: SamplePick): void; onClose(): void }) {
  const [picks, setPicks] = useState<SamplePick[] | null>(null);

  useEffect(() => {
    if (!open || picks) return;
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
  }, [open, picks]);

  return (
    <Sheet open={open} onClose={onClose} title="Test material" wide>
      <p className="muted" style={{ marginTop: 0 }}>Fictional documents for a fictional student, Arjun Raman, each stamped PRZYKŁAD (sample). They go through the same live models as your own photos.</p>
      <div className="lk-sample-grid">
        {!picks && [0, 1, 2, 3].map((i) => <Skeleton key={i} h={180} />)}
        {picks?.map((p) => (
          <button key={p.id} type="button" className="lk-sample" onClick={() => onPick(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static sample thumbnails */}
            <img src={p.src} alt="" loading="lazy" />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
