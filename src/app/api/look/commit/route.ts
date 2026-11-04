import { CaseClientError } from "@/lib/case/client";
import { commitLook } from "@/lib/look/commit";
import { commitRequestSchema } from "@/lib/look/types";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** The user confirmed what we read: write facts, document, deadline, tasks and an event into the case. Idempotent per look. */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const body = await readJson(req, commitRequestSchema);
    return Response.json(await commitLook(getEnv(), userId, body), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof CaseClientError) return jsonError(e.status, e.message, e.code);
    return errorResponse(e);
  }
}
