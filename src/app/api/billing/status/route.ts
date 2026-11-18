import { billingStatus } from "@/lib/billing/status";
import { billingRoute } from "@/lib/billing/route";

export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  billingRoute(req, null, async (env, account) => Response.json(await billingStatus(env, account.accountId, account.lettersUsed)));
