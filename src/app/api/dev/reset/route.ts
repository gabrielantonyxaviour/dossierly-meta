import { z } from "zod";
import { resetPreviewAccount } from "@/lib/dev/preview";
import { freshFirstRun } from "@/lib/dev/fresh";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({ reseed: z.boolean().optional(), disconnect: z.boolean().optional() }).strict();

/**
 * Preview only: wipes the signed-in account's case and setup. `reseed: true` loads Arjun's labelled sample case
 * instead (app/voice/look testing); otherwise the account starts onboarding fresh. `disconnect: true` also disconnects
 * Gmail and the calendar and clears the inbox watcher's memory, for a true first run (film takes). 404 in production.
 */
export async function POST(req: Request) {
  const env = getEnv();
  if (env.APP_ENV === "production") return jsonError(404, "Not found");
  try {
    sameOrigin(req, env);
    const state = await requireUserState(req);
    const { reseed, disconnect: unlink } = await boundedJson(req, Body, 1024);
    if (unlink && !reseed) await freshFirstRun(env, state.accountId, { disconnect: true });
    else await resetPreviewAccount(env, state.accountId, { reseed: !!reseed });
    return Response.json({ ok: true, next: reseed ? "/app" : "/onboarding" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
