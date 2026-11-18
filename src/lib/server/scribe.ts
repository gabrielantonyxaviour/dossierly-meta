import { scribeKeyterms } from "../voice/server/asr";
/*
 * ElevenLabs Scribe, recorded clips (POST /v1/speech-to-text, model scribe_v3), and the single-use token that lets a
 * browser stream to the realtime endpoint without ever holding the API key.
 * https://elevenlabs.io/docs/api-reference/speech-to-text/convert
 * https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-to-text/realtime/client-side-streaming
 */
import { MODEL_ASR_BATCH } from "../config";
import { resolveRole, type EnvLike } from "../model/roles";
import { ModelError } from "../model/types";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const read = (env: EnvLike, k: string): string => {
  const v = (env as Record<string, unknown> | undefined)?.[k];
  return typeof v === "string" ? v.trim() : "";
};

export const scribeBatchModel = (env: EnvLike): string => read(env, "MODEL_ASR_BATCH_MODEL") || MODEL_ASR_BATCH;

/** Maps an ElevenLabs error status to a ModelError with a user-safe message (the provider body is never passed on). */
function fail(status: number): ModelError {
  if (status === 401 || status === 403) return new ModelError("Speech recognition is offline right now", "no_key", 503);
  if (status === 429) return new ModelError("Speech recognition is busy. Try again shortly.", "rate_limited", 429);
  if (status === 402) return new ModelError("Speech recognition is out of quota right now", "model_unavailable", 503);
  return new ModelError("The speech service returned an error", status >= 500 ? "provider_unavailable" : "bad_request", status >= 500 ? 502 : 400);
}

/** One WAV (mono 16-bit 16 kHz) to text. `lang` is an ISO 639-1 code, which pins the language and improves accuracy. */
export async function transcribeFile(
  args: { wav: Uint8Array; lang?: string; keyterms?: string[] },
  o: { env?: EnvLike; fetch?: FetchLike } = {},
): Promise<{ text: string; model: string; language: string | null }> {
  const cfg = resolveRole("asr", o.env);
  if (!cfg.apiKey) throw new ModelError("Speech recognition is not configured", "no_key", 503);
  const model = scribeBatchModel(o.env);
  const form = new FormData();
  form.append("model_id", model);
  form.append("file", new Blob([args.wav as unknown as ArrayBuffer], { type: "audio/wav" }), "audio.wav");
  if (args.lang) form.append("language_code", args.lang);
  form.append("tag_audio_events", "false");
  for (const k of scribeKeyterms(args.keyterms ?? [])) form.append("keyterms", k);
  const res = await (o.fetch ?? fetch)(`${cfg.baseUrl}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": cfg.apiKey }, body: form });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw fail(res.status);
  }
  const json = (await res.json().catch(() => null)) as { text?: unknown; language_code?: unknown } | null;
  if (!json || typeof json.text !== "string") throw new ModelError("The speech service returned an error", "model_error", 502);
  return { text: json.text.trim(), model, language: typeof json.language_code === "string" ? json.language_code : null };
}

/**
 * Mints a single-use realtime Scribe token (valid 15 minutes, one connection) for a browser that connects directly:
 * wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=...&token=<token>. The API key stays on the server.
 */
export async function mintScribeToken(env: EnvLike, f: FetchLike = fetch): Promise<{ token: string; model: string; expiresInSec: number }> {
  const cfg = resolveRole("asr", env);
  if (!cfg.apiKey) throw new ModelError("Speech recognition is not configured", "no_key", 503);
  const res = await f(`${cfg.baseUrl}/v1/single-use-token/realtime_scribe`, { method: "POST", headers: { "xi-api-key": cfg.apiKey } });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw fail(res.status);
  }
  const json = (await res.json().catch(() => null)) as { token?: unknown } | null;
  if (!json || typeof json.token !== "string" || !json.token) throw new ModelError("The speech service returned an error", "model_error", 502);
  return { token: json.token, model: cfg.model, expiresInSec: 15 * 60 };
}
