import { beforeEach, describe, expect, it } from "vitest";
import { asrOnline, transcribeAudio } from "@/lib/server/asr";
import { ApiError } from "@/lib/server/http";
import { freshLocalEnv } from "@/lib/server/local";
import { createWonderClient } from "@/lib/strategist/transport";
import { ElevenAsr } from "@/lib/voice/server/asr";
import { resolveRole } from "@/lib/model/roles";
import { ModelError } from "@/lib/model/types";

const KEYS = { MODEL_API_KEY: "meta-key", ANTHROPIC_API_KEY: "anthropic-key" };
beforeEach(() => {
  delete process.env.META_USER_CONTENT;
});

function wavB64() {
  const bytes = new Uint8Array(44 + 32_000);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WAVE"), 8);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

describe("speech never reaches Meta, for any origin", () => {
  const EL = { ...KEYS, ELEVENLABS_API_KEY: "el-key" };
  const hosts = (urls: string[]) => urls.map((u) => new URL(u).host);

  it("is offline without an ElevenLabs key (a Meta key does not help), with no request", async () => {
    const env = freshLocalEnv(KEYS);
    const seen: string[] = [];
    expect(asrOnline(env)).toBe(false);
    const err = await transcribeAudio(env, "u1", { audio: wavB64(), lang: "pl" }, { fetch: async (u) => (seen.push(u), Response.json({})) }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 503, code: "asr_offline" });
    expect(seen).toEqual([]);
  });

  it("is online for real users with only the ElevenLabs key, gate closed", () => {
    expect(asrOnline(freshLocalEnv(EL))).toBe(true);
  });

  it("user-origin clips go only to api.elevenlabs.io, even when config tries to route asr to Meta", async () => {
    const env = freshLocalEnv({ ...EL, MODEL_ASR_PROVIDER: "meta", MODEL_ASR_MODEL: "muse-voice-transcribe-1.0", META_USER_CONTENT: "", ...({ MODEL_ASR_USER_PROVIDER: "meta", MODEL_ASR_BASE_URL: "https://api.meta.ai/v1" } as object) });
    const seen: string[] = [];
    const out = await transcribeAudio(env, "u1", { audio: wavB64(), lang: "pl" }, { fetch: async (u) => (seen.push(u), Response.json({ text: "Dzień dobry", language_code: "pol" })) });
    expect(out.text).toBe("Dzień dobry");
    expect(out.model).toBe("scribe_v3");
    expect(hosts(seen)).toEqual(["api.elevenlabs.io"]);
  });

  it("live recognition connects to ElevenLabs only, for the default (user) origin", async () => {
    const seen: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (u: string) => (seen.push(String(u)), new Response(null, { status: 400 }))) as typeof fetch;
    try {
      const asr = new ElevenAsr({ ...EL, MODEL_ASR_PROVIDER: "meta" }, { languageBias: ["pl"], keywords: [] }, { onSpeechStart() {}, onPartial() {}, onSpeechEnd() {}, onFinal() {}, onError() {}, onClose() {} });
      await asr.connect().catch(() => undefined);
    } finally {
      globalThis.fetch = real;
    }
    expect(hosts(seen)).toEqual(["api.elevenlabs.io"]);
  });

  it("the gate itself still refuses a Meta provider for user content (sam and search stay blocked)", () => {
    for (const role of ["sam", "search"] as const) expect(() => resolveRole(role, EL)).toThrow(ModelError);
    expect(() => resolveRole("asr", EL)).not.toThrow();
  });
});

describe("case review model", () => {
  it("real users' cases review on Claude Sonnet, demo cases on Wonder, STRATEGIST_MODEL overrides", () => {
    expect(createWonderClient(KEYS).model).toBe("claude-sonnet-5-5");
    expect(createWonderClient(KEYS, undefined, "demo").model).toBe("muse-wonder-1.0");
    expect(createWonderClient({ ...KEYS, STRATEGIST_MODEL: "claude-opus-5-5" }).model).toBe("claude-opus-5-5");
  });

  it("refuses a Meta review model for a user case until the gate is lifted", () => {
    expect(() => createWonderClient({ ...KEYS, STRATEGIST_MODEL: "muse-wonder-1.0" })).toThrowError(expect.objectContaining({ code: "provider_blocked" }));
    expect(createWonderClient({ ...KEYS, STRATEGIST_MODEL: "muse-wonder-1.0", META_USER_CONTENT: "allow" }).model).toBe("muse-wonder-1.0");
  });
});
