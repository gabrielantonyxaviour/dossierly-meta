"use client";

import { forwardRef } from "react";
import { formatBytes } from "@/components/ui/Dropzone";
import { MOS_H, MOS_MAX_BYTES, MOS_W, type PhotoResult } from "./types";

export interface OriginalInfo {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

type Status = "pass" | "fail" | "unsure";
const MARK: Record<Status, string> = { pass: "✓", fail: "!", unsure: "?" };

/** Before → after, and the five things MOS rejects most often, large enough to read at a glance. */
export const PhotoOutcome = forwardRef<HTMLElement, { original: OriginalInfo; out: { blob: Blob; url: string }; result: PhotoResult }>(function PhotoOutcome({ original, out, result }, ref) {
  const crop = result.crop;
  const bg = result.checks.find((c) => c.id === "background")?.status ?? "unsure";
  const ticks: Array<[string, Status]> = [
    [`${MOS_W} × ${MOS_H} px`, "pass"],
    ["35 × 45 framing", crop?.fits ? "pass" : "fail"],
    ["Under 2.5 MB", out.blob.size <= MOS_MAX_BYTES ? "pass" : "fail"],
    ["Plain background", bg],
    ["Face position", !crop?.fits ? "fail" : crop.notes.length ? "unsure" : "pass"],
  ];
  return (
    <section ref={ref} className="ui-card ph-outcome" aria-label="Before and after">
      <div className="ph-compare">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          <img src={original.url} alt="Your photo as you chose it" style={{ aspectRatio: `${original.width} / ${original.height}` }} />
          <figcaption><span className="tab-label">Before</span><b className="mono">{original.width} × {original.height}</b><span className="mono">{formatBytes(original.bytes)}</span></figcaption>
        </figure>
        <span className="ph-arrow" aria-hidden="true">→</span>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          <img src={out.url} alt={`Your MOS photo, ${MOS_W} by ${MOS_H} pixels`} style={{ aspectRatio: `${MOS_W} / ${MOS_H}` }} />
          <figcaption><span className="tab-label">After</span><b className="mono">{MOS_W} × {MOS_H}</b><span className="mono">{formatBytes(out.blob.size)}</span></figcaption>
        </figure>
      </div>
      <ul className="ph-ticks">
        {ticks.map(([label, s]) => (
          <li key={label} className={`is-${s}`}><span className="ph-mark" aria-label={s}>{MARK[s]}</span>{label}</li>
        ))}
      </ul>
      {crop?.upscaled && <span className="ui-pill ui-pill--warn">Low resolution: enlarged to fit</span>}
    </section>
  );
});
