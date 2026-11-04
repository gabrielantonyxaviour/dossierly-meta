import { describe, expect, it } from "vitest";
import { ASR_MAX_AUDIO, asrOnline, looksLikeWav, transcribeAudio } from "@/lib/server/asr";
import { ApiError } from "@/lib/server/http";
import { listLedger } from "@/lib/server/ledger";
import { freshLocalEnv } from "@/lib/server/local";

const wavB64 = (seconds = 1) => {
  const bytes = new Uint8Array(44 + seconds * 32_000);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WAVE"), 8);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const code = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e instanceof ApiError ? [e.status, e.code] : String(e); }
  return null;
};
type Seen = { url: string; init?: RequestInit };
function fetcher(replies: Array<unknown>) {
  const seen: Seen[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return Response.json(replies[Math.min(seen.length, replies.length) - 1]);
  };
  return { seen, fetch };
}

describe("speech to text", () => {
  it("recognises only real WAV data", () => {
    expect(looksLikeWav(wavB64())).toBe(true);
    expect(looksLikeWav(btoa("not a wav at all, just text"))).toBe(false);
    expect(looksLikeWav("***")).toBe(false);
  });

  it("is offline without a model key", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "" });
    expect(asrOnline(env)).toBe(false);
    expect(await code(transcribeAudio(env, "u1", { audio: wavB64(), lang: "pl" }))).toEqual([503, "asr_offline"]);
  });

  it("rejects oversize and non-WAV audio before any call", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const f = fetcher([{}]);
    expect(await code(transcribeAudio(env, "u1", { audio: "A".repeat(ASR_MAX_AUDIO + 1), lang: "pl" }, f))).toEqual([413, "too_large"]);
    expect(await code(transcribeAudio(env, "u1", { audio: btoa("hello hello hello"), lang: "pl" }, f))).toEqual([400, "invalid_audio"]);
    expect(f.seen).toHaveLength(0);
  });

  it("transcribes in the Worker, bills by audio duration, and ledgers it without keeping audio", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const f = fetcher([{ transcript: "Proszę o zaświadczenie." }]);
    const out = await transcribeAudio(env, "u1", { audio: wavB64(2), lang: "pl" }, f);
    expect(out).toMatchObject({ status: "done", text: "Proszę o zaświadczenie.", model: "muse-voice-transcribe-1.0" });
    expect(f.seen[0].url).toBe("https://api.meta.ai/v1/asr/transcribe");
    const led = (await listLedger(env, "u1", 10)).entries;
    expect(led[0]).toMatchObject({ what: "muse-voice-transcribe-1.0" });
    const spent = await env.DB.prepare("SELECT spent_micro FROM budgets WHERE kind = 'model_usd' AND scope = 'global'").first<{ spent_micro: number }>();
    expect(spent?.spent_micro).toBe(Math.round((2 / 3600) * 0.18 * 1e6));
  });

  it("translates the transcript with the interpret role when asked", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const f = fetcher([
      { transcript: "Proszę o zaświadczenie." },
      { choices: [{ message: { content: "Please provide the certificate." } }], usage: { prompt_tokens: 30, completion_tokens: 8 } },
    ]);
    const out = await transcribeAudio(env, "u1", { audio: wavB64(), lang: "pl", translate: "en" }, f);
    expect(out.translation).toBe("Please provide the certificate.");
    expect(out.translationModel).toBe("muse-spark-1.2");
    expect(JSON.parse(String(f.seen[1].init?.body)).reasoning_effort).toBe("minimal");
  });
});
