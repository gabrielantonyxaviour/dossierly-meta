import { disablePromo } from "@/lib/admin/promos";
import { adminRoute } from "@/lib/admin/route";
import { idInput } from "@/lib/admin/whitelist";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => adminRoute(req, idInput, (env, admin, input) => disablePromo(env, admin.email, input.id));
