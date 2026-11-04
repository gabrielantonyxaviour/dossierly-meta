import { z } from "zod";
import { resetPreviewAccount } from "@/lib/dev/preview";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({ reseed: z.boolean().optional() }).strict();

/**
 * Preview only: wipes the signed-in account's case and setup. `reseed: true` loads Arjun's labelled sample case
 * instead (app/voice/look testing); otherwise the account starts onboarding fresh. 404 in production.
 */
export async function POST(req: Request) {
  const env = getEnv();
  if (env.APP_ENV === "production") return jsonError(404, "Not found");
  try {
    sameOrigin(req, env);
    const state = await requireUserState(req);
    const { reseed } = await boundedJson(req, Body, 1024);
    await resetPreviewAccount(env, state.accountId, { reseed: !!reseed });
    return Response.json({ ok: true, next: reseed ? "/app" : "/onboarding" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
