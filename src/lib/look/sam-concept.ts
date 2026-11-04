/*
 * SAM 3.1 concept prompt: a short noun phrase ("head") plus an image in, every matching object out with its
 * box and mask contour. Plain fetch to the Responses endpoint; @meta-sam/parser decodes the special-token text.
 */
import {
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from "@meta-sam/parser";
import { resolveRole, type EnvLike } from "../model/roles";
import { ModelError } from "../model/types";

export type SamBoxPx = [number, number, number, number];

export interface SamObject {
  id: string;
  /** x1, y1, x2, y2 in source pixels (x2/y2 exclusive). */
  box: SamBoxPx;
  confidence?: number;
  /** SVG path of the mask contour, translated into source-pixel coordinates; null when the mask is unusable. */
  path: string | null;
}

export interface SamConceptArgs {
  /** data: URL of the image. */
  image: string;
  size: { w: number; h: number };
  /** A short noun phrase, never a command. */
  phrase: string;
  timeoutMs?: number;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Shifts every absolute coordinate pair in an M/L/Z path by (dx, dy). */
export function translatePath(path: string, dx: number, dy: number): string {
  if (!path || (dx === 0 && dy === 0)) return path;
  return path.replace(/([ML])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g, (_m, cmd: string, x: string, y: string) => `${cmd}${Number(x) + dx} ${Number(y) + dy}`);
}

async function* sseEvents(res: Response): AsyncGenerator<ResponsesEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const parse = (line: string): ResponsesEvent | null => {
    if (!line.startsWith("data:")) return null;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return null;
    try {
      return JSON.parse(data) as ResponsesEvent;
    } catch {
      return null;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const ev = parse(buf.slice(0, nl).trim());
      buf = buf.slice(nl + 1);
      if (ev) yield ev;
    }
  }
  const tail = parse(buf.trim());
  if (tail) yield tail;
}

export async function samConcept(env: EnvLike, args: SamConceptArgs): Promise<{ objects: SamObject[]; ms: number }> {
  const cfg = resolveRole("sam", env);
  if (!cfg.apiKey) throw new ModelError("The model service is not configured", "no_key", 503);
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), args.timeoutMs ?? 60_000);
  try {
    const res = await (args.fetch ?? fetch)(`${cfg.baseUrl}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      signal: ctl.signal,
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        metadata: { include_confidence: "true" },
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: args.phrase }, { type: "input_image", image_url: args.image }] }],
      }),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new ModelError("The image service returned an error", res.status === 429 ? "rate_limited" : "model_error", res.status === 429 ? 429 : 502);
    }
    const result = await parseImageStream(sseEvents(res)).finalResult;
    const masks = new Map(recordsOfKind(result.records, "mask").map((m) => [m.objectId, m]));
    const objects: SamObject[] = recordsOfKind(result.records, "box").map((b) => {
      const m = masks.get(b.objectId);
      let path: string | null = null;
      if (m) {
        try {
          // The mask raster sits at (bounds.left, bounds.top) inside the frame.
          path = translatePath(decodeMaskToSVGPath(m.mask), m.bounds.left, m.bounds.top) || null;
        } catch {
          path = null;
        }
      }
      return { id: b.objectId, box: [b.left, b.top, b.right, b.bottom] as SamBoxPx, ...(b.confidence !== undefined ? { confidence: b.confidence } : {}), path };
    });
    return { objects, ms: Date.now() - t0 };
  } catch (err) {
    if (err instanceof ModelError) throw err;
    throw new ModelError("Could not reach the image service", "provider_unavailable");
  } finally {
    clearTimeout(timer);
  }
}
