import { withCase } from "@/lib/case/route";
import { getEnv } from "@/lib/server/env";
import { seedSampleCase } from "@/lib/voice/demo-seed";

export const dynamic = "force-dynamic";

/** Preview-only: fills an empty case with Arjun's SAMPLE case so the voice flows have something to talk about. */
export const POST = (req: Request) =>
  getEnv().APP_ENV === "production"
    ? Promise.resolve(Response.json({ error: "Not available", code: "not_found" }, { status: 404 }))
    : withCase(req, (c) => seedSampleCase(c));
