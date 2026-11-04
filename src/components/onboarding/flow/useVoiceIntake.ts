"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import type { Profile } from "@/lib/case/types";
import { Mic, Player } from "@/lib/voice/client/audio";

export type IntakeState = "idle" | "starting" | "listening" | "thinking" | "speaking" | "done";
type Result = { reply: string; profile: Profile; firstName: string | null };

const RATE = 16000;
const SPEECH_LEVEL = 0.025;
const END_SILENCE_MS = 1700;
const MAX_MS = 16_000;
const PARTIAL_EVERY_MS = 1200;
const ASR_LANGS = ["pl", "en", "uk", "hi", "ta"] as const;

function wav(chunks: Int16Array[]): string {
  const n = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) { new Int16Array(buf, o, c.length).set(c); o += c.length * 2; }
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
const asrLang = () => {
  const l = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2).toLowerCase();
  return (ASR_LANGS as readonly string[]).includes(l) && l !== "pl" ? (l as (typeof ASR_LANGS)[number]) : "en";
};

/**
 * Tap, talk, done: the microphone streams into Muse Voice Transcribe for a live transcript (re-read every ~1.2 s),
 * stops by itself after a pause, then Spark reads the words, saves the profile and answers in Dossierly's voice.
 */
export function useVoiceIntake(onResult: (r: Result) => void) {
  const [state, setState] = useState<IntakeState>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const ctx = useRef<AudioContext | null>(null);
  const mic = useRef<Mic | null>(null);
  const chunks = useRef<Int16Array[]>([]);
  const timing = useRef({ started: 0, lastVoice: 0, spoke: false, finishing: false, partialBusy: false });
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const result = useRef(onResult);
  useEffect(() => { result.current = onResult; }, [onResult]);

  const stopMic = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    mic.current?.stop();
    mic.current = null;
  }, []);
  useEffect(() => () => { stopMic(); void ctx.current?.close().catch(() => undefined); }, [stopMic]);

  const answer = useCallback(async (text: string) => {
    setState("thinking");
    const r = await flowApi.intake(text);
    if (!r.ok) { setError(failure(r) ?? "I couldn’t catch that. Try again, or type it."); setState("idle"); return; }
    setReply(r.data.reply);
    const done = () => { setState("done"); result.current(r.data); };
    if (!r.data.audio || !ctx.current) return done();
    setState("speaking");
    const player = new Player(ctx.current, () => done(), () => undefined);
    player.play(fromB64(r.data.audio), RATE);
    player.end("reply");
  }, []);

  const finish = useCallback(async () => {
    const t = timing.current;
    if (t.finishing) return;
    t.finishing = true;
    stopMic();
    if (!t.spoke) { setError("I didn’t hear anything. Tap the microphone and talk, or type instead."); setState("idle"); return; }
    setState("thinking");
    const r = await api.asrTranscribe(wav(chunks.current), asrLang());
    const text = r.ok ? r.data.text.trim() : "";
    if (!text) { setError(r.ok ? "I didn’t catch that. Try once more, or type instead." : failure(r) ?? "Speech recognition is unavailable. Type instead."); setState("idle"); return; }
    setHeard(text);
    await answer(text);
  }, [answer, stopMic]);

  const start = useCallback(async () => {
    setError(""); setHeard(""); setReply(""); setState("starting");
    chunks.current = [];
    timing.current = { started: Date.now(), lastVoice: 0, spoke: false, finishing: false, partialBusy: false };
    try {
      ctx.current ??= new AudioContext();
      await Promise.race([ctx.current.resume(), new Promise((r) => setTimeout(r, 700))]);
      const m = new Mic(ctx.current);
      await m.start((pcm, level) => {
        const t = timing.current;
        if (t.finishing) return;
        chunks.current.push(new Int16Array(pcm));
        const now = Date.now();
        if (level > SPEECH_LEVEL) { t.spoke = true; t.lastVoice = now; }
        if ((t.spoke && now - t.lastVoice > END_SILENCE_MS) || now - t.started > MAX_MS) void finish();
      });
      mic.current = m;
      setState("listening");
      ticker.current = setInterval(async () => {
        const t = timing.current;
        if (!t.spoke || t.partialBusy || t.finishing) return;
        t.partialBusy = true;
        const r = await api.asrTranscribe(wav(chunks.current), asrLang());
        t.partialBusy = false;
        if (r.ok && r.data.text.trim() && !timing.current.finishing) setHeard(r.data.text.trim());
      }, PARTIAL_EVERY_MS);
    } catch (e) {
      stopMic();
      setError((e as Error)?.name === "NotAllowedError" ? "Microphone access is blocked. Allow it in your browser, or type instead." : "The microphone isn’t available here. Type instead.");
      setState("idle");
    }
  }, [finish, stopMic]);

  const typed = useCallback(async (text: string) => { setError(""); setHeard(text); await answer(text); }, [answer]);
  return { state, heard, reply, error, start, stop: finish, typed };
}
