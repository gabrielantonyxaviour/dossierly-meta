import { describe, expect, it } from "vitest";
import { ASPECT, mergeHead, planCrop, PHOTO_SPEC, type Box } from "@/lib/look/photo-crop";

const headAt = (cx: number, top: number, h: number, aspect = 0.75): Box => [cx - (h * aspect) / 2, top, cx + (h * aspect) / 2, top + h];

describe("planCrop", () => {
  it("frames a centred portrait at 75% with the crown ~8% below the top", () => {
    const p = planCrop({ image: { w: 2000, h: 3000 }, head: headAt(1000, 800, 900) });
    expect(p.fits).toBe(true);
    expect(p.headRatio).toBeGreaterThanOrEqual(0.7);
    expect(p.headRatio).toBeLessThanOrEqual(0.8);
    expect(p.headRatio).toBeCloseTo(0.75, 2);
    expect(p.crop.w / p.crop.h).toBeCloseTo(ASPECT, 2);
    expect(p.crop.x + p.crop.w / 2).toBeCloseTo(1000, -1);
    expect((800 - p.crop.y) / p.crop.h).toBeCloseTo(0.08, 2);
    expect(p.upscaled).toBe(false);
    expect(p.notes).toEqual([]);
  });

  it("centres an off-centre head horizontally while it fits the image", () => {
    const p = planCrop({ image: { w: 2000, h: 3000 }, head: headAt(700, 700, 800) });
    expect(p.fits).toBe(true);
    const cx = p.crop.x + p.crop.w / 2;
    expect(Math.abs(cx - 700)).toBeLessThan(2);
  });

  it("clamps horizontally and flags a head too near the side", () => {
    const p = planCrop({ image: { w: 1200, h: 1800 }, head: headAt(150, 400, 700) });
    expect(p.crop.x).toBe(0);
    expect(p.fits).toBe(false);
    expect(p.notes.join(" ")).toMatch(/middle of the frame/);
  });

  it("says step back when there is no room above the head", () => {
    const p = planCrop({ image: { w: 1500, h: 2000 }, head: headAt(750, 10, 1000) });
    expect(p.fits).toBe(false);
    expect(p.crop.y).toBe(0);
    expect(p.notes).toContain("Step back a little — there isn't enough space above your head.");
  });

  it("still fits when the crown is only slightly closer than ideal", () => {
    const p = planCrop({ image: { w: 1500, h: 2000 }, head: headAt(750, 50, 1000) });
    expect(p.fits).toBe(true);
    expect(p.crop.y).toBe(0);
  });

  it("flags low resolution crops as upscaled", () => {
    const p = planCrop({ image: { w: 500, h: 700 }, head: headAt(250, 90, 400) });
    expect(p.crop.h).toBeLessThan(PHOTO_SPEC.height);
    expect(p.upscaled).toBe(true);
    expect(p.notes.join(" ")).toMatch(/resolution/);
  });

  it("does not flag a crop that is already at least 883 px tall", () => {
    const p = planCrop({ image: { w: 2400, h: 3200 }, head: headAt(1200, 700, 1000) });
    expect(p.crop.h).toBeGreaterThanOrEqual(883);
    expect(p.upscaled).toBe(false);
  });

  it("tightens to 80% when the frame is a little too small for 75%", () => {
    // 75% would need a crop 1.05x the image height; 80% fits.
    const p = planCrop({ image: { w: 1200, h: 1000 }, head: headAt(600, 80, 790) });
    expect(p.fits).toBe(true);
    expect(p.headRatio).toBeLessThanOrEqual(0.8);
    expect(p.crop.h).toBeLessThanOrEqual(1000);
  });

  it("asks the user to step back when the face fills the whole photo", () => {
    const p = planCrop({ image: { w: 800, h: 1000 }, head: [100, 0, 700, 1000] });
    expect(p.fits).toBe(false);
    expect(p.notes.join(" ")).toMatch(/Step back/);
    expect(p.crop.y + p.crop.h).toBeLessThanOrEqual(1000);
  });

  it("estimates the chin when the box is much wider than tall (shoulders included)", () => {
    const p = planCrop({ image: { w: 2000, h: 3000 }, head: [400, 600, 1600, 1500] });
    expect(p.notes.join(" ")).toMatch(/shoulders/);
    expect(p.headRatio).toBeCloseTo(0.75, 1);
  });

  it("never returns a crop outside the image", () => {
    for (const head of [headAt(100, 5, 600), headAt(1900, 2500, 450), headAt(1000, 1500, 200)] as Box[]) {
      const p = planCrop({ image: { w: 2000, h: 3000 }, head });
      expect(p.crop.x).toBeGreaterThanOrEqual(0);
      expect(p.crop.y).toBeGreaterThanOrEqual(0);
      expect(p.crop.x + p.crop.w).toBeLessThanOrEqual(2000);
      expect(p.crop.y + p.crop.h).toBeLessThanOrEqual(3000);
    }
  });

  it("rejects an empty head box", () => {
    const p = planCrop({ image: { w: 800, h: 1000 }, head: [10, 10, 10, 10] });
    expect(p.fits).toBe(false);
    expect(p.crop.w).toBe(0);
  });
});

describe("mergeHead", () => {
  it("takes the crown from the head box and the chin from the face box", () => {
    expect(mergeHead([256, 112, 715, 631], [319, 268, 656, 741])).toEqual([256, 112, 715, 741]);
  });
  it("falls back to whichever box exists", () => {
    expect(mergeHead(null, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(mergeHead([1, 2, 3, 4], null)).toEqual([1, 2, 3, 4]);
    expect(mergeHead(null, null)).toBeNull();
  });
});
