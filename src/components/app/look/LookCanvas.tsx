"use client";

import { useId } from "react";
import type { ItemRole, LookItem, LookOutline } from "@/lib/look/types";
import type { LookPhase } from "./useLook";

export type Tone = "deadline" | "user" | "official";
export const toneOf = (role: ItemRole): Tone => (role === "deadline" ? "deadline" : role === "field" || role === "button" ? "user" : "official");

const rectPath = ([x1, y1, x2, y2]: [number, number, number, number], pad: number) => {
  const r = Math.min(10, (y2 - y1) / 3);
  const [a, b, c, d] = [x1 - pad, y1 - pad, x2 + pad, y2 + pad];
  return `M${a + r},${b}H${c - r}Q${c},${b} ${c},${b + r}V${d - r}Q${c},${d} ${c - r},${d}H${a + r}Q${a},${d} ${a},${d - r}V${b + r}Q${a},${b} ${a + r},${b}Z`;
};

interface Props {
  src: string;
  width: number;
  height: number;
  phase: LookPhase;
  items: LookItem[];
  outlines: Record<string, LookOutline>;
  active: string | null;
  onSelect(id: string | null): void;
}

/** The photo with Spark's boxes (dashed, while SAM works) and SAM's traced outlines on top. */
export function LookCanvas({ src, width, height, phase, items, outlines, active, onSelect }: Props) {
  const maskId = useId().replace(/:/g, "");
  const pad = Math.max(4, Math.round(Math.min(width, height) * 0.006));
  const busy = phase === "reading" || phase === "outlining";
  const activeItem = items.find((i) => i.id === active) ?? null;
  const shapeOf = (it: LookItem) => outlines[it.id]?.path || rectPath(outlines[it.id]?.box ?? it.box, pad);

  return (
    <div className={`lk-stage${busy ? " is-busy" : ""}${phase === "reading" ? " is-reading" : ""}`} style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc((100dvh - 48px) * ${(width / height).toFixed(4)}))`, marginInline: "auto" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not an optimisable asset */}
      <img src={src} alt="The image you showed Dossierly" width={width} height={height} draggable={false} />
      {phase === "reading" && <div className="lk-scan" aria-hidden="true" />}
      <svg className="lk-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {activeItem && (
          <>
            <defs>
              <mask id={maskId}>
                <rect width={width} height={height} fill="white" />
                <path d={shapeOf(activeItem)} fill="black" />
              </mask>
            </defs>
            <rect className="lk-dim" width={width} height={height} mask={`url(#${maskId})`} />
          </>
        )}
        {items.map((it) => {
          const traced = outlines[it.id];
          const tone = toneOf(it.role);
          const dimmed = active !== null && active !== it.id;
          return (
            <g key={it.id} className={`lk-shape tone-${tone}${dimmed ? " is-dim" : ""}${active === it.id ? " is-active" : ""}`}>
              {!traced && <path d={rectPath(it.box, pad)} className="lk-box" vectorEffect="non-scaling-stroke" />}
              {traced && <path key={`t-${it.id}`} d={traced.path || rectPath(traced.box, pad)} className="lk-trace" pathLength={1} vectorEffect="non-scaling-stroke" />}
            </g>
          );
        })}
      </svg>
      {items.map((it, n) => {
        const b = outlines[it.id]?.box ?? it.box;
        const tone = toneOf(it.role);
        return (
          <button
            key={it.id}
            type="button"
            className={`lk-pin tone-${tone}${active === it.id ? " is-active" : ""}`}
            style={{ left: `${(b[0] / width) * 100}%`, top: `${(b[1] / height) * 100}%`, animationDelay: `${n * 70}ms` }}
            onClick={() => onSelect(active === it.id ? null : it.id)}
            aria-pressed={active === it.id}
            aria-label={`${n + 1}. ${it.label}`}
          >
            {n + 1}
          </button>
        );
      })}
    </div>
  );
}
