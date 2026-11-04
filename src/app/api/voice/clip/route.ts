import { z } from "zod";
import { TEST_OFFICIAL_LINES } from "@/lib/voice/clips";
import { speakAll } from "@/lib/voice/server/tts";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { sha256Hex } from "@/lib/server/util";

export const dynamic = "force-dynamic";

const Query = z.object({ i: z.coerce.number().int().min(0).max(TEST_OFFICIAL_LINES.length - 1) });

/** One test-official line as raw PCM16 16 kHz mono (synthetic voice, cached in R2). */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireUser(req);
    const { i } = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
    const env = getEnv();
    const text = TEST_OFFICIAL_LINES[i];
    const key = `voice/clips/${(await sha256Hex(`official:v1:${text}`)).slice(0, 24)}.pcm`;
    let bytes: Uint8Array | null = null;
    const hit = await env.BLOBS.get(key).catch(() => null);
    if (hit) bytes = new Uint8Array(await hit.arrayBuffer());
    if (!bytes) {
      const apiKey = String((env as unknown as Record<string, unknown>).ELEVENLABS_API_KEY ?? "");
      if (!apiKey) throw new ApiError(503, "Speech output is not configured", "tts_unconfigured");
      bytes = await speakAll(apiKey, { text, lang: "pl", voice: "official", format: "pcm_16000" });
      await env.BLOBS.put(key, bytes).catch(() => undefined);
    }
    return new Response(bytes as unknown as BodyInit, {
      headers: { "content-type": "audio/L16;rate=16000;channels=1", "cache-control": "private, max-age=86400", "x-clip-count": String(TEST_OFFICIAL_LINES.length) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
