"use client";

import { useId } from "react";
import type { PhotoResult } from "./types";

/** The photo with SAM's head outline, the 35×45 crop frame and the 70–80% face-height band. */
export function PhotoStage({ src, width, height, busy, result }: { src: string; width: number; height: number; busy: boolean; result: PhotoResult | null }) {
  const mask = useId().replace(/:/g, "");
  const c = result?.crop?.crop;
  const band = c ? { top: c.y + c.h * 0.08, lo: c.y + c.h * (0.08 + 0.7), hi: c.y + c.h * (0.08 + 0.8) } : null;
  return (
    <div className={`ph-stage${busy ? " is-busy" : ""}`} style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(var(--ph-maxh, calc(100dvh - 120px)) * ${(width / height).toFixed(4)}))` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
      <img src={src} alt="Your photo" />
      {busy && <div className="lk-scan" aria-hidden="true" />}
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {c && (
          <>
            <defs>
              <mask id={mask}>
                <rect width={width} height={height} fill="white" />
                <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="black" />
              </mask>
            </defs>
            <rect width={width} height={height} className="ph-outside" mask={`url(#${mask})`} />
            <rect x={c.x} y={c.y} width={c.w} height={c.h} className="ph-frame" vectorEffect="non-scaling-stroke" />
            {band && (
              <>
                <line x1={c.x} x2={c.x + c.w} y1={band.top} y2={band.top} className="ph-guide" vectorEffect="non-scaling-stroke" />
                <rect x={c.x + c.w - Math.max(6, c.w * 0.025)} y={band.lo} width={Math.max(6, c.w * 0.025)} height={band.hi - band.lo} className="ph-band" />
              </>
            )}
          </>
        )}
        {result?.headPath && <path d={result.headPath} className="ph-head" pathLength={1} vectorEffect="non-scaling-stroke" />}
        {result?.facePath && <path d={result.facePath} className="ph-head" pathLength={1} vectorEffect="non-scaling-stroke" />}
        {!result?.headPath && result?.head && (
          <rect x={result.head[0]} y={result.head[1]} width={result.head[2] - result.head[0]} height={result.head[3] - result.head[1]} rx={10} className="ph-head" pathLength={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}
