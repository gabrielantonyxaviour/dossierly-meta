import { withCase } from "@/lib/case/route";
import { errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { getEnv } from "@/lib/server/env";
import { latestReview, runReview, StrategistError } from "@/lib/strategist";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const noStore = { "cache-control": "no-store" };
const fail = (e: StrategistError) => Response.json({ error: e.message, code: e.code }, { status: e.status, headers: noStore });

/** The latest stored case review, or `{ review: null }`. Never calls the model. */
export const GET = (req: Request) => withCase(req, async (c) => ({ review: await latestReview("", c) }));

/** Runs a review now (idempotent per case revision). `changed: true` means the case store was written: refresh the UI. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { userId } = await requireUser(req);
    const out = await runReview(getEnv(), userId);
    return Response.json(out, { headers: noStore });
  } catch (e) {
    if (e instanceof StrategistError) return fail(e);
    return errorResponse(e);
  }
}
