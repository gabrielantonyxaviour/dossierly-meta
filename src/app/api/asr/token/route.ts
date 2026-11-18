import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { mintScribeToken } from "@/lib/server/scribe";
import { requireUser } from "@/lib/server/session";
import { assertVoiceAllowed } from "@/lib/voice/server/meter";
import { ModelError } from "@/lib/model/types";

export const dynamic = "force-dynamic";

/** A single-use ElevenLabs realtime Scribe token (15 minutes) for a signed-in user. The API key never leaves the server. */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const env = getEnv();
    const rl = await rateLimit(env, userId, "asr-token", 20, 60);
    if (!rl.ok) return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    assertVoiceAllowed(env);
    const out = await mintScribeToken(env);
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ModelError) return jsonError(e.status, e.message, e.code);
    return errorResponse(e);
  }
}
