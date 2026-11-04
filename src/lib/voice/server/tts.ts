/* ElevenLabs Flash v2.5 streaming text-to-speech. Raw PCM 16 kHz for the browser, μ-law 8 kHz for Twilio. */

export type TtsFormat = "pcm_16000" | "ulaw_8000";

/** Premade multilingual voices: Dossierly's own voice, and the Polish official (rehearsal + test clip). */
export const VOICES = {
  dossierly: "21m00Tcm4TlvDq8ikWAM",
  official: "onwK4e9ZLuTAKqWW03F9",
} as const;
export type VoiceName = keyof typeof VOICES;

const ISO: Record<string, string> = { pl: "pl", en: "en", hi: "hi", ta: "ta", bn: "bn", te: "te", mr: "mr", kn: "kn", tl: "fil", vi: "vi", tr: "tr", ar: "ar", es: "es" };

export class TtsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Streams speech for one sentence or short paragraph. Yields audio bytes as ElevenLabs produces them. */
export async function* speak(
  apiKey: string,
  args: { text: string; lang: string; voice?: VoiceName; format?: TtsFormat; signal?: AbortSignal },
): AsyncGenerator<Uint8Array> {
  if (!apiKey) throw new TtsError("Speech output is not configured", 503);
  const voice = VOICES[args.voice ?? "dossierly"];
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=${args.format ?? "pcm_16000"}&optimize_streaming_latency=3`;
  const body: Record<string, unknown> = {
    text: args.text,
    model_id: "eleven_flash_v2_5",
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
export async function speakAll(apiKey: string, args: { text: string; lang: string; voice?: VoiceName; format?: TtsFormat }): Promise<Uint8Array> {
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
