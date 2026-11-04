import { z } from "zod";
import { resetPreviewAccount } from "@/lib/dev/preview";
import { disconnect } from "@/lib/server/connections/service";
import { rowFor } from "@/lib/server/connections/store";
import type { ConnectionsEnv } from "@/lib/server/connections/types";
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
    await resetPreviewAccount(env, state.accountId, { reseed: !!reseed });
    if (unlink) {
      for (const category of ["mail", "calendar"] as const) if (await rowFor(env as ConnectionsEnv, state.accountId, category)) await disconnect(env as ConnectionsEnv, state.accountId, category);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM watch_messages WHERE account_id = ?").bind(state.accountId),
        env.DB.prepare("DELETE FROM watch_accounts WHERE account_id = ?").bind(state.accountId),
      ]);
    }
    return Response.json({ ok: true, next: reseed ? "/app" : "/onboarding" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
