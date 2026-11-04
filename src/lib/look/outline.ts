/*
 * SAM 3.1 outlines for the Look items: one call with every Spark box as a box prompt (id = item index + 1),
 * each returned mask traced to an outer contour as SVG path data in source pixels. Anything SAM cannot give us
 * (error, missing, empty, tiny or misplaced mask) degrades to a rounded rectangle around the Spark box.
 */
import { decodeMaskToRaster, parseImageStream, recordsOfKind, type ResponsesEvent } from "@meta-sam/parser";
import { SAM_USD_PER_IMAGE } from "../config";
import { meterFixed } from "../model/meter";
import { samSegment, type FetchLike } from "../model/meta";
import type { Env } from "../server/env";
import { recordLedger } from "../server/ledger";
import { recordRun } from "../server/runs";
import { textQuad, roundedQuadPath } from "./quad";
import { iou, maskToPath, roundedRectPath } from "./trace";
import type { Box, LookItem, LookOutline } from "./types";

// Sloped text fills little of its axis-aligned box, so the fill floor is low; the width check catches half-traced lines.
const MIN_FILL = 0.08; // mask pixels / Spark box area below this counts as a failed mask
const MIN_SPAN = 0.45; // mask width / Spark box width below this: only a fragment of the line was traced
const MIN_IOU = 0.35; // SAM box vs Spark box: below this SAM latched onto something else

export interface SamRecord {
  id: string;
  bounds: Box;
  width: number;
  height: number;
  raster: Uint8Array;
}

/** Parses SAM output text (the `raw` of samSegment) into decoded mask rasters keyed by prompt id. */
export async function parseSamMasks(raw: string): Promise<Map<string, SamRecord>> {
  async function* events(): AsyncGenerator<ResponsesEvent> {
    const lane = { item_id: "sam", output_index: 0, content_index: 0 };
    yield { type: "response.output_text.delta", delta: raw, ...lane };
    yield { type: "response.output_text.done", text: raw, ...lane };
    yield { type: "response.completed" };
  }
  const res = await parseImageStream(events()).finalResult;
  const out = new Map<string, SamRecord>();
  for (const r of recordsOfKind(res.records, "mask")) {
    try {
      const raster = decodeMaskToRaster(r.mask);
      out.set(r.objectId, {
        id: r.objectId,
        bounds: [r.bounds.left, r.bounds.top, r.bounds.right, r.bounds.bottom],
        width: r.mask.width,
        height: r.mask.height,
        raster,
      });
    } catch {
      /* an undecodable mask falls back to the Spark box */
    }
  }
  return out;
}

const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const clampBox = (b: Box, w: number, h: number): Box => [
  Math.max(0, Math.min(w - 1, Math.round(b[0]))), Math.max(0, Math.min(h - 1, Math.round(b[1]))),
  Math.max(1, Math.min(w, Math.round(b[2]))), Math.max(1, Math.min(h, Math.round(b[3]))),
];

/** One outline from one SAM record (or none). Pure: tested with synthetic rasters. */
export function outlineFor(item: Pick<LookItem, "id" | "box">, rec: SamRecord | undefined, size: { w: number; h: number }): LookOutline {
  const spark = clampBox(item.box, size.w, size.h);
  const fallback: LookOutline = { id: item.id, box: spark, path: roundedRectPath(spark) };
  if (!rec) return fallback;
  const bounds = clampBox(rec.bounds, size.w, size.h);
  if (iou(bounds, spark) < MIN_IOU) return fallback;
  const traced = maskToPath(rec.raster, rec.width, rec.height, rec.bounds);
  if (!traced) return fallback;
  if (traced.fill * area(bounds) < MIN_FILL * area(spark)) return fallback;
  // Clean rotated band that follows SAM's tilt; stretched to Spark's line extent when SAM traced only part of it.
  const pad = Math.max(3, Math.round(Math.max(size.w, size.h) * 0.004));
  const quad = textQuad(traced.rings.flat(), spark, pad);
  if (quad && Math.abs(quad.angle) < 0.45) {
    const h = Math.min(Math.hypot(quad.corners[3][0] - quad.corners[0][0], quad.corners[3][1] - quad.corners[0][1]), 40);
    return { id: item.id, box: clampBox(quad.box, size.w, size.h), path: roundedQuadPath(quad.corners, Math.max(4, h / 3)) };
  }
  const xs = traced.rings.flat().map((p) => p[0]);
  if ((Math.max(...xs) - Math.min(...xs)) < MIN_SPAN * (spark[2] - spark[0])) return fallback;
  return { id: item.id, box: bounds, path: traced.path };
}

export interface OutlineOutput {
  outlines: LookOutline[];
  ms: number;
  /** "sam" when SAM masks were used for at least one item, "fallback" when every item used its Spark box. */
  source: "sam" | "fallback";
}

/** Outlines for every item, in item order. Never throws for SAM failures: items fall back to their Spark boxes. */
export async function outlineItems(
  env: Env,
  userId: string | null,
  image: string,
  size: { w: number; h: number },
  items: Array<Pick<LookItem, "id" | "box">>,
  deps: { fetch?: FetchLike } = {},
): Promise<OutlineOutput> {
  const t0 = Date.now();
  if (!items.length) return { outlines: [], ms: 0, source: "fallback" };
  let masks = new Map<string, SamRecord>();
  try {
    const boxes = items.map((i) => clampBox(i.box, size.w, size.h));
    const out = await meterFixed(env, SAM_USD_PER_IMAGE, async () => ({
      value: await samSegment({ image, boxes, size }, { env, fetch: deps.fetch, timeoutMs: 30_000 }),
      actualUsd: SAM_USD_PER_IMAGE,
    }));
    masks = await parseSamMasks(out.raw);
    try {
      await recordRun(env, userId, { model: out.model, ms: Date.now() - t0, tokensIn: 0, tokensOut: 0, cachedTokens: 0, costUsd: out.costUsd, ranOn: "cloud" }, "read");
      await recordLedger(env, { userId, kind: "model", what: out.model, action: "allowed", bytes: image.length, detail: { task: "read", role: "sam", boxes: boxes.length } });
    } catch {
      /* bookkeeping must never fail a look */
    }
  } catch {
    masks = new Map();
  }
  const outlines = items.map((it, i) => outlineFor(it, masks.get(String(i + 1)), size));
  const source = items.some((it, i) => masks.has(String(i + 1))) ? "sam" : "fallback";
  return { outlines, ms: Date.now() - t0, source };
}
