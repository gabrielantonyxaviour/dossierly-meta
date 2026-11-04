import { errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { ZodError } from "zod";
import { caseClient, CaseClientError, type CaseClient } from "./client";

const noStore = { "cache-control": "no-store" };

/** Wraps an authenticated case route: auth, JSON body parse, `{ error, code? }` errors. */
export async function withCase(
  req: Request,
  fn: (c: CaseClient, ctx: { userId: string; body: () => Promise<unknown> }) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  try {
    const { userId } = await requireUser(req);
    const body = async () => {
      try {
        return await req.json();
      } catch {
        throw new CaseClientError(400, "Request body must be JSON", "invalid_json");
      }
    };
    return Response.json(await fn(caseClient(userId), { userId, body }), { status, headers: noStore });
  } catch (e) {
    if (e instanceof CaseClientError) return Response.json(e.code ? { error: e.message, code: e.code } : { error: e.message }, { status: e.status, headers: noStore });
    if (e instanceof ZodError) return Response.json({ error: "Invalid request", code: "invalid_request" }, { status: 400 });
    return errorResponse(e);
  }
}
