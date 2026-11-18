import { adminRoute } from "@/lib/admin/route";
import { addWhitelist, idInput, removeWhitelist, whitelistInput } from "@/lib/admin/whitelist";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => adminRoute(req, whitelistInput, (env, admin, input) => addWhitelist(env, admin.email, input));

export const DELETE = (req: Request) =>
  adminRoute(req, idInput, async (env, admin, input) => {
    await removeWhitelist(env, admin.email, input.id);
    return { ok: true };
  });
