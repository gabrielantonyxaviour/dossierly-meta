import { withCase } from "@/lib/case/route";
import { stripServerOnlyProfileFields } from "@/lib/case/profile-input";

export const dynamic = "force-dynamic";

export const PATCH = (req: Request) =>
  withCase(req, async (c, { body }) => c.patchProfile(stripServerOnlyProfileFields(await body()) as never));
