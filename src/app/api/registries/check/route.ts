import { checkRegistry } from "@/lib/registries/check";
import { checkQuerySchema } from "@/lib/registries/ids";
import { errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const sp = new URL(req.url).searchParams;
    const q = checkQuerySchema.parse({ nip: sp.get("nip") ?? undefined, krs: sp.get("krs") ?? undefined });
    const result = await checkRegistry(q);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
