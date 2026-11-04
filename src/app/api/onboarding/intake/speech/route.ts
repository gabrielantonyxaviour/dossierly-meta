import { z } from "zod";
import { speechStream } from "@/lib/onboarding/intake";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const Query = z.object({ id: z.string().uuid() });

/** Dossierly's spoken reply to the voice introduction, streamed as PCM16 16 kHz. One-time id from POST /api/onboarding/intake. */
export async function GET(req: Request): Promise<Response> {
  try {
    const { userId } = await requireUser(req);
    const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!q.success) return jsonError(400, "Invalid request", "invalid_request");
    const body = await speechStream(getEnv(), userId, q.data.id);
    if (!body) return jsonError(404, "That reply has expired", "not_found");
    return new Response(body, { headers: { "content-type": "audio/L16;rate=16000;channels=1", "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
