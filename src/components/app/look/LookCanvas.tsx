"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const stage = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setShown(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Pins sit on each outline's top-left; stacked lines would overlap, so later pins step left until clear.
  const pins = useMemo(() => {
    const s = shown ? (28 * width) / shown : 0;
    const placed: Array<{ id: string; x: number; y: number }> = [];
    const order = items.map((it, n) => ({ it, n, b: outlines[it.id]?.box ?? it.box })).sort((a, b) => a.b[1] - b.b[1]);
    for (const { it, b } of order) {
      const y = Math.max(s / 2, b[1]);
      const clash = (x: number) => placed.some((p) => Math.abs(p.x - x) < s && Math.abs(p.y - y) < s);
      // Left edge first, stepping left while there is room; then the right end of the line, stepping right.
      const tries = [0, 1, 2].map((k) => b[0] - k * s).filter((x) => x >= s / 2).concat([0, 1, 2].map((k) => b[2] + k * s).filter((x) => x <= width - s / 2));
      const x = tries.find((t) => !clash(t)) ?? Math.max(s / 2, b[0]);
      placed.push({ id: it.id, x, y });
    }
    return new Map(placed.map((p) => [p.id, p]));
  }, [items, outlines, shown, width]);
  const shapeOf = (it: LookItem) => outlines[it.id]?.path || rectPath(outlines[it.id]?.box ?? it.box, pad);

  return (
    <div ref={stage} className={`lk-stage${busy ? " is-busy" : ""}${phase === "reading" ? " is-reading" : ""}`} style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(var(--lk-maxh, calc(100dvh - 48px)) * ${(width / height).toFixed(4)}))`, marginInline: "auto" }}>
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
        const pin = pins.get(it.id) ?? { x: b[0], y: b[1] };
        const tone = toneOf(it.role);
        return (
          <button
            key={it.id}
            type="button"
            className={`lk-pin tone-${tone}${active === it.id ? " is-active" : ""}`}
            style={{ left: `${(pin.x / width) * 100}%`, top: `${(pin.y / height) * 100}%`, animationDelay: `${n * 70}ms` }}
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
