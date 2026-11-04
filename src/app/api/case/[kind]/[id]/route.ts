import { collectionSchema } from "@/lib/case/types";
import { withCase } from "@/lib/case/route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ kind: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return withCase(req, async (c, { body }) => {
    const p = await params;
    return c.patch(collectionSchema.parse(p.kind), p.id, await body());
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return withCase(req, async (c) => {
    const p = await params;
    await c.remove(collectionSchema.parse(p.kind), p.id);
    return { ok: true };
  });
}
