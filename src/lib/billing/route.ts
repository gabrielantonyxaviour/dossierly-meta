import { z } from "zod";
import type { Env } from "@/lib/server/env";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUserState, type UserState } from "@/lib/server/session";

/** Shared wrapper for the signed-in billing routes: same-origin check, account session, `{ error, code? }` on failure. */
export async function billingRoute<S extends z.ZodType>(
  req: Request,
  schema: S | null,
  run: (env: Env, account: UserState, input: z.infer<S>) => Promise<Response>,
): Promise<Response> {
  try {
    const env = getEnv();
    if (req.method !== "GET") sameOrigin(req, env);
    const account = await requireUserState(req);
    const input = schema ? await boundedJson(req, schema) : undefined;
    const res = await run(env, account, input as z.infer<S>);
    res.headers.set("cache-control", "no-store");
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
