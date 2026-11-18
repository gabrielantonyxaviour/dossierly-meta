import { beforeEach, describe, expect, it } from "vitest";
import { asrOnline, transcribeAudio } from "@/lib/server/asr";
import { ApiError } from "@/lib/server/http";
import { freshLocalEnv } from "@/lib/server/local";
import { createWonderClient } from "@/lib/strategist/transport";
import { MetaAsr } from "@/lib/voice/server/asr";
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

describe("features that depend on a Meta-only service fail closed for real users", () => {
  it("file transcription answers 403 provider_blocked and reports itself offline, with no request", async () => {
    const env = freshLocalEnv(KEYS);
    expect(asrOnline(env)).toBe(false);
    const err = await transcribeAudio(env, "u1", { audio: wavB64(), lang: "pl" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "provider_blocked" });
  });

  it("is available again once META_USER_CONTENT=allow", () => {
    expect(asrOnline(freshLocalEnv({ ...KEYS, META_USER_CONTENT: "allow" }))).toBe(true);
  });

  it("live voice recognition refuses to connect with a ModelError the session forwards as its error code", async () => {
    const asr = new MetaAsr(KEYS, { languageBias: ["pl"], keywords: [] }, { onSpeechStart() {}, onPartial() {}, onSpeechEnd() {}, onFinal() {}, onError() {}, onClose() {} });
    const err = await asr.connect().catch((e) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err).toMatchObject({ code: "provider_blocked", status: 403 });
    expect(err.message).toMatch(/not available/);
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
