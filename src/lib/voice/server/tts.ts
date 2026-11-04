/*
 * ElevenLabs streaming text-to-speech. Raw PCM 16 kHz for the browser, μ-law 8 kHz for Twilio.
 * Model: eleven_v4_turbo, ElevenLabs' newest real-time flagship (90+ languages incl. Polish; ~430 ms to first audio
 * measured 4 Nov vs ~215 ms for Flash v2.5). ELEVENLABS_TTS_MODEL overrides it per Worker.
 */

export type TtsFormat = "pcm_16000" | "ulaw_8000";

/** Premade multilingual voices: Dossierly's own voice, the Polish official (rehearsal + test kit), the test kit's user. */
export const VOICES = {
  dossierly: "21m00Tcm4TlvDq8ikWAM",
  official: "onwK4e9ZLuTAKqWW03F9",
  tester: "pNInz6obpgDQGcFmaJgB",
} as const;
export type VoiceName = keyof typeof VOICES;

export const TTS_MODEL = "eleven_v4_turbo";

const ISO: Record<string, string> = { pl: "pl", en: "en", hi: "hi", ta: "ta", bn: "bn", te: "te", mr: "mr", kn: "kn", tl: "fil", vi: "vi", tr: "tr", ar: "ar", es: "es" };

export class TtsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Streams speech for one sentence or short paragraph. Yields audio bytes as ElevenLabs produces them. */
export async function* speak(
  apiKey: string,
  args: { text: string; lang: string; voice?: VoiceName; format?: TtsFormat; signal?: AbortSignal; model?: string },
): AsyncGenerator<Uint8Array> {
  if (!apiKey) throw new TtsError("Speech output is not configured", 503);
  const voice = VOICES[args.voice ?? "dossierly"];
  const model = args.model || TTS_MODEL;
  // optimize_streaming_latency exists only on the Flash models (v4 Turbo rejects it).
  const tune = model.startsWith("eleven_flash") ? "&optimize_streaming_latency=3" : "";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=${args.format ?? "pcm_16000"}${tune}`;
  const body: Record<string, unknown> = {
    text: args.text,
    model_id: model,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
  };
  const code = ISO[args.lang];
  if (code) body.language_code = code;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/*" },
    body: JSON.stringify(body),
    signal: args.signal,
  });
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    throw new TtsError(res.status === 401 ? "Speech output rejected the key" : "Speech output failed", res.status);
  }
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) yield value;
  }
}

/** Whole clip in one buffer (test-official clips, cached). */
export async function speakAll(apiKey: string, args: { text: string; lang: string; voice?: VoiceName; format?: TtsFormat; model?: string }): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const p of speak(apiKey, args)) parts.push(p);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}
