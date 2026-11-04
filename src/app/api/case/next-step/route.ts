import { nextStep } from "@/lib/case/next-step";
import { withCase } from "@/lib/case/route";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => withCase(req, async (c) => ({ nextStep: nextStep(await c.snapshot()) }));
