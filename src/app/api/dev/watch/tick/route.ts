import { getEnv } from "@/lib/server/env";
import type { ConnectionsEnv } from "@/lib/server/connections/types";
import { checkEmailOrigin } from "@/lib/server/email-auth";
import { ApiError, errorResponse, jsonError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";
import { accountStatus, recentRows } from "@/lib/watch/state";
import { runWatchTick } from "@/lib/watch/tick";

export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" };
const devOnly = (env: ConnectionsEnv) => env.APP_ENV === "local" || env.APP_ENV === "preview";

/** Preview/local QA: run one watcher pass for the signed-in account only. 404 in production. */
export async function POST(req: Request) {
  const env = getEnv() as ConnectionsEnv;
  if (!devOnly(env)) return jsonError(404, "Not found");
  try {
    checkEmailOrigin(req, env);
    const { accountId } = await requireUser(req);
    const rl = await rateLimit(env, accountId, "watch-tick", 10, 600);
    if (!rl.ok) throw new ApiError(429, "Too many requests. Try again shortly.", "rate_limited");
    return Response.json(await runWatchTick(env, { accountId }), { headers });
  } catch (e) {
    return errorResponse(e);
  }
}

/** The account's watcher state: baseline, last run and the most recent messages it claimed. */
export async function GET(req: Request) {
  const env = getEnv() as ConnectionsEnv;
  if (!devOnly(env)) return jsonError(404, "Not found");
  try {
    const { accountId } = await requireUser(req);
    return Response.json({ account: await accountStatus(env, accountId), messages: await recentRows(env, accountId) }, { headers });
  } catch (e) {
    return errorResponse(e);
  }
}
