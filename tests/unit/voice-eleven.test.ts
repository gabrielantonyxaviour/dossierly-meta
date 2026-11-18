import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ElevenAsr, VAD_SILENCE_SECS, realtimeUrl, scribeKeyterms, scribeLanguage } from "@/lib/voice/server/asr";
import { SpeechDetector } from "@/lib/voice/server/vad";
import { mintScribeToken } from "@/lib/server/scribe";
import { freshLocalEnv } from "@/lib/server/local";
import { speak, ttsSettings, VOICES } from "@/lib/voice/server/tts";
import { TtsCapError, releaseTtsChars, reserveTtsChars, resetTtsBudget, ttsCharsToday, ttsDailyCap } from "@/lib/voice/server/tts-budget";

const ENV = { ELEVENLABS_API_KEY: "el-key" };

class FakeWs {
  sent: string[] = [];
  closed = false;
  private l: Record<string, Array<(e: unknown) => void>> = {};
  accept() {}
  addEventListener(t: string, f: (e: unknown) => void) { (this.l[t] ??= []).push(f); }
  send(d: string) { this.sent.push(d); }
  close() { this.closed = true; }
  emit(msg: object) { for (const f of this.l.message ?? []) f({ data: JSON.stringify(msg) }); }
}

const realFetch = globalThis.fetch;
let ws: FakeWs;
let url = "";
let headers: Record<string, string> = {};
beforeEach(() => {
  ws = new FakeWs();
  globalThis.fetch = (async (u: string, init?: RequestInit) => {
    url = String(u);
    headers = (init?.headers ?? {}) as Record<string, string>;
    return Object.assign(new Response(null, { status: 200 }), { webSocket: ws });
  }) as typeof fetch;
  resetTtsBudget();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const loud = (ms: number, amp = 6000) => {
  const b = new ArrayBuffer(ms * 32);
  const v = new DataView(b);
  for (let i = 0; i < ms * 16; i++) v.setInt16(i * 2, i % 2 ? amp : -amp, true);
  return b;
};
const quiet = (ms: number) => new ArrayBuffer(ms * 32);

function make(bias = ["pl"], keywords: string[] = []) {
  const ev: string[] = [];
  const asr = new ElevenAsr(ENV, { languageBias: bias, keywords }, {
    onSpeechStart: () => ev.push("start"),
    onPartial: (t) => ev.push(`partial:${t}`),
    onSpeechEnd: (ms) => ev.push(`end:${ms === null ? "null" : "ms"}`),
    onFinal: (t) => ev.push(`final:${t}`),
    onError: (m) => ev.push(`error:${m}`),
    onClose: () => ev.push("close"),
  });
  return { asr, ev };
}

describe("language codes and keyterms", () => {
  it.each([["pl"], ["en"], ["uk"], ["hi"], ["ta"], ["ru"]])("pins %s as language_code", (l) => {
    expect(scribeLanguage([l])).toBe(l);
    expect(realtimeUrl("https://api.elevenlabs.io", "scribe_v3_live", { languageBias: [l], keywords: [] })).toContain(`language_code=${l}`);
  });
  it("leaves two languages (counter) to auto-detection and normalises region tags", () => {
    expect(scribeLanguage(["pl", "uk"])).toBeNull();
    expect(scribeLanguage(["pl-PL", "pl"])).toBe("pl");
    expect(realtimeUrl("https://api.elevenlabs.io", "scribe_v3_live", { languageBias: ["pl", "hi"], keywords: [] })).not.toContain("language_code");
  });
  it("filters keyterms to the service's limits", () => {
    const k = scribeKeyterms(["karta pobytu", "x".repeat(51), "a b c d e f", "bad<tag>", "UdSC", "UdSC"]);
    expect(k).toEqual(["karta pobytu", "UdSC"]);
  });
});

describe("realtime Scribe client", () => {
  it("connects with the key in a header, scribe_v3_live, 16 kHz PCM and vad commits", async () => {
    const { asr } = make(["uk"], ["karta pobytu"]);
    await asr.connect();
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://api.elevenlabs.io/v1/speech-to-text/realtime");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ model_id: "scribe_v3_live", audio_format: "pcm_16000", commit_strategy: "vad", vad_silence_threshold_secs: String(VAD_SILENCE_SECS), language_code: "uk", keyterms: "karta pobytu" });
    expect(headers["xi-api-key"]).toBe("el-key");
    expect(url).not.toContain("el-key");
  });

  it("queues audio until session_started, then sends input_audio_chunk messages", async () => {
    const { asr } = make();
    await asr.connect();
    asr.send(quiet(100));
    expect(ws.sent).toHaveLength(0);
    ws.emit({ message_type: "session_started", session_id: "s" });
    expect(ws.sent).toHaveLength(1);
    asr.send(quiet(100));
    const m = JSON.parse(ws.sent[1]);
    expect(m).toMatchObject({ message_type: "input_audio_chunk", commit: false, sample_rate: 16000 });
    expect(atob(m.audio_base_64)).toHaveLength(3200);
    expect(asr.sentMs).toBe(200);
  });

  it("turns partial and committed transcripts into start, partials, end and one final", async () => {
    const { asr, ev } = make();
    await asr.connect();
    ws.emit({ message_type: "session_started" });
    ws.emit({ message_type: "partial_transcript", text: "Dzień" });
    ws.emit({ message_type: "partial_transcript", text: "Dzień dobry" });
    ws.emit({ message_type: "committed_transcript", text: "Dzień dobry." });
    expect(ev).toEqual(["start", "partial:Dzień", "partial:Dzień dobry", "end:null", "final:Dzień dobry."]);
    // The next utterance starts fresh.
    ws.emit({ message_type: "partial_transcript", text: "Proszę" });
    expect(ev.at(-1)).toBe("partial:Proszę");
    expect(ev.filter((e) => e === "start")).toHaveLength(2);
  });

  it("reports speech end from local silence before the commit, then the final without a second end", async () => {
    const { asr, ev } = make();
    await asr.connect();
    ws.emit({ message_type: "session_started" });
    asr.send(loud(300));
    asr.send(quiet(450));
    expect(ev).toEqual(["start", "end:ms"]);
    ws.emit({ message_type: "partial_transcript", text: "Tak" });
    ws.emit({ message_type: "committed_transcript", text: "Tak." });
    expect(ev).toEqual(["start", "end:ms", "partial:Tak", "final:Tak."]);
  });

  it("ignores empty commits, soft warnings, and reports fatal errors", async () => {
    const { asr, ev } = make();
    await asr.connect();
    ws.emit({ message_type: "session_started" });
    ws.emit({ message_type: "committed_transcript", text: "  " });
    ws.emit({ message_type: "commit_throttled", error: "slow down" });
    ws.emit({ message_type: "insufficient_audio_activity", error: "quiet" });
    expect(ev).toEqual([]);
    ws.emit({ message_type: "quota_exceeded", error: "No credits" });
    ws.emit({ message_type: "auth_error", error: "bad key" });
    expect(ev).toEqual(["error:No credits", "error:bad key"]);
  });

  it("is not configured without a key, and closes cleanly", async () => {
    const none = new ElevenAsr({}, { languageBias: ["pl"], keywords: [] }, { onSpeechStart() {}, onPartial() {}, onSpeechEnd() {}, onFinal() {}, onError() {}, onClose() {} });
    await expect(none.connect()).rejects.toThrow(/not configured/);
    const { asr, ev } = make();
    await asr.connect();
    asr.close();
    expect(ws.closed).toBe(true);
    expect(ev).toEqual(["close"]);
  });
});

describe("speech detector", () => {
  it("ignores clicks and silence, starts on speech, ends after silence", () => {
    const d = new SpeechDetector();
    expect(d.push(quiet(500))).toBeNull();
    expect(d.push(loud(40))).toBeNull();
    expect(d.push(quiet(100))).toBeNull();
    expect(d.push(loud(200))?.type).toBe("start");
    expect(d.push(quiet(200))).toBeNull();
    const end = d.push(quiet(250));
    expect(end).toMatchObject({ type: "end" });
    expect(end!.silenceMs).toBeGreaterThanOrEqual(400);
  });
});

describe("single-use token", () => {
  it("mints through the server-side key and returns only the token", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const out = await mintScribeToken(ENV, async (u, init) => (seen.push({ url: u, init }), Response.json({ token: "sutkn_abc" })));
    expect(out).toEqual({ token: "sutkn_abc", model: "scribe_v3_live", expiresInSec: 900 });
    expect(seen[0].url).toBe("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
    expect(seen[0].init?.method).toBe("POST");
    expect(JSON.stringify(out)).not.toContain("el-key");
  });
  it("fails without a key and maps provider errors without the body", async () => {
    await expect(mintScribeToken({}, async () => Response.json({}))).rejects.toMatchObject({ code: "no_key" });
    await expect(mintScribeToken(ENV, async () => new Response("provider secret", { status: 500 }))).rejects.toMatchObject({ code: "provider_unavailable", message: expect.not.stringContaining("secret") });
  });
});

describe("text to speech daily character cap", () => {
  it("defaults to 4000 and reads ELEVENLABS_DAILY_CHAR_CAP", () => {
    expect(ttsDailyCap({})).toBe(4000);
    expect(ttsDailyCap({ ELEVENLABS_DAILY_CHAR_CAP: "1500" })).toBe(1500);
    expect(ttsDailyCap({ ELEVENLABS_DAILY_CHAR_CAP: "junk" })).toBe(4000);
  });

  it("refuses beyond the cap with code tts_cap, before any request, in D1", async () => {
    const env = freshLocalEnv({ ...ENV, ELEVENLABS_DAILY_CHAR_CAP: "100" });
    await reserveTtsChars(env, 60);
    await reserveTtsChars(env, 40);
    const err = await reserveTtsChars(env, 1).catch((e) => e);
    expect(err).toBeInstanceOf(TtsCapError);
    expect(err).toMatchObject({ code: "tts_cap", status: 429 });
    expect(await ttsCharsToday(env)).toEqual({ used: 100, cap: 100 });
    await releaseTtsChars(env, 30);
    await reserveTtsChars(env, 30);
  });

  it("a single request larger than the cap is refused outright", async () => {
    await expect(reserveTtsChars(freshLocalEnv({ ELEVENLABS_DAILY_CHAR_CAP: "50" }), 51)).rejects.toBeInstanceOf(TtsCapError);
  });

  it("speak() reserves first: over the cap nothing is fetched; a failed request gives the characters back", async () => {
    let calls = 0;
    globalThis.fetch = (async () => (calls++, new Response("nope", { status: 500 }))) as typeof fetch;
    const env = freshLocalEnv({ ...ENV, ELEVENLABS_DAILY_CHAR_CAP: "20" });
    const tts = ttsSettings(env);
    const run = (text: string) => (async () => { for await (const _ of speak(tts.apiKey, { text, lang: "pl", model: tts.model, voices: tts.voices, reserve: tts.reserve, release: tts.release })) void _; })();
    await expect(run("x".repeat(21))).rejects.toMatchObject({ code: "tts_cap" });
    expect(calls).toBe(0);
    await expect(run("x".repeat(15))).rejects.toMatchObject({ status: 500 });
    expect(calls).toBe(1);
    expect((await ttsCharsToday(env)).used).toBe(0);
  });

  it("uses the configured voices and v4 turbo", async () => {
    const t = ttsSettings({ ELEVENLABS_API_KEY: "k", ELEVENLABS_VOICE_ID: "voiceA", ELEVENLABS_OFFICIAL_VOICE_ID: "voiceB" });
    expect(t).toMatchObject({ model: "eleven_v4_turbo", voices: { dossierly: "voiceA", official: "voiceB" } });
    expect(ttsSettings({}).voices.dossierly).toBe(VOICES.dossierly);
    const seen: string[] = [];
    globalThis.fetch = (async (u: string, init?: RequestInit) => (seen.push(`${u}|${init?.body}`), new Response(new Uint8Array([1, 2]), { status: 200 }))) as typeof fetch;
    for await (const _ of speak("k", { text: "Dobry", lang: "uk", voice: "official", voices: t.voices, model: t.model })) void _;
    expect(seen[0]).toContain("/v1/text-to-speech/voiceB/stream?output_format=pcm_16000");
    expect(seen[0]).toContain('"model_id":"eleven_v4_turbo"');
    expect(seen[0]).toContain('"language_code":"uk"');
  });
});
