import { z } from "zod";
import { VOICE_MODES } from "@/lib/voice/protocol";
import { issueBrowserTicket } from "@/lib/voice/server/issue";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  mode: z.enum(VOICE_MODES),
  lang: z.string().regex(/^[a-z]{2}$/).optional(),
  script: z.string().trim().min(1).max(1500).optional(),
}).strict();

/** Starts a voice session: returns the WebSocket path with a 2-minute signed ticket. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { userId } = await requireUser(req);
    const body = await readJson(req, Body);
    const out = await issueBrowserTicket(getEnv(), userId, body.mode, { lang: body.lang, script: body.mode === "welcome" ? body.script : undefined });
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
