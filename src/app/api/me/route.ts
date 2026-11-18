import { isAdminAccount } from "@/lib/admin/auth";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { mePayload } from "@/lib/server/me";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const state = await requireUserState(req);
    return Response.json({ ...mePayload(state), isAdmin: await isAdminAccount(getEnv(), state.accountId) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
