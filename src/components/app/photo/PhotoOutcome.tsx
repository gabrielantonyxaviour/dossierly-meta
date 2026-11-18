"use client";

import { forwardRef } from "react";
import { formatBytes } from "@/components/ui/Dropzone";
import { MOS_H, MOS_MAX_BYTES, MOS_W, type PhotoResult } from "./types";
import { useT } from "@/lib/i18n/client";

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
  const t = useT("photo");
  const crop = result.crop;
  const bg = result.checks.find((c) => c.id === "background")?.status ?? "unsure";
  const ticks: Array<[string, Status]> = [
    [`${MOS_W} × ${MOS_H} px`, "pass"],
    [t("tickFraming"), crop?.fits ? "pass" : "fail"],
    [t("tickSize"), out.blob.size <= MOS_MAX_BYTES ? "pass" : "fail"],
    [t("tickBg"), bg],
    [t("tickFace"), !crop?.fits ? "fail" : crop.notes.length ? "unsure" : "pass"],
  ];
  return (
    <section ref={ref} className="ui-card ph-outcome" aria-label={t("outcomeAria")}>
      <div className="ph-compare">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          <img src={original.url} alt={t("beforeAlt")} style={{ aspectRatio: `${original.width} / ${original.height}` }} />
          <figcaption><span className="tab-label">{t("before")}</span><b className="mono">{original.width} × {original.height}</b><span className="mono">{formatBytes(original.bytes)}</span></figcaption>
        </figure>
        <span className="ph-arrow" aria-hidden="true">→</span>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          <img src={out.url} alt={t("afterAlt", { w: MOS_W, h: MOS_H })} style={{ aspectRatio: `${MOS_W} / ${MOS_H}` }} />
          <figcaption><span className="tab-label">{t("after")}</span><b className="mono">{MOS_W} × {MOS_H}</b><span className="mono">{formatBytes(out.blob.size)}</span></figcaption>
        </figure>
      </div>
      <ul className="ph-ticks">
        {ticks.map(([label, s]) => (
          <li key={label} className={`is-${s}`}><span className="ph-mark" aria-label={t(`status_${s}`)}>{MARK[s]}</span>{label}</li>
        ))}
      </ul>
      {crop?.upscaled && <span className="ui-pill ui-pill--warn">{t("lowRes")}</span>}
    </section>
  );
});
