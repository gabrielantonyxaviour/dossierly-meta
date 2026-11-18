import type { z } from "zod";
import { getEnv, type Env } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireAdmin } from "./auth";

/** Wrapper for every /api/admin route: session, admin check (401/403), same-origin for writes, `{ error, code? }` on failure. */
export async function adminRoute<S extends z.ZodType>(
  req: Request,
  schema: S | null,
  run: (env: Env, admin: { email: string }, input: z.infer<S>) => Promise<unknown>,
): Promise<Response> {
  try {
    const env = getEnv();
    const admin = await requireAdmin(env, req);
    if (req.method !== "GET") sameOrigin(req, env);
    const input = schema ? await boundedJson(req, schema) : undefined;
    const out = await run(env, { email: admin.email }, input as z.infer<S>);
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
