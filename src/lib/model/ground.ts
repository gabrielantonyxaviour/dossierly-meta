import { resolveRole } from "./roles";
import { metaChat } from "./meta";
import type { MetaOpts } from "./net";
import type { ChatMessage, Usage } from "./types";
import { ModelError } from "./types";

export interface GroundBox { name: string; text: string; x1: number; y1: number; x2: number; y2: number }
const GROUND_SCHEMA = {
  type: "object",
  properties: {
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          object_name: { type: "string" }, text: { type: "string" },
          bbox: { type: "object", properties: { x_min: { type: "integer" }, y_min: { type: "integer" }, x_max: { type: "integer" }, y_max: { type: "integer" } }, required: ["x_min", "y_min", "x_max", "y_max"] },
        },
        required: ["object_name", "text", "bbox"],
      },
    },
  },
  required: ["objects"],
};
const GROUND_SYSTEM =
  "You are an object grounding expert. Return a bounding box for every requested item, in normalized 0-1000 coordinates relative to the image (0,0 top-left). Include the exact text inside each box. If you cannot find an item, omit it.";
const clamp1000 = (n: number) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));

/** Asks Spark to box `targets` on an image. Boxes come back in the 0-1000 grid and as pixels for `size`. */
export async function visionGround(
  args: { image: string; targets: string[]; size: { w: number; h: number } },
  o: MetaOpts = {},
): Promise<{ boxes: Array<GroundBox & { px: [number, number, number, number] }>; usage: Usage; model: string }> {
  const cfg = resolveRole("vision", o.env, o.origin);
  const messages: ChatMessage[] = [
    { role: "system", content: GROUND_SYSTEM },
    { role: "user", content: [{ type: "text", text: `Find: ${args.targets.join("; ")}` }, { type: "image_url", image_url: { url: args.image } }] },
  ];
  const out = await metaChat({ model: cfg.model, role: "vision", origin: o.origin, messages, maxTokens: 4000, reasoningEffort: "low", json: GROUND_SCHEMA }, o);
  let parsed: { objects?: Array<{ object_name?: string; text?: string; bbox?: Record<string, number> }> };
  try {
    parsed = JSON.parse(out.content);
  } catch {
    throw new ModelError("Model output was not valid JSON", "invalid_output", 502, out.usage);
  }
  const boxes = (parsed.objects ?? []).flatMap((x) => {
    const b = x.bbox;
    if (!b) return [];
    const [x1, y1, x2, y2] = [clamp1000(b.x_min), clamp1000(b.y_min), clamp1000(b.x_max), clamp1000(b.y_max)];
    const px: [number, number, number, number] = [
      Math.round((x1 / 1000) * args.size.w), Math.round((y1 / 1000) * args.size.h),
      Math.round((x2 / 1000) * args.size.w), Math.round((y2 / 1000) * args.size.h),
    ];
    return [{ name: x.object_name ?? "", text: x.text ?? "", x1, y1, x2, y2, px }];
  });
  return { boxes, usage: out.usage, model: cfg.model };
}

