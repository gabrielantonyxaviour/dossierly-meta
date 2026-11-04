import { caseClient } from "@/lib/case/client";
import { caseContext } from "@/lib/case/context";
import { outlineItems } from "@/lib/look/outline";
import { readLook } from "@/lib/look/read";
import { decodeImage, newLookId, saveLook, updateLook } from "@/lib/look/store";
import { lookRequestSchema, type LookEvent, type LookRead } from "@/lib/look/types";
import { ModelError } from "@/lib/model";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY = 8_000_000;
const RETRYABLE = new Set(["rate_limited", "provider_unavailable", "model_error", "model_unavailable", "invalid_output"]);

/** One look: Spark reads and grounds the image, SAM outlines the items, NDJSON events stream as each step finishes. */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const env = getEnv();
    const rl = await rateLimit(env, userId, "look", 30, 3600);
    if (!rl.ok) return jsonError(429, "Too many looks. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    if (Number(req.headers.get("content-length")) > MAX_BODY) throw new ApiError(413, "That image is too large", "too_large");
    const body = await readJson(req, lookRequestSchema);
    const { bytes, mime } = decodeImage(body.image);
    const size = { w: body.width, h: body.height };

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let open = true;
        const send = (e: LookEvent) => {
          if (open) controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        };
        try {
          send({ type: "stage", stage: "reading" });
          const t0 = Date.now();
          const snapshot = await caseClient(userId).snapshot();
          const base = await readLook(env, userId, body, caseContext(snapshot), { fullName: snapshot.profile.fullName });
          const read: LookRead = { lookId: newLookId(), ...base };
          const record = await saveLook(env, { userId, req: body, read, bytes, mime });
          send({ type: "read", read, ms: Date.now() - t0 });
          send({ type: "stage", stage: "outlining" });
          const out = await outlineItems(env, userId, body.image, size, read.items);
          for (const outline of out.outlines) send({ type: "outline", outline });
          send({ type: "outlines_done", ms: out.ms, count: out.outlines.length });
          await updateLook(env, { ...record, outlines: out.outlines }).catch(() => undefined);
          send({ type: "stage", stage: "done" });
        } catch (e) {
          const code = e instanceof ModelError || e instanceof ApiError ? e.code : undefined;
          const error = e instanceof ModelError || e instanceof ApiError ? e.message : "Something went wrong on our side";
          send({ type: "error", error, code: code ?? "internal", retryable: code ? RETRYABLE.has(code) : false });
        } finally {
          if (open) {
            open = false;
            controller.close();
          }
        }
      },
      cancel() {
        /* the client left; the in-flight model call settles its own spend */
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" } });
  } catch (e) {
    return errorResponse(e);
  }
}
