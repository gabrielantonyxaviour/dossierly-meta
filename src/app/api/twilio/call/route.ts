import { z } from "zod";
import { caseClient } from "@/lib/case/client";
import { caseContext } from "@/lib/case/context";
import { accountEmail, callsEnabledFor, placeCall } from "@/lib/voice/server/twilio";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { ApiError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({ reason: z.string().trim().min(3).max(1200).optional() }).strict();

/** Whether this account can receive Dossierly's phone calls (demo accounts on the Twilio trial). */
export async function GET(req: Request): Promise<Response> {
  try {
    const { accountId } = await requireUser(req);
    const env = getEnv();
    return Response.json({ enabled: callsEnabledFor(env, await accountEmail(env, accountId)) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Dossierly phones the user about their case now. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { userId, accountId } = await requireUser(req);
    const env = getEnv();
    if (!(await rateLimit(env, accountId, "phone_call", 3, 600)).ok) throw new ApiError(429, "Dossierly called recently; try again in a few minutes", "rate_limited");
    const body = await readJson(req, Body);
    let reason = body.reason;
    if (!reason) {
      const ctx = caseContext(await caseClient(userId).snapshot());
      reason = `The user asked for a call about their case. Most urgent item: ${ctx.split("\n").find((l) => l.startsWith("Next step:"))?.slice(11) ?? "their next deadline"}.`;
    }
    return Response.json(await placeCall(env, { accountId, userId, reason }), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
