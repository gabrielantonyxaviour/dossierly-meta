"use client";

/*
 * useAgentCall: one live voice session with Dossierly (welcome | agent | counter | rehearse).
 * Mic → 16 kHz PCM frames → /api/voice/ws (VoiceDO) → Meta ASR + Spark + ElevenLabs → PCM back → speakers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CapturedItem, CoachNote, DocCard, RehearseFeedback, ServerEvent, TurnMetric, VoiceMode, VoiceTurn } from "../protocol";
import { announceCaseChange } from "@/components/app/shell/case-data";
import { TEST_LINES, TEST_LINES_VERSION } from "../clips";
import { frames, Mic, Player } from "./audio";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export interface AgentCallOptions {
  mode: VoiceMode;
  lang?: string;
  /** welcome: the server-generated opening line, spoken first. */
  script?: string;
  onEnd?: () => void;
}

export interface AgentCall {
  status: CallStatus;
  error: string | null;
  turns: VoiceTurn[];
  partial: string | null;
  /** Which half is hearing speech right now (counter): "user" = the user's language, "official" = Polish. */
  speaking: "user" | "official" | null;
  level: number;
  muted: boolean;
  metrics: TurnMetric[];
  coach: CoachNote[];
  docs: DocCard[];
  captured: CapturedItem[];
  feedback: RehearseFeedback | null;
  userName: string | null;
  lang: string;
  clipBusy: boolean;
  /** Waiting for the user to allow the microphone. */
  micWaiting: boolean;
  start(): Promise<void>;
  stop(): void;
  sendText(text: string, as?: "user" | "official"): void;
  setMuted(m: boolean): void;
  playClip(i: number): Promise<void>;
  dismissDoc(docId: string): void;
}

const ERRORS: Record<string, string> = {
  NotAllowedError: "Microphone access was blocked. Allow the microphone for this site, then try again.",
  NotFoundError: "No microphone was found on this device.",
};

export function useAgentCall(opts: AgentCallOptions): AgentCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [partial, setPartial] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<"user" | "official" | null>(null);
  const [level, setLevel] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [metrics, setMetrics] = useState<TurnMetric[]>([]);
  const [coach, setCoach] = useState<CoachNote[]>([]);
  const [docs, setDocs] = useState<DocCard[]>([]);
  const [captured, setCaptured] = useState<CapturedItem[]>([]);
  const [feedback, setFeedback] = useState<RehearseFeedback | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [lang, setLang] = useState(opts.lang ?? "en");
  const [clipBusy, setClipBusy] = useState(false);
  const [micWaiting, setMicWaiting] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const mic = useRef<Mic | null>(null);
  const player = useRef<Player | null>(null);
  const audioRate = useRef(16000);
  const mutedRef = useRef(false);
  const clipping = useRef(false);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const gate = opts.mode === "counter" || opts.mode === "rehearse";

  const send = (data: string | ArrayBuffer) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(data);
  };

  const teardown = useCallback(() => {
    mic.current?.stop();
    mic.current = null;
    player.current?.flush();
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    ws.current = null;
    setSpeaking(null);
    setLevel(0);
  }, []);

  const onEvent = useCallback((ev: ServerEvent) => {
    switch (ev.t) {
      case "ready":
        setStatus("live");
        setUserName(ev.userName);
        setLang(ev.lang);
        break;
      case "asr":
        if (ev.phase === "partial") setPartial(ev.text ?? null);
        else if (ev.phase === "end") setPartial((p) => p);
        break;
      case "turn":
        if (ev.turn.who !== "agent" || !ev.turn.partial) setPartial(null);
        setTurns((ts) => {
          const i = ts.findIndex((t) => t.id === ev.turn.id);
          if (i < 0) return [...ts, ev.turn];
          const next = ts.slice();
          next[i] = ev.turn;
          return next;
        });
        break;
      case "audio_start":
        audioRate.current = ev.rate;
        if (player.current) player.current.current = ev.id;
        setSpeaking(ev.side);
        break;
      case "audio_end":
        player.current?.end(ev.id);
        break;
      case "stop_audio":
        player.current?.flush();
        setSpeaking(null);
        break;
      case "coach":
        setCoach((c) => [...c, ev.note]);
        break;
      case "doc":
        setDocs((d) => [...d.filter((x) => x.docId !== ev.doc.docId), ev.doc]);
        break;
      case "captured":
        setCaptured((c) => [...c, ev.item]);
        announceCaseChange();
        break;
      case "metric":
        setMetrics((m) => [...m, ev.metric]);
        break;
      case "feedback":
        setFeedback(ev.feedback);
        break;
      case "error":
        if (ev.fatal) setStatus("error");
        if (ev.code !== "asr_closed") setError(ev.error);
        break;
      case "ended":
        setStatus("ended");
        announceCaseChange();
        break;
    }
  }, []);

  const start = useCallback(async () => {
    if (ws.current) return;
    setStatus("connecting");
    setError(null);
    setTurns([]);
    setCoach([]);
    setDocs([]);
    setCaptured([]);
    setMetrics([]);
    setFeedback(null);
    try {
      const ac = new AudioContext();
      ctx.current = ac;
      // Without a recent tap (e.g. a hard reload of a live route) browsers keep audio locked: ask for a tap.
      await Promise.race([ac.resume(), new Promise((r) => setTimeout(r, 700))]);
      if (ac.state !== "running") throw Object.assign(new Error("Tap start to turn on sound."), { name: "AudioLocked" });
      player.current = new Player(ac, (id) => send(JSON.stringify({ t: "played", id })), () => setSpeaking(null));
      // Ask for the microphone first: a pending permission prompt must not stall a live session.
      setMicWaiting(true);
      const m = new Mic(ac);
      mic.current = m;
      try {
        await m.start((pcm, lvl) => {
          setLevel(lvl);
          if (clipping.current) return;
          const silent = mutedRef.current || (gate && player.current?.active);
          send(silent ? new ArrayBuffer(pcm.byteLength) : pcm);
        });
      } catch (micErr) {
        // No microphone: keep going with typing and the test official; say why.
        const name = (micErr as { name?: string })?.name ?? "";
        mic.current = null;
        setError(`${ERRORS[name] ?? "The microphone is unavailable."} ${optsRef.current.mode === "counter" ? "The test official still works." : "You can still type."}`);
      }
      setMicWaiting(false);
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: optsRef.current.mode, lang: optsRef.current.lang, script: optsRef.current.script }),
      });
      const data = (await res.json().catch(() => ({}))) as { path?: string; lang?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? "Could not start the call");
      if (data.lang) setLang(data.lang);
      const sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${data.path}`);
      sock.binaryType = "arraybuffer";
      ws.current = sock;
      sock.onmessage = (m) => {
        if (typeof m.data === "string") {
          try {
            onEvent(JSON.parse(m.data) as ServerEvent);
          } catch {
            /* ignore malformed */
          }
        } else player.current?.play(m.data as ArrayBuffer, audioRate.current);
      };
      sock.onclose = () => {
        setStatus((s) => (s === "error" ? s : "ended"));
        teardown();
        optsRef.current.onEnd?.();
      };
      sock.onerror = () => setError("The voice connection dropped. Check your connection and start again.");
      await new Promise<void>((ok, fail) => {
        sock.addEventListener("open", () => ok(), { once: true });
        sock.addEventListener("close", () => fail(new Error("The voice service refused the connection")), { once: true });
      });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      setError(name === "AudioLocked" ? null : ERRORS[name] ?? (e instanceof Error ? e.message : "Could not start the call"));
      setStatus(name === "AudioLocked" ? "idle" : "error");
      setMicWaiting(false);
      ws.current?.close();
      teardown();
    }
  }, [gate, onEvent, teardown]);

  const stop = useCallback(() => {
    send(JSON.stringify({ t: "finish" }));
    mic.current?.stop();
    // The server writes the summary (rehearse: feedback), then closes; force-close if it does not.
    const sock = ws.current;
    setTimeout(() => sock?.close(), optsRef.current.mode === "rehearse" ? 25_000 : 8000);
  }, []);

  const sendText = useCallback((text: string, as?: "user" | "official") => {
    send(JSON.stringify({ t: "text", text, ...(as ? { as } : {}) }));
  }, []);

  const setMuted = useCallback((m: boolean) => {
    mutedRef.current = m;
    setMutedState(m);
  }, []);

  /** Feeds a labelled test-kit line into the real pipeline in real time, and plays it aloud. */
  const playClip = useCallback(async (i: number) => {
    const who = TEST_LINES[i]?.who ?? "official";
    if (clipping.current || !ctx.current) return;
    clipping.current = true;
    setClipBusy(true);
    try {
      const res = await fetch(`/api/voice/clip?i=${i}&v=${TEST_LINES_VERSION}`);
      if (!res.ok) throw new Error("Could not load the test line");
      const pcm = await res.arrayBuffer();
      // Official lines are attributed to the official; the user's line goes through as microphone speech.
      if (who === "official") send(JSON.stringify({ t: "source", source: "clip" }));
      const tail = new ArrayBuffer(16000 * 2); // 1 s of silence closes the turn
      const all = [...frames(pcm), ...frames(tail)];
      player.current?.play(pcm, 16000);
      const t0 = performance.now();
      for (let k = 0; k < all.length; k++) {
        send(all[k]);
        const wait = t0 + (k + 1) * 80 - performance.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test official failed");
    } finally {
      send(JSON.stringify({ t: "source", source: "mic" }));
      clipping.current = false;
      setClipBusy(false);
    }
  }, []);

  const dismissDoc = useCallback((docId: string) => setDocs((d) => d.filter((x) => x.docId !== docId)), []);

  useEffect(() => () => {
    ws.current?.close();
    teardown();
  }, [teardown]);

  return { status, error, turns, partial, speaking, level, muted, metrics, coach, docs, captured, feedback, userName, lang, clipBusy, micWaiting, start, stop, sendText, setMuted, playClip, dismissDoc };
}
