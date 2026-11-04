/*
 * Pure raster geometry for Look outlines: mask raster -> outer contours -> simplified SVG path in source pixels.
 * No I/O, no model code, so it is fully unit-testable with synthetic rasters.
 */
import type { Box } from "./types";

export type Pt = [number, number];

/** Area of a ring in pixel corners; positive for the outer loops produced by `traceLoops`, negative for holes. */
export function ringArea(r: Pt[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Boundary loops of the foreground (value != 0) of a w*h raster, on pixel corners. Foreground stays on the
 * right of every edge, so outer loops have positive `ringArea` and holes negative. Diagonal touches merge
 * (8-connectivity). Collinear runs are already merged.
 */
export function traceLoops(raster: ArrayLike<number>, w: number, h: number): Pt[][] {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && raster[y * w + x] !== 0;
  const W = w + 1;
  const out = new Map<number, number[]>(); // start vertex -> end vertices
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = y1 * W + x1;
    const l = out.get(k);
    if (l) l.push(y2 * W + x2);
    else out.set(k, [y2 * W + x2]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) add(x, y, x + 1, y);
      if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!on(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: Pt[][] = [];
  for (const [start, firstEnds] of out) {
    while (firstEnds.length) {
      const ring: Pt[] = [];
      let from = start;
      let to = firstEnds.pop()!;
      let dir = [to % W - (from % W), Math.floor(to / W) - Math.floor(from / W)];
      ring.push([from % W, Math.floor(from / W)]);
      for (let guard = 0; guard < 4 * w * h + 8; guard++) {
        const [px, py] = [to % W, Math.floor(to / W)];
        if (to === start) break;
        const ends = out.get(to);
        if (!ends || !ends.length) break;
        let pick = 0;
        if (ends.length > 1) {
          // Saddle vertex: prefer the leftmost turn so diagonal pixels stay in one loop.
          const turn = (e: number) => dir[0] * (Math.floor(e / W) - py) - dir[1] * (e % W - px);
          pick = ends.reduce((best, e, i) => (turn(e) < turn(ends[best]) ? i : best), 0);
        }
        const next = ends.splice(pick, 1)[0];
        const nd = [next % W - px, Math.floor(next / W) - py];
        if (nd[0] !== dir[0] || nd[1] !== dir[1]) ring.push([px, py]);
        dir = nd;
        from = to;
        to = next;
      }
      if (ring.length >= 3) loops.push(ring);
    }
  }
  return loops;
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function dp(pts: Pt[], lo: number, hi: number, tol: number, keep: boolean[]): void {
  const stack: Array<[number, number]> = [[lo, hi]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i], pts[a], pts[b]);
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tol && at > 0) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
}

/** Douglas-Peucker on a closed ring; anchors are the first point and the one farthest from it. */
export function simplifyRing(ring: Pt[], tol: number): Pt[] {
  if (ring.length <= 4) return ring;
  let far = 0;
  let best = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) [best, far] = [d, i];
  }
  const keep = new Array<boolean>(ring.length + 1).fill(false);
  keep[0] = keep[far] = keep[ring.length] = true;
  const closed = [...ring, ring[0]];
  dp(closed, 0, far, tol, keep);
  dp(closed, far, ring.length, tol, keep);
  return ring.filter((_, i) => keep[i]);
}

const num = (n: number) => String(Math.round(n * 10) / 10);

/** "M x y L x y ... Z" for each ring, coordinates rounded to 0.1 px. */
export function ringsToPath(rings: Pt[][]): string {
  return rings
    .filter((r) => r.length >= 3)
    .map((r) => `M${r.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}Z`)
    .join("");
}

/** Rounded rectangle around a box, as SVG path data. */
export function roundedRectPath(b: Box, radius = 6): string {
  const [x1, y1, x2, y2] = b;
  const r = Math.max(0, Math.min(radius, (x2 - x1) / 3, (y2 - y1) / 3));
  return (
    `M${num(x1 + r)} ${num(y1)}H${num(x2 - r)}Q${num(x2)} ${num(y1)} ${num(x2)} ${num(y1 + r)}` +
    `V${num(y2 - r)}Q${num(x2)} ${num(y2)} ${num(x2 - r)} ${num(y2)}H${num(x1 + r)}` +
    `Q${num(x1)} ${num(y2)} ${num(x1)} ${num(y2 - r)}V${num(y1 + r)}Q${num(x1)} ${num(y1)} ${num(x1 + r)} ${num(y1)}Z`
  );
}

/** Running max (grow=true) or min (grow=false) with a (2r+1) window along one axis, via window sums. */
function windowOp(src: Uint8Array, w: number, h: number, r: number, horizontal: boolean, grow: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  const [lines, len] = horizontal ? [h, w] : [w, h];
  const at = (line: number, i: number) => (horizontal ? line * w + i : i * w + line);
  const pre = new Int32Array(len + 1);
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < len; i++) pre[i + 1] = pre[i] + src[at(line, i)];
    for (let i = 0; i < len; i++) {
      const lo = Math.max(0, i - r);
      const hi = Math.min(len, i + r + 1);
      const sum = pre[hi] - pre[lo];
      // Out-of-range neighbours count as background, so erosion near an edge needs a full window.
      out[at(line, i)] = grow ? (sum > 0 ? 1 : 0) : sum === 2 * r + 1 ? 1 : 0;
    }
  }
  return out;
}

/**
 * Morphological closing with a (2rx+1) x (2ry+1) rectangle: bridges gaps between glyphs and words so a text
 * line becomes one solid shape. Works on a padded copy so growth at the border is not clipped before the erosion.
 */
export function closeRaster(raster: ArrayLike<number>, w: number, h: number, rx: number, ry: number): Uint8Array {
  if (rx <= 0 && ry <= 0) return Uint8Array.from({ length: w * h }, (_, i) => (raster[i] ? 1 : 0));
  const pw = w + 2 * rx;
  const ph = h + 2 * ry;
  let p: Uint8Array = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (raster[y * w + x]) p[(y + ry) * pw + x + rx] = 1;
  if (rx > 0) p = windowOp(p, pw, ph, rx, true, true);
  if (ry > 0) p = windowOp(p, pw, ph, ry, false, true);
  if (rx > 0) p = windowOp(p, pw, ph, rx, true, false);
  if (ry > 0) p = windowOp(p, pw, ph, ry, false, false);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = p[(y + ry) * pw + x + rx];
  return out;
}

export interface MaskPathOpts {
  /** Closing radii in mask pixels; default scales with the mask height (text lines). 0 disables. */
  closeX?: number;
  closeY?: number;
  /** Douglas-Peucker tolerance in source pixels. */
  tolerance?: number;
  /** Largest allowed path string. */
  maxBytes?: number;
  /** Loops smaller than this fraction of the biggest loop are noise and dropped. */
  minLoopShare?: number;
}

export interface MaskPath {
  path: string;
  rings: Pt[][];
  /** Share of raster pixels that are foreground. */
  fill: number;
}

/**
 * Raster (mask resolution) covering `bounds` (source pixels, half-open) to a path in source pixels. The raster
 * is stretched to the bounds, so a mask smaller or larger than its box still lands on the right pixels.
 * Returns null for an empty mask.
 */
export function maskToPath(raster: ArrayLike<number>, mw: number, mh: number, bounds: Box, opts: MaskPathOpts = {}): MaskPath | null {
  if (mw < 1 || mh < 1 || raster.length < mw * mh) return null;
  let ones = 0;
  for (let i = 0; i < mw * mh; i++) if (raster[i]) ones++;
  if (ones === 0) return null;
  const rx = opts.closeX ?? Math.min(10, Math.max(1, Math.round(mh * 0.3)));
  const ry = opts.closeY ?? Math.min(2, Math.max(0, Math.round(mh * 0.08)));
  const solid = closeRaster(raster, mw, mh, rx, ry);
  const outer = traceLoops(solid, mw, mh).filter((r) => ringArea(r) > 0);
  if (!outer.length) return null;
  const biggest = Math.max(...outer.map(ringArea));
  const kept = outer.filter((r) => ringArea(r) >= Math.max(2, biggest * (opts.minLoopShare ?? 0.02)));
  const [x1, y1, x2, y2] = bounds;
  const sx = (x2 - x1) / mw;
  const sy = (y2 - y1) / mh;
  const scaled = kept.map((r): Pt[] => r.map(([x, y]) => [x1 + x * sx, y1 + y * sy]));
  const maxBytes = opts.maxBytes ?? 4000;
  let tol = opts.tolerance ?? 1.5;
  for (let i = 0; ; i++) {
    const rings = scaled.map((r) => simplifyRing(r, tol)).filter((r) => r.length >= 3);
    const path = ringsToPath(rings);
    if (path && (path.length <= maxBytes || i >= 8)) return path.length <= maxBytes ? { path, rings, fill: ones / (mw * mh) } : null;
    if (!path) return null;
    tol *= 1.6;
  }
}

/** Intersection over union of two boxes. */
export function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union > 0 ? inter / union : 0;
}
