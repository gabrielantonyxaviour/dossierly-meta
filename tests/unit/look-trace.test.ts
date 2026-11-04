import { describe, expect, it } from "vitest";
import { closeRaster, iou, maskToPath, ringArea, roundedRectPath, simplifyRing, traceLoops, type Pt } from "@/lib/look/trace";

/** Raster from ascii rows: '#' is foreground. */
const grid = (rows: string[]) => ({ w: rows[0].length, h: rows.length, data: Uint8Array.from(rows.join("").split("").map((c) => (c === "#" ? 1 : 0))) });
const nums = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("traceLoops", () => {
  it("traces a filled rectangle as one outer loop with its exact area", () => {
    const { w, h, data } = grid(["......", ".####.", ".####.", "......"]);
    const loops = traceLoops(data, w, h);
    expect(loops).toHaveLength(1);
    expect(ringArea(loops[0])).toBe(8);
    expect(loops[0]).toHaveLength(4);
  });

  it("returns a hole as a loop of negative area", () => {
    const { w, h, data } = grid(["#####", "#...#", "#...#", "#####"]);
    const areas = traceLoops(data, w, h).map(ringArea).sort((a, b) => a - b);
    expect(areas).toEqual([-6, 20]);
  });

  it("keeps separate blobs separate and merges diagonal touches", () => {
    const apart = grid(["##..##", "##..##"]);
    expect(traceLoops(apart.data, apart.w, apart.h)).toHaveLength(2);
    const diag = grid(["#..", ".#."]);
    const loops = traceLoops(diag.data, diag.w, diag.h);
    expect(loops.filter((l) => ringArea(l) > 0)).toHaveLength(1);
  });

  it("handles an empty raster", () => {
    expect(traceLoops(new Uint8Array(12), 4, 3)).toEqual([]);
  });
});

describe("closeRaster", () => {
  it("bridges a one-pixel gap and keeps the size", () => {
    const { w, h, data } = grid(["##.##", "##.##"]);
    const closed = closeRaster(data, w, h, 1, 0);
    expect(Array.from(closed)).toEqual(Array(10).fill(1));
  });

  it("does not grow the shape beyond a gap wider than the window", () => {
    const { w, h, data } = grid(["#...#"]);
    expect(Array.from(closeRaster(data, w, h, 1, 0))).toEqual([1, 0, 0, 0, 1]);
  });
});

describe("simplifyRing", () => {
  it("drops collinear points and keeps corners", () => {
    const ring: Pt[] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5]];
    expect(simplifyRing(ring, 0.5).sort()).toEqual([[0, 0], [0, 10], [10, 0], [10, 10]].sort());
  });

  it("removes staircase noise under the tolerance but not real features", () => {
    const stair: Pt[] = [[0, 0], [20, 0], [20, 1], [21, 1], [21, 2], [40, 2], [40, 30], [0, 30]];
    const out = simplifyRing(stair, 1.5);
    expect(out.length).toBeLessThan(stair.length);
    expect(out.some(([x, y]) => x === 40 && y === 30)).toBe(true);
  });
});

describe("maskToPath", () => {
  it("scales a raster onto its bounds in source pixels", () => {
    // 10x4 raster fully on, stretched over (100,200)-(300,240): 20x horizontally, 10x vertically.
    const data = new Uint8Array(40).fill(1);
    const r = maskToPath(data, 10, 4, [100, 200, 300, 240], { closeX: 0, closeY: 0 })!;
    const xs = r.rings[0].map((p) => p[0]);
    const ys = r.rings[0].map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(100);
    expect(Math.max(...xs)).toBeCloseTo(300);
    expect(Math.min(...ys)).toBeCloseTo(200);
    expect(Math.max(...ys)).toBeCloseTo(240);
    expect(r.fill).toBe(1);
    expect(r.path.startsWith("M")).toBe(true);
    expect(r.path.endsWith("Z")).toBe(true);
  });

  it("returns null for an empty mask and for a raster shorter than declared", () => {
    expect(maskToPath(new Uint8Array(20), 5, 4, [0, 0, 50, 40])).toBeNull();
    expect(maskToPath(new Uint8Array(3).fill(1), 5, 4, [0, 0, 50, 40])).toBeNull();
  });

  it("merges glyph-sized fragments of a text line into one contour and drops specks", () => {
    const rows = ["#.#.#.#.#.#.....", "#.#.#.#.#.#.....", "................", ".............#.."];
    const { w, h, data } = grid(rows);
    const r = maskToPath(data, w, h, [0, 0, w, h], { closeX: 1, closeY: 0 })!;
    expect(r.rings).toHaveLength(1);
  });

  it("keeps a noisy mask under the byte cap by raising the tolerance", () => {
    const w = 400;
    const h = 30;
    const data = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) for (let y = 5 + (x % 7 < 3 ? 0 : 2); y < 25 + (x % 5 < 2 ? 0 : 3); y++) data[y * w + x] = 1;
    const r = maskToPath(data, w, h, [0, 0, w, h], { closeX: 0, closeY: 0, tolerance: 0.1, maxBytes: 600 })!;
    expect(r.path.length).toBeLessThanOrEqual(600);
  });
});

describe("shapes", () => {
  it("roundedRectPath stays inside its box and closes", () => {
    const p = roundedRectPath([10, 20, 110, 50], 6);
    const n = nums(p);
    expect(Math.min(...n.filter((_, i) => i % 2 === 0))).toBeGreaterThanOrEqual(10);
    expect(Math.max(...n.filter((_, i) => i % 2 === 0))).toBeLessThanOrEqual(110);
    expect(p.endsWith("Z")).toBe(true);
  });

  it("iou of identical, disjoint and half-overlapping boxes", () => {
    expect(iou([0, 0, 10, 10], [0, 0, 10, 10])).toBe(1);
    expect(iou([0, 0, 10, 10], [20, 20, 30, 30])).toBe(0);
    expect(iou([0, 0, 10, 10], [5, 0, 15, 10])).toBeCloseTo(1 / 3);
  });
});
