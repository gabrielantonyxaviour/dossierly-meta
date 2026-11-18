/*
 * ElevenLabs streaming text-to-speech. Raw PCM 16 kHz for the browser, μ-law 8 kHz for Twilio.
 * Model: eleven_v4_turbo, ElevenLabs' real-time v4 model (90+ languages incl. Polish, Ukrainian, Hindi, Tamil).
 * ELEVENLABS_TTS_MODEL overrides it per Worker (eleven_v4 is the slower, highest-quality variant).
 * Every request first reserves its characters against ELEVENLABS_DAILY_CHAR_CAP (tts-budget.ts).
 * https://elevenlabs.io/docs/overview/models
 */
import { MODEL_TTS, VOICE_ID_DEFAULT, VOICE_ID_OFFICIAL } from "../../config";
import { releaseTtsChars, reserveTtsChars } from "./tts-budget";

export type TtsFormat = "pcm_16000" | "ulaw_8000";

/** Dossierly's own voice, the Polish official (counter, rehearsal, test kit), and the test kit's user. */
export const VOICES = {
  dossierly: VOICE_ID_DEFAULT,
  official: VOICE_ID_OFFICIAL,
  tester: "pNInz6obpgDQGcFmaJgB",
} as const;
export type VoiceName = keyof typeof VOICES;

export const TTS_MODEL = MODEL_TTS;

/** Per-Worker settings: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_OFFICIAL_VOICE_ID, ELEVENLABS_TTS_MODEL, ELEVENLABS_DAILY_CHAR_CAP. */
export interface TtsSettings {
  apiKey: string;
  model: string;
  voices: Record<VoiceName, string>;
  /** Reserves characters against the daily budget before a request (throws TtsCapError); release gives them back on failure. */
  reserve?: (chars: number) => Promise<void>;
  release?: (chars: number) => Promise<void>;
}

export function ttsSettings(env: Record<string, unknown> | object | undefined): TtsSettings {
  const e = (env ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof e[k] === "string" ? (e[k] as string).trim() : "");
  return {
    apiKey: str("ELEVENLABS_API_KEY"),
    model: str("ELEVENLABS_TTS_MODEL") || TTS_MODEL,
    voices: { dossierly: str("ELEVENLABS_VOICE_ID") || VOICES.dossierly, official: str("ELEVENLABS_OFFICIAL_VOICE_ID") || VOICES.official, tester: VOICES.tester },
    reserve: (n) => reserveTtsChars(env, n),
    release: (n) => releaseTtsChars(env, n),
  };
}

const ISO: Record<string, string> = { pl: "pl", en: "en", uk: "uk", ru: "ru", hi: "hi", ta: "ta", zh: "zh", ja: "ja", bn: "bn", te: "te", mr: "mr", kn: "kn", tl: "fil", vi: "vi", tr: "tr", ar: "ar", es: "es" };

export class TtsError extends Error {
  constructor(message: string, readonly status: number, readonly code: string = "tts") {
    super(message);
  }
}

/** Streams speech for one sentence or short paragraph. Yields audio bytes as ElevenLabs produces them. */
export async function* speak(
  apiKey: string,
  args: { text: string; lang: string; voice?: VoiceName; format?: TtsFormat; signal?: AbortSignal; model?: string; voices?: Partial<Record<VoiceName, string>>; reserve?: TtsSettings["reserve"]; release?: TtsSettings["release"] },
): AsyncGenerator<Uint8Array> {
  if (!apiKey) throw new TtsError("Speech output is not configured", 503);
  const voice = args.voices?.[args.voice ?? "dossierly"] || VOICES[args.voice ?? "dossierly"];
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
  const chars = args.text.length;
  await args.reserve?.(chars); // throws TtsCapError (code tts_cap) before any request is made
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/*" },
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (e) {
    await args.release?.(chars);
    throw e;
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    await args.release?.(chars);
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
export async function speakAll(apiKey: string, args: Parameters<typeof speak>[1]): Promise<Uint8Array> {
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
