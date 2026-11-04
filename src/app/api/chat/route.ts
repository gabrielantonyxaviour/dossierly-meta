import { caseClient, CaseClientError } from "@/lib/case/client";
import { ChatRequestSchema } from "@/lib/chat/schema";
import { buildMessages, buildSystemPrompt } from "@/lib/chat/prompt";
import { openChatStream } from "@/lib/chat/stream";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { ModelError } from "@/lib/model/types";
import { rateLimit } from "@/lib/server/ratelimit";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const { userId, accountId } = await requireUser(req);
    const rl = await rateLimit(env, accountId, "chat", 20, 60);
    if (!rl.ok) return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const body = await boundedJson(req, ChatRequestSchema, 64_000);
    const snapshot = await caseClient(userId).snapshot();
    const { system, sources } = buildSystemPrompt(snapshot, body.attachments);
    const stream = await openChatStream(env, buildMessages(system, body), sources, req.signal);
    return new Response(stream, {
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
    });
  } catch (e) {
    if (e instanceof ModelError) return jsonError(e.status, e.message, e.code);
    if (e instanceof CaseClientError) return jsonError(e.status, e.message, e.code);
    return errorResponse(e);
  }
}
