import { z } from "zod";
import { TEST_LINES } from "@/lib/voice/clips";
import { speakAll, ttsSettings } from "@/lib/voice/server/tts";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { TTS_CAP_MESSAGE, TtsCapError } from "@/lib/voice/server/tts-budget";
import { requireUser } from "@/lib/server/session";
import { sha256Hex } from "@/lib/server/util";

export const dynamic = "force-dynamic";

const Query = z.object({ i: z.coerce.number().int().min(0).max(TEST_LINES.length - 1) });

/** One test-kit line as raw PCM16 16 kHz mono (synthetic voice, cached in R2). */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireUser(req);
    const { i } = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
    const env = getEnv();
    const { who, text } = TEST_LINES[i];
    const key = `voice/clips/${(await sha256Hex(`${who}:v2:${text}`)).slice(0, 24)}.pcm`;
    let bytes: Uint8Array | null = null;
    const hit = await env.BLOBS.get(key).catch(() => null);
    if (hit) bytes = new Uint8Array(await hit.arrayBuffer());
    if (!bytes) {
      const tts = ttsSettings(env);
      if (!tts.apiKey) throw new ApiError(503, "Speech output is not configured", "tts_unconfigured");
      const common = { format: "pcm_16000" as const, model: tts.model, voices: tts.voices, reserve: tts.reserve, release: tts.release };
      try {
        bytes = await speakAll(tts.apiKey, who === "official" ? { text, lang: "pl", voice: "official", ...common } : { text, lang: "en", voice: "tester", ...common });
      } catch (e) {
        if (e instanceof TtsCapError) throw new ApiError(429, TTS_CAP_MESSAGE, "tts_cap");
        throw e;
      }
      await env.BLOBS.put(key, bytes).catch(() => undefined);
    }
    return new Response(bytes as unknown as BodyInit, {
      headers: { "content-type": "audio/L16;rate=16000;channels=1", "cache-control": "private, max-age=86400", "x-clip-count": String(TEST_LINES.length) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
