import { createPromo, promoInput } from "@/lib/admin/promos";
import { adminRoute } from "@/lib/admin/route";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => adminRoute(req, promoInput, (env, admin, input) => createPromo(env, admin.email, input));
