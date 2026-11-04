import { withCase } from "@/lib/case/route";

export const dynamic = "force-dynamic";

export const PATCH = (req: Request) => withCase(req, async (c, { body }) => c.patchProfile(await body()));
