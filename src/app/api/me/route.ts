import { errorResponse } from "@/lib/server/http";
import { mePayload } from "@/lib/server/me";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return Response.json(mePayload(await requireUserState(req)), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
