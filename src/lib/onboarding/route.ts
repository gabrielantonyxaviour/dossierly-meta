import { checkEmailOrigin } from "../server/email-auth";
import { getEnv } from "../server/env";
import type { ConnectionsEnv } from "../server/connections/types";
import { requireUser } from "../server/session";
import { onboardingError } from "./http";

/** Authenticated onboarding route: same-origin check on writes, `{ error, code? }` on failure, no caching. */
export async function withOnboarding(req: Request, fn: (ctx: { env: ConnectionsEnv; userId: string; accountId: string }) => Promise<unknown>): Promise<Response> {
  try {
    const env = getEnv() as ConnectionsEnv;
    if (req.method !== "GET") checkEmailOrigin(req, env);
    const { userId, accountId } = await requireUser(req);
    return Response.json(await fn({ env, userId, accountId }), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return onboardingError(e);
  }
}
