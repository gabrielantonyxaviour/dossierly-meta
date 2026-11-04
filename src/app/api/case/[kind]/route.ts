import { collectionSchema } from "@/lib/case/types";
import { withCase } from "@/lib/case/route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ kind: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return withCase(req, async (c) => c.list(collectionSchema.parse((await params).kind)));
}

export async function POST(req: Request, { params }: Ctx) {
  return withCase(req, async (c, { body }) => c.create(collectionSchema.parse((await params).kind), await body()), 201);
}
