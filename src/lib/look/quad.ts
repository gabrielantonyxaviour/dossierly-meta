/*
 * Text in a phone photo is a tilted band, and SAM's mask of a text line is ragged. We keep SAM's geometry
 * (where the ink is and how it is tilted) but draw it as a clean rotated rounded rectangle: convex hull of the
 * mask contour → minimum-area rectangle (rotating calipers) → stretched along the line to Spark's horizontal
 * extent when SAM traced only part of the line → padded and rounded.
 */
import type { Pt } from "./trace";
import type { Box } from "./types";

export interface Quad {
  corners: [Pt, Pt, Pt, Pt]; // clockwise from top-left
  box: Box;
  angle: number; // radians, major axis vs. x
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

interface Frame { c: Pt; u: Pt; v: Pt; a: number; b: number } // centre, unit axes, half-lengths

/** Minimum-area enclosing rectangle; u is the longer axis, oriented left→right. */
export function minAreaRect(hull: Pt[]): Frame | null {
  if (hull.length < 3) return null;
  let best: Frame | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 1e-6) continue;
    const u: Pt = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const v: Pt = [-u[1], u[0]];
    let [minU, maxU, minV, maxV] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const h of hull) {
      const du = h[0] * u[0] + h[1] * u[1], dv = h[0] * v[0] + h[1] * v[1];
      minU = Math.min(minU, du); maxU = Math.max(maxU, du); minV = Math.min(minV, dv); maxV = Math.max(maxV, dv);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
      best = { c: [cu * u[0] + cv * v[0], cu * u[1] + cv * v[1]], u, v, a: (maxU - minU) / 2, b: (maxV - minV) / 2 };
    }
  }
  if (!best) return null;
  if (best.b > best.a) best = { ...best, u: best.v, v: [-best.v[1], best.v[0]], a: best.b, b: best.a };
  if (best.u[0] < 0) best = { ...best, u: [-best.u[0], -best.u[1]], v: [-best.v[0], -best.v[1]] };
  return best;
}

/** Rotated rectangle around the mask points, stretched to Spark's x-span for near-horizontal text. */
export function textQuad(points: Pt[], spark: Box, pad: number): Quad | null {
  const f = minAreaRect(convexHull(points));
  if (!f) return null;
  let { c, a } = f;
  const { u, v } = f;
  if (Math.abs(u[0]) > 0.94) {
    // Where the centre line meets Spark's left and right edges.
    const t1 = (spark[0] - c[0]) / u[0], t2 = (spark[2] - c[0]) / u[0];
    const lo = Math.min(-a, Math.max(t1, -a * 4)), hi = Math.max(a, Math.min(t2, a * 4));
    const mid = (lo + hi) / 2;
    c = [c[0] + u[0] * mid, c[1] + u[1] * mid];
    a = (hi - lo) / 2;
  }
  const A = a + pad, B = f.b + pad;
  const at = (su: number, sv: number): Pt => [c[0] + u[0] * A * su + v[0] * B * sv, c[1] + u[1] * A * su + v[1] * B * sv];
  // v points "down" when u points right (screen coords), so -v is the top edge.
  const corners: [Pt, Pt, Pt, Pt] = [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  return { corners, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], angle: Math.atan2(u[1], u[0]) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Closed path through four corners with rounded joins. */
export function roundedQuadPath(corners: Pt[], radius: number): string {
  const n = corners.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = corners[(i + n - 1) % n], cur = corners[i], next = corners[(i + 1) % n];
    const toPrev = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]), toNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    const r = Math.min(radius, toPrev / 2, toNext / 2);
    const a: Pt = [cur[0] + ((prev[0] - cur[0]) / toPrev) * r, cur[1] + ((prev[1] - cur[1]) / toPrev) * r];
    const b: Pt = [cur[0] + ((next[0] - cur[0]) / toNext) * r, cur[1] + ((next[1] - cur[1]) / toNext) * r];
    parts.push(`${i === 0 ? "M" : "L"}${r1(a[0])},${r1(a[1])}Q${r1(cur[0])},${r1(cur[1])} ${r1(b[0])},${r1(b[1])}`);
  }
  return `${parts.join("")}Z`;
}
