import { z } from "zod";
import { createToken, listTokens, revokeToken } from "@/lib/mcp/tokens";
import { SAMPLE_USER_ID, requireUserState } from "@/lib/server/session";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "no-store" };

const createBody = z.object({ name: z.string().trim().min(1).max(60), scope: z.enum(["read", "act"]).default("read") });
const revokeBody = z.object({ id: z.string().regex(/^mt_[A-Za-z0-9_-]{6,40}$/) });

/** Lists the signed-in account's active tokens (never the secrets). */
export async function GET(req: Request) {
  try {
    const s = await requireUserState(req);
    return Response.json({ tokens: await listTokens(getEnv(), s.accountId) }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Creates a token; the plaintext is in this response only. A token is bound to the case active now; the shared sample case is read-only. */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const s = await requireUserState(req);
    const body = await boundedJson(req, createBody);
    const scope = s.userId === SAMPLE_USER_ID ? "read" : body.scope;
    const created = await createToken(env, { accountId: s.accountId, caseUserId: s.userId, name: body.name, scope });
    return Response.json(created, { status: 201, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Revokes one token: body `{ id }`. */
export async function DELETE(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const s = await requireUserState(req);
    const { id } = await boundedJson(req, revokeBody);
    await revokeToken(env, s.accountId, id);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
