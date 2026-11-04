import { loadLook } from "@/lib/look/store";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** A past look for its owner: what was read and the traced outlines, so it can be drawn again without model calls. */
export async function GET(req: Request, ctx: { params: Promise<{ lookId: string }> }) {
  try {
    const { userId } = await requireUser(req);
    const { lookId } = await ctx.params;
    const rec = await loadLook(getEnv(), userId, lookId);
    if (!rec) throw new ApiError(404, "Look not found", "not_found");
    return Response.json(
      { lookId: rec.lookId, createdAt: rec.createdAt, size: rec.size, read: rec.read, outlines: rec.outlines ?? [], image: `/api/look/${rec.lookId}/image` },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
