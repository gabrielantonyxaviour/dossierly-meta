import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { listLedger } from "@/lib/server/ledger";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Current user's ledger only, newest first. */
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100);
    const { entries, root, verified } = await listLedger(getEnv(), userId, Number.isFinite(limit) ? limit : 100);
    return Response.json({ entries, root, verified }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
