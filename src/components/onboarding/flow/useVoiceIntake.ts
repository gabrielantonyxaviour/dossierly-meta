"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import type { Profile } from "@/lib/case/types";
import { Player } from "@/lib/voice/client/audio";
import { useAgentCall } from "@/lib/voice/client/useAgentCall";

export type IntakeState = "idle" | "starting" | "listening" | "thinking" | "speaking" | "done";
type Result = { reply: string; profile: Profile; firstName: string | null };

const RATE = 16000;

/** Plays streamed PCM16 as it arrives and calls `done` once it has played out (typed answers). */
async function playStream(ctx: AudioContext, url: string, done: () => void) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok || !res.body) throw new Error("no audio");
  const player = new Player(ctx, () => done(), () => undefined);
  const reader = res.body.getReader();
  let carry: Uint8Array | null = null;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    let bytes: Uint8Array = carry ? new Uint8Array([...carry, ...value]) : value;
    carry = bytes.length % 2 ? bytes.slice(-1) : null;
    if (carry) bytes = bytes.slice(0, -1);
    if (bytes.length) player.play(bytes.slice().buffer, RATE);
  }
  player.end("reply");
}

/**
 * Voice-first hello. Talking runs as a realtime voice session (mode "intake": Muse Voice Transcribe streaming with
 * live partials and endpointing → Spark reads it and saves the profile → Dossierly answers in its voice).
 * Typing uses one request and the same spoken answer.
 */
export function useVoiceIntake(onResult: (r: Result) => void) {
  const call = useAgentCall({ mode: "intake" });
  const [typed, setTyped] = useState<{ state: IntakeState; heard: string; reply: string; error: string } | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const result = useRef(onResult);
  const reported = useRef(false);
  useEffect(() => { result.current = onResult; }, [onResult]);

  const userTurn = call.turns.find((t) => t.who === "user" && !t.partial);
  const agentTurn = call.turns.find((t) => t.who === "agent");
  useEffect(() => {
    if (!call.intake || reported.current) return;
    reported.current = true;
    result.current({ reply: agentTurn?.text ?? "", profile: call.intake.profile, firstName: call.intake.firstName });
  }, [call.intake, agentTurn?.text]);

  const voiceState: IntakeState =
    call.status === "connecting" || call.micWaiting ? "starting"
    : call.status === "ended" && call.intake ? "done"
    : call.status === "live" ? (agentTurn ? "speaking" : userTurn ? "thinking" : "listening")
    : "idle";

  const start = useCallback(async () => {
    setTyped(null); reported.current = false;
    await call.start();
  }, [call]);

  const sendTyped = useCallback(async (text: string) => {
    setTyped({ state: "thinking", heard: text, reply: "", error: "" });
    const r = await flowApi.intake(text);
    if (!r.ok) { setTyped({ state: "idle", heard: text, reply: "", error: failure(r) ?? "That didn’t go through. Try again." }); return; }
    const finish = () => { setTyped((t) => t && { ...t, state: "done" }); result.current(r.data); };
    setTyped({ state: "speaking", heard: text, reply: r.data.reply, error: "" });
    try {
      ctx.current ??= new AudioContext();
      await Promise.race([ctx.current.resume(), new Promise((res) => setTimeout(res, 700))]);
      if (!r.data.speechId) return finish();
      await playStream(ctx.current, `/api/onboarding/intake/speech?id=${encodeURIComponent(r.data.speechId)}`, finish);
    } catch {
      finish(); // the reply stays on screen as text
    }
  }, []);

  if (typed) return { state: typed.state, heard: typed.heard, reply: typed.reply, error: typed.error, metrics: [], start, stop: call.stop, typed: sendTyped };
  const ended = call.status === "ended" && !call.intake;
  return {
    state: voiceState,
    heard: call.partial || userTurn?.text || "",
    reply: agentTurn?.text ?? "",
    error: call.error ?? (ended ? "I didn’t catch that. Tap the microphone and try again, or type instead." : ""),
    metrics: call.metrics,
    start, stop: call.stop, typed: sendTyped,
  };
}
