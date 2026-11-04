import { withCase } from "@/lib/case/route";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => withCase(req, (c) => c.snapshot());
