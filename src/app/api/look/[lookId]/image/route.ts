import { loadLook, loadLookImage } from "@/lib/look/store";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Streams a stored look image back to its owner (past looks). */
export async function GET(req: Request, ctx: { params: Promise<{ lookId: string }> }) {
  try {
    const { userId } = await requireUser(req);
    const { lookId } = await ctx.params;
    const env = getEnv();
    const rec = await loadLook(env, userId, lookId);
    const bytes = rec ? await loadLookImage(env, rec) : null;
    if (!rec || !bytes) throw new ApiError(404, "Look not found", "not_found");
    return new Response(bytes as unknown as BodyInit, { headers: { "content-type": rec.mime, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
