import { listAudit } from "@/lib/admin/audit";
import { listPromos } from "@/lib/admin/promos";
import { adminRoute } from "@/lib/admin/route";
import { listWhitelist } from "@/lib/admin/whitelist";

export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  adminRoute(req, null, async (env) => ({ whitelist: await listWhitelist(env), promos: await listPromos(env), audit: await listAudit(env, 100) }));
