import { z } from "zod";
import { MODEL_ASR } from "../config";
import { asrCostUsd, costUsd } from "../model/cost";
import { meterClient, meterFixed } from "../model/meter";
import { createMetaClient, transcribeFile, type FetchLike } from "../model/meta";
import { hasModelKey, resolveRole } from "../model/roles";
import type { ChatClient } from "../model/types";
import { ModelError } from "../model/types";
import type { Env } from "./env";
import { ApiError } from "./http";
import { recordLedger } from "./ledger";

export const ASR_MODEL = MODEL_ASR;
export const ASR_MAX_AUDIO = 1_000_000;
/** WAV mono 16-bit at 16 kHz, 2 bytes per sample. */
const BYTES_PER_SECOND = 32_000;

export const AsrStartSchema = z.object({
  audio: z.string().min(1),
  lang: z.enum(["pl", "en", "uk", "hi", "ta"]),
  translate: z.enum(["en", "pl"]).optional(),
});

export type AsrView = { status: "done"; text: string; ms: number; model: string; translation?: string; translationModel?: string };

const LANG_NAME: Record<string, string> = { pl: "Polish", en: "English", uk: "Ukrainian", hi: "Hindi", ta: "Tamil" };

/** Speech recognition is available whenever a model key is configured. */
export const asrOnline = (env: Env): boolean => hasModelKey(env);

/** A WAV starts with `RIFF....WAVE`; reject anything else before it leaves the Worker. */
export function looksLikeWav(b64: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  try {
    const head = atob(b64.slice(0, 16));
    return head.startsWith("RIFF") && head.slice(8, 12) === "WAVE";
  } catch {
    return false;
  }
}

const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * Transcribes one recording (and optionally translates it) in the Worker. The audio is never stored.
 * Throws 413 `too_large`, 400 `invalid_audio`, 503 `asr_offline`.
 */
export async function transcribeAudio(
  env: Env,
  userId: string,
  input: z.infer<typeof AsrStartSchema>,
  deps: { fetch?: FetchLike; client?: ChatClient } = {},
): Promise<AsrView> {
  if (input.audio.length > ASR_MAX_AUDIO) throw new ApiError(413, "That recording is too long. Try a shorter clip.", "too_large");
  if (!looksLikeWav(input.audio)) throw new ApiError(400, "Audio must be a base64 WAV", "invalid_audio");
  if (!deps.fetch && !asrOnline(env)) throw new ApiError(503, "Speech recognition is offline right now", "asr_offline");
  const wav = fromB64(input.audio);
  const seconds = wav.length / BYTES_PER_SECOND;
  const t0 = Date.now();
  try {
    const out = await meterFixed(env, asrCostUsd(Math.max(seconds, 1)) + 0.0001, async () => ({
      value: await transcribeFile({ wav, languageBias: [LANG_NAME[input.lang]] }, { env, fetch: deps.fetch }),
      actualUsd: asrCostUsd(seconds),
    }));
    const view: AsrView = { status: "done", text: out.text, ms: Date.now() - t0, model: out.model };
    await recordLedger(env, { userId, kind: "model", what: out.model, action: "allowed", bytes: wav.length, detail: { task: "asr", seconds: Math.round(seconds) } });
    if (input.translate && out.text) {
      const cfg = resolveRole("interpret", env);
      const client = meterClient(env, deps.client ?? createMetaClient(env, deps.fetch));
      const target = input.translate === "en" ? "English" : "Polish";
      const res = await client.chat({
        model: cfg.model, role: "interpret", maxTokens: 1500, reasoningEffort: cfg.effort,
        messages: [
          { role: "system", content: `Translate the user's text into ${target}. Output only the translation.` },
          { role: "user", content: out.text },
        ],
      });
      view.translation = res.content.trim();
      view.translationModel = cfg.model;
      await recordLedger(env, { userId, kind: "model", what: cfg.model, action: "allowed", detail: { task: "asr-translate", costUsd: costUsd(cfg.model, res.usage) } });
    }
    return view;
  } catch (err) {
    if (err instanceof ModelError) {
      if (err.code === "no_key") throw new ApiError(503, "Speech recognition is offline right now", "asr_offline");
      throw new ApiError(err.status === 429 ? 429 : 502, err.message, err.code);
    }
    throw err;
  }
}
