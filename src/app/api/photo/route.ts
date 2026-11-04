import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/server/session";
import { ModelError } from "@/lib/model/types";
import { photoRequestSchema, runPhotoCheck } from "./run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One photo in, head outline + crop plan + rule checks out. The image is never stored and never edited. */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const { accountId } = await requireUser(req);
    const rl = await rateLimit(env, accountId, "photo", 20, 60);
    if (!rl.ok) return jsonError(429, "Too many photo checks. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const body = await boundedJson(req, photoRequestSchema, 8_500_000);
    return Response.json(await runPhotoCheck({ env, userId: accountId }, body), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ModelError) return jsonError(e.status, e.message, e.code);
    return errorResponse(e);
  }
}
