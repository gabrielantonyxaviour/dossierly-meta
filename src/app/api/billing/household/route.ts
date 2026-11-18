import { z } from "zod";
import { billingRoute } from "@/lib/billing/route";
import { addMember, removeMember } from "@/lib/server/entitlements";
import { ApiError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const Add = z.object({ name: z.string().trim().min(1).max(80) });
const Remove = z.object({ memberId: z.string().min(1).max(64) });

/** Add a family member to a Household year (the holder plus 3). */
export const POST = (req: Request) =>
  billingRoute(req, Add, async (env, account, input) => Response.json({ member: await addMember(env, account.accountId, input.name) }, { status: 201 }));

export const DELETE = (req: Request) =>
  billingRoute(req, Remove, async (env, account, input) => {
    if (!(await removeMember(env, account.accountId, input.memberId))) throw new ApiError(404, "Family member not found", "not_found");
    return Response.json({ ok: true });
  });
