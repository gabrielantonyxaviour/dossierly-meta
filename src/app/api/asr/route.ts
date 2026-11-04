import { AsrStartSchema, ASR_MAX_AUDIO, transcribeAudio } from "@/lib/server/asr";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One recording in, its transcript (and optional translation) out. The audio is never stored. */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUserState(req);
    const env = getEnv();
    const rl = await rateLimit(env, userId, "asr", 30, 60);
    if (!rl.ok) return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    if (Number(req.headers.get("content-length")) > ASR_MAX_AUDIO + 1000) return jsonError(413, "That recording is too long. Try a shorter clip.", "too_large");
    const body = await readJson(req, AsrStartSchema);
    return Response.json(await transcribeAudio(env, userId, body), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
