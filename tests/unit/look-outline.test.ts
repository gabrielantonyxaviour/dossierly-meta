import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { outlineFor, outlineItems, parseSamMasks, type SamRecord } from "@/lib/look/outline";
import { freshLocalEnv } from "@/lib/server/local";

const size = { w: 892, h: 900 };
const item = { id: "i1", box: [100, 100, 300, 130] as [number, number, number, number] };
const rec = (over: Partial<SamRecord> = {}, fill: (x: number, y: number) => boolean = () => true): SamRecord => {
  const [w, h] = [200, 30];
  const raster = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raster[y * w + x] = fill(x, y) ? 1 : 0;
  return { id: "1", bounds: [100, 100, 300, 130], width: w, height: h, raster, ...over };
};
/** The Spark-box fallback uses H/V segments; SAM-derived outlines (rotated quads or contours) never do. */
const isRect = (p: string | null) => !!p && /[HV]/.test(p);

describe("outlineFor", () => {
  it("uses the traced mask contour and the SAM box when the mask fits the Spark box", () => {
    const o = outlineFor(item, rec({ bounds: [102, 101, 298, 129], width: 196, height: 28, raster: new Uint8Array(196 * 28).fill(1) }), size);
    // A rotated quad around the mask, padded: it contains SAM's box and stays close to it.
    expect(o.box[0]).toBeLessThanOrEqual(102); expect(o.box[2]).toBeGreaterThanOrEqual(298);
    expect(o.box[1]).toBeGreaterThan(90); expect(o.box[3]).toBeLessThan(140);
    expect(o.path).not.toBeNull();
    expect(isRect(o.path)).toBe(false);
    expect(o.path!.length).toBeLessThan(4000);
  });

  it("falls back to a rounded rectangle on the Spark box when SAM returned nothing for the item", () => {
    const o = outlineFor(item, undefined, size);
    expect(o.box).toEqual(item.box);
    expect(isRect(o.path)).toBe(true);
  });

  it("falls back when the mask is empty or tiny", () => {
    expect(isRect(outlineFor(item, rec({}, () => false), size).path)).toBe(true);
    expect(isRect(outlineFor(item, rec({}, (x, y) => x < 10 && y < 10), size).path)).toBe(true);
  });

  it("falls back when SAM latched onto a different place than the Spark box", () => {
    const far = rec({ bounds: [600, 500, 800, 530] });
    const o = outlineFor(item, far, size);
    expect(o.box).toEqual(item.box);
    expect(isRect(o.path)).toBe(true);
  });

  it("clamps a Spark box that sticks out of the image", () => {
    const o = outlineFor({ id: "i2", box: [-20, 880, 950, 960] }, undefined, size);
    expect(o.box).toEqual([0, 880, 892, 900]);
  });
});

describe("parseSamMasks", () => {
  it("decodes a real SAM 3.1 box+mask line into a raster on its bounds", async () => {
    const raw = readFileSync(new URL("./fixtures-look-sam.txt", import.meta.url), "utf8");
    const masks = await parseSamMasks(raw);
    const m = masks.get("3")!;
    expect(m.bounds[0]).toBe(635);
    expect(m.width).toBe(201);
    expect(m.height).toBe(16);
    expect(m.raster.length).toBe(201 * 16);
    expect(m.raster.some((v) => v === 1)).toBe(true);
    const o = outlineFor({ id: "i3", box: [635, 52, 835, 70] }, m, size);
    expect(isRect(o.path)).toBe(false);
  });

  it("returns nothing for text without masks", async () => {
    expect((await parseSamMasks("<0f>")).size).toBe(0);
  });
});

describe("outlineItems", () => {
  it("degrades to Spark-box outlines when the SAM service fails, without throwing", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const failing = async () => new Response("boom", { status: 500 });
    const out = await outlineItems(env, "u1", "data:image/png;base64,AAAA", size, [item], { fetch: failing });
    expect(out.source).toBe("fallback");
    expect(out.outlines).toHaveLength(1);
    expect(isRect(out.outlines[0].path)).toBe(true);
  });

  it("returns nothing for no items without calling SAM", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const never = async () => {
      throw new Error("should not be called");
    };
    expect((await outlineItems(env, "u1", "data:image/png;base64,AAAA", size, [], { fetch: never })).outlines).toEqual([]);
  });

  it("meters the call and records one run on success", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const raw = readFileSync(new URL("./fixtures-look-sam.txt", import.meta.url), "utf8").replace("<0f>3<", "<0f>1<");
    const sse = `data: ${JSON.stringify({ type: "response.output_text.delta", delta: raw })}\n\ndata: [DONE]\n\n`;
    const ok = async () => new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
    const out = await outlineItems(env, "u9", "data:image/png;base64,AAAA", size, [{ id: "i1", box: [635, 52, 835, 70] }], { fetch: ok });
    expect(out.source).toBe("sam");
    expect(isRect(out.outlines[0].path)).toBe(false);
    const runs = await env.DB.prepare("SELECT feature, model, cost_micro FROM runs WHERE user_id = ?").bind("u9").all<{ feature: string; model: string; cost_micro: number }>();
    expect(runs.results).toEqual([{ feature: "read", model: "sam-3.1", cost_micro: 2500 }]);
  });
});
