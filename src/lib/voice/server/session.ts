/*
 * One live voice session (inside VoiceDO): audio in → Meta realtime ASR → mode handler (Spark) → ElevenLabs → audio out.
 * Mode handlers live in ./modes; this file owns the plumbing, turn ordering, barge-in and latency metrics.
 */
import { caseContext } from "../../case/context";
import type { CaseSnapshot } from "../../case/types";
import { clientEventSchema, type ServerEvent, type TurnMetric, type VoiceTurn } from "../protocol";
import type { Ticket } from "../token";
import { MetaAsr } from "./asr";
import { VoiceCase, type CaseNamespace } from "./case";
import { Speaker } from "./speaker";
import type { Transport } from "./transport";
import { caseKeywords, shortId } from "./util";
import { modeHandler, type ModeHandler } from "./modes";

export type VoiceEnv = Record<string, unknown> & { CASE_DO?: CaseNamespace; ELEVENLABS_API_KEY?: string; MODEL_API_KEY?: string };

export type Via = NonNullable<VoiceTurn["via"]>;

export interface Utterance {
  id: string;
  text: string;
  via: Via;
  /** Forced attribution (typed text or the test-official clip). */
  as?: "user" | "official";
  metric: TurnMetric & { t0: number };
}

export class VoiceSession {
  readonly case: VoiceCase;
  readonly speaker: Speaker;
  readonly lang: string;
  snapshot: CaseSnapshot | null = null;
  caseText = "";
  private asr: MetaAsr | null = null;
  private handler!: ModeHandler;
  private chain: Promise<void> = Promise.resolve();
  private turnAbort: AbortController | null = null;
  private source: "mic" | "clip" = "mic";
  /** Source when the current speech started: the clip may end before its transcript arrives. */
  private speechSource: "mic" | "clip" = "mic";
  private speechEndAt: number | null = null;
  private metrics = new Map<string, TurnMetric & { t0: number }>();
  private closed = false;
  readonly turns: VoiceTurn[] = [];

  constructor(readonly env: VoiceEnv, readonly ticket: Ticket, readonly t: Transport, private onClose: () => void) {
    this.lang = ticket.l;
    this.case = new VoiceCase(env.CASE_DO, ticket.u);
    this.speaker = new Speaker(String(env.ELEVENLABS_API_KEY ?? ""), t, {
      onFirstAudio: (u) => this.firstAudio(u),
      onError: (m) => this.emit({ t: "error", error: m, code: "tts" }),
    }, typeof env.ELEVENLABS_TTS_MODEL === "string" ? env.ELEVENLABS_TTS_MODEL : undefined);
  }

  get mode() {
    return this.ticket.m;
  }

  emit(ev: ServerEvent): void {
    if (ev.t === "turn") {
      const i = this.turns.findIndex((x) => x.id === ev.turn.id);
      if (i >= 0) this.turns[i] = ev.turn;
      else this.turns.push(ev.turn);
    }
    this.t.event(ev);
  }

  async start(): Promise<void> {
    try {
      this.snapshot = await this.case.snapshot();
      this.caseText = caseContext(this.snapshot);
    } catch {
      this.caseText = "CASE: not available right now.";
    }
    this.handler = modeHandler(this);
    const bias = this.mode === "counter" || this.mode === "rehearse" ? ["pl", this.lang] : this.lang === "pl" ? ["pl"] : [this.lang, "pl"];
    this.asr = new MetaAsr(this.env, { languageBias: [...new Set(bias)], keywords: caseKeywords(this.snapshot) }, {
      onSpeechStart: () => {
        this.speechSource = this.source;
        this.emit({ t: "asr", phase: "start" });
      },
      onPartial: (text) => this.onPartial(text),
      onSpeechEnd: (audioMs) => {
        // True speech end = now minus the audio we have already streamed past it.
        const lag = audioMs !== null && this.asr ? Math.max(0, this.asr.sentMs - audioMs) : 0;
        this.speechEndAt = Date.now() - lag;
        this.emit({ t: "asr", phase: "end" });
      },
      onFinal: (text) => this.onFinal(text),
      onError: (m) => this.emit({ t: "error", error: m, code: "asr" }),
      onClose: () => {
        if (!this.closed) this.emit({ t: "error", error: `Speech recognition reconnecting (${this.asr?.stats.last ?? ""})`, code: "asr_closed" });
        if (!this.closed) void this.reconnectAsr();
      },
    });
    let asrOk = true;
    this.lastAudioAt = Date.now();
    this.startKeepalive();
    try {
      await this.asr.connect();
    } catch (e) {
      asrOk = false;
      this.emit({ t: "error", error: e instanceof Error ? e.message : "Speech recognition unavailable", code: "asr_unavailable" });
    }
    const name = this.snapshot?.profile.fullName ?? null;
    this.emit({ t: "ready", sessionId: this.ticket.s, mode: this.mode === "phone" ? "agent" : this.mode, userName: name, lang: this.lang, asr: asrOk });
    this.enqueue(() => this.handler.open());
  }

  private reconnects = 0;
  private async reconnectAsr(): Promise<void> {
    if (this.reconnects++ > 3 || !this.asr) return;
    await new Promise((r) => setTimeout(r, 500 * this.reconnects));
    try {
      await this.asr.connect();
    } catch {
      /* reported already */
    }
  }

  /** Partial transcript: captions, and barge-in for conversational modes. */
  private onPartial(text: string): void {
    this.emit({ t: "asr", phase: "partial", text });
    this.handler.partial?.(text);
    if (this.handler.bargeIn && this.speaker.speaking && text.split(/\s+/).length >= 2) this.interrupt();
  }

  private onFinal(text: string): void {
    const now = Date.now();
    const id = shortId();
    const metric = { turnId: id, t0: this.speechEndAt ?? now, asrMs: this.speechEndAt ? now - this.speechEndAt : undefined };
    this.speechEndAt = null;
    this.metrics.set(id, metric);
    const u: Utterance = { id, text, via: this.t.kind === "twilio" ? "phone" : this.speechSource, as: this.speechSource === "clip" ? "official" : undefined, metric };
    this.submit(u);
  }

  submit(u: Utterance): void {
    if (this.handler.bargeIn) {
      this.turnAbort?.abort();
      this.speaker.cut();
    }
    this.enqueue((signal) => this.handler.utterance(u, signal));
  }

  private enqueue(fn: (signal: AbortSignal) => Promise<void>): void {
    const ctl = new AbortController();
    this.chain = this.chain.then(async () => {
      if (this.closed || ctl.signal.aborted) return;
      this.turnAbort = ctl;
      try {
        await fn(ctl.signal);
      } catch (e) {
        if (!ctl.signal.aborted) this.emit({ t: "error", error: e instanceof Error ? e.message : "That turn failed", code: "turn_failed" });
      }
    });
    if (this.handler?.bargeIn) this.turnAbort = ctl;
  }

  interrupt(): void {
    this.turnAbort?.abort();
    this.speaker.cut();
  }

  /** Marks the moment the first spoken sentence of a turn is ready (before TTS). */
  sentenceReady(turnId: string, model?: string): void {
    const m = this.metrics.get(turnId);
    if (!m || m.llmMs !== undefined) return;
    m.llmMs = Date.now() - m.t0 - (m.asrMs ?? 0);
    if (model) m.model = model;
    m.ttsMs = -Date.now();
  }

  private firstAudio(utterance: string): void {
    const m = this.metrics.get(utterance);
    if (!m || m.totalMs !== undefined) return;
    const now = Date.now();
    if (m.ttsMs !== undefined && m.ttsMs < 0) m.ttsMs = now + m.ttsMs;
    m.totalMs = now - m.t0;
    const { t0: _t0, ...metric } = m;
    void _t0;
    this.emit({ t: "metric", metric });
  }

  newMetric(id: string): TurnMetric & { t0: number } {
    const m = { turnId: id, t0: Date.now() };
    this.metrics.set(id, m);
    return m;
  }

  onClientText(raw: string): void {
    let parsed;
    try {
      parsed = clientEventSchema.safeParse(JSON.parse(raw));
    } catch {
      return;
    }
    if (!parsed.success) return;
    const ev = parsed.data;
    if (ev.t === "source") this.source = ev.source;
    else if (ev.t === "interrupt") this.interrupt();
    else if (ev.t === "played") this.speaker.speaking = this.speaker.busy;
    else if (ev.t === "finish") void this.finish("user_ended");
    else if (ev.t === "debug" && this.env.APP_ENV !== "production") this.emit({ t: "debug", info: { asr: this.asr?.state, ...this.asr?.stats, audioIn: this.audioIn, source: this.source } });
    else if (ev.t === "text") {
      const id = shortId();
      this.submit({ id, text: ev.text, via: "text", as: ev.as, metric: this.newMetric(id) });
    }
  }

  private audioIn = 0;
  private lastAudioAt = 0;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  onAudio(pcm: ArrayBuffer): void {
    this.audioIn++;
    this.lastAudioAt = Date.now();
    this.asr?.send(pcm);
  }

  /** The speech service drops idle streams: when the caller's frames stall (mic prompt, muted tab), feed silence. */
  private startKeepalive(): void {
    this.keepalive = setInterval(() => {
      if (this.closed || !this.asr?.isOpen) return;
      if (Date.now() - this.lastAudioAt > 400) this.asr.send(new ArrayBuffer(400 * 32));
    }, 400);
  }

  async finish(reason: string): Promise<void> {
    if (this.closed) return;
    await this.chain.catch(() => undefined);
    try {
      await this.handler.finish();
    } catch {
      /* summary is best-effort */
    }
    this.close(reason);
  }

  close(reason = "closed"): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keepalive) clearInterval(this.keepalive);
    this.turnAbort?.abort();
    this.asr?.close();
    this.emit({ t: "ended", reason });
    this.t.close(1000, reason);
    this.onClose();
  }
}
