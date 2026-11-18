/*
 * ElevenLabs Scribe realtime client for the Workers runtime (scribe_v3_live). It runs server-side inside VoiceDO, so
 * the API key travels in a header and never reaches a browser. Audio in: 16-bit LE mono PCM at 16 kHz as base64
 * `input_audio_chunk` JSON messages, paced ~real time by the caller. The server commits on silence
 * (commit_strategy=vad): `partial_transcript` events are captions and the early turn start, `committed_transcript`
 * is the final. Protocol: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
 */
import { resolveRole, type EnvLike } from "../../model/roles";
import { assertVoiceAllowed, bookAsrAudio, primeVoiceBudget } from "./meter";
import { SpeechDetector } from "./vad";

export interface AsrHandlers {
  onSpeechStart(): void;
  onPartial(text: string): void;
  /** audioMs: position in the streamed audio where speech ended, when known. */
  onSpeechEnd(audioMs: number | null): void;
  onFinal(text: string, turnId: string): void;
  onError(message: string): void;
  onClose(): void;
}

export interface AsrOptions {
  /** App language codes in priority order (pl, en, uk, hi, ta, ru ...). One code pins the language; several leave it to auto-detection. */
  languageBias: string[];
  keywords: string[];
}

type WS = WebSocket & { accept?: () => void };

/** Silence that makes ElevenLabs commit a transcript. */
export const VAD_SILENCE_SECS = 0.6;

/** The service takes ISO 639-1 codes, which are the app's codes. Unknown codes fall back to auto-detection. */
export function scribeLanguage(bias: string[]): string | null {
  const codes = [...new Set(bias.map((l) => l.trim().toLowerCase().split("-")[0]).filter((l) => /^[a-z]{2,3}$/.test(l)))];
  return codes.length === 1 ? codes[0] : null;
}

/** Keyterms: at most 50 characters and 5 words, none of < > { } [ ] \ (ElevenLabs rejects them). */
export function scribeKeyterms(keywords: string[]): string[] {
  const ok = (k: string) => k.length >= 2 && k.length <= 50 && k.split(/\s+/).length <= 5 && !/[<>{}[\]\\]/.test(k);
  return [...new Set(keywords.map((k) => k.trim()).filter(ok))].slice(0, 40);
}

export function realtimeUrl(base: string, model: string, opts: AsrOptions): string {
  const q = new URLSearchParams({ model_id: model, audio_format: "pcm_16000", commit_strategy: "vad", vad_silence_threshold_secs: String(VAD_SILENCE_SECS) });
  const lang = scribeLanguage(opts.languageBias);
  if (lang) q.set("language_code", lang);
  for (const k of scribeKeyterms(opts.keywords)) q.append("keyterms", k);
  return `${base.replace(/^wss:/, "https:")}/v1/speech-to-text/realtime?${q}`;
}

function toBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Server messages that end the stream (the service closes it) versus warnings that leave it running. */
const FATAL = new Set(["auth_error", "quota_exceeded", "unaccepted_terms", "session_time_limit_exceeded", "resource_exhausted", "queue_overflow", "transcriber_error"]);
const SOFT = new Set(["commit_throttled", "insufficient_audio_activity", "warning", "chunk_size_exceeded"]);

export class ElevenAsr {
  private ws: WS | null = null;
  private closed = false;
  private ready = false;
  private queue: ArrayBuffer[] = [];
  private vad = new SpeechDetector();
  private started = false;
  private ended = false;
  /** Diagnostics for preview debugging (never includes audio or keys). */
  readonly stats = { sent: 0, dropped: 0, received: 0, last: "" };
  /** Milliseconds of audio handed to the service so far (16 kHz mono 16-bit = 32 bytes per ms). */
  sentMs = 0;

  constructor(private env: EnvLike, private opts: AsrOptions, private h: AsrHandlers) {}

  get state(): string {
    return `${this.closed ? "closed" : this.ready ? "ready" : this.ws ? "handshaking" : "none"} q${this.queue.length}`;
  }

  get isOpen(): boolean {
    return !!this.ws && !this.closed;
  }

  async connect(): Promise<void> {
    const cfg = resolveRole("asr", this.env); // ElevenLabs for every origin; never Meta
    if (!cfg.apiKey) throw new Error("Speech recognition is not configured");
    assertVoiceAllowed(this.env);
    void primeVoiceBudget(this.env);
    this.closed = false;
    this.ready = false;
    this.queue = [];
    this.sentMs = 0;
    this.vad.reset();
    this.started = this.ended = false;
    const res = await fetch(realtimeUrl(cfg.baseUrl, cfg.model, this.opts), { headers: { Upgrade: "websocket", "xi-api-key": cfg.apiKey } });
    const ws = (res as Response & { webSocket?: WS | null }).webSocket;
    if (!ws) throw new Error(`Speech service refused the connection (${res.status})`);
    ws.accept?.();
    this.ws = ws;
    ws.addEventListener("message", (ev: MessageEvent) => this.onMessage(ev.data));
    ws.addEventListener("close", (ev: CloseEvent) => {
      this.stats.last = `close ${ev.code} ${ev.reason}`.slice(0, 200);
      this.finish();
    });
    ws.addEventListener("error", (ev: Event) => {
      this.stats.last = `error ${(ev as ErrorEvent).message ?? ""}`.slice(0, 200);
      this.finish();
    });
  }

  private flush(): void {
    this.ready = true;
    for (const f of this.queue.splice(0)) this.sendChunk(f);
  }

  private onMessage(data: unknown): void {
    this.stats.received++;
    if (typeof data !== "string") return;
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(data);
    } catch {
      return;
    }
    const type = String(e.message_type ?? e.type ?? "");
    const text = typeof e.text === "string" ? e.text.trim() : "";
    if (type !== "partial_transcript") this.stats.last = data.slice(0, 200);
    if (type === "session_started") return this.flush();
    if (!this.ready && type) this.flush();
    if (type === "partial_transcript") {
      if (!text) return;
      this.startSpeech();
      this.h.onPartial(text);
    } else if (type === "committed_transcript") {
      if (text) {
        this.startSpeech();
        this.endSpeech(null);
        this.h.onFinal(text, crypto.randomUUID());
      }
      this.started = this.ended = false;
    } else if (FATAL.has(type)) {
      this.h.onError(typeof e.error === "string" ? e.error : typeof e.message === "string" ? e.message : "Speech recognition error");
    } else if (type && !SOFT.has(type) && /error|invalid|limit|rate_limited/.test(type)) {
      this.h.onError(typeof e.error === "string" ? e.error : "Speech recognition error");
    }
  }

  private startSpeech(): void {
    if (this.started) return;
    this.started = true;
    this.ended = false;
    this.h.onSpeechStart();
  }

  private endSpeech(audioMs: number | null): void {
    if (this.ended || !this.started) return;
    this.ended = true;
    this.h.onSpeechEnd(audioMs);
  }

  send(pcm: ArrayBuffer): void {
    if (!this.ws || this.closed) return;
    this.sentMs += pcm.byteLength / 32;
    const ev = this.vad.push(pcm);
    if (ev?.type === "start") {
      if (this.ended) this.started = false; // a new burst before the previous commit arrived
      this.startSpeech();
    }
    else if (ev?.type === "end") this.endSpeech(this.sentMs - ev.silenceMs);
    if (!this.ready) {
      if (this.queue.length < 40) this.queue.push(pcm);
      else this.stats.dropped++;
      return;
    }
    this.sendChunk(pcm);
  }

  private sendChunk(pcm: ArrayBuffer): void {
    try {
      this.ws?.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: toBase64(pcm), commit: false, sample_rate: 16000 }));
      this.stats.sent++;
    } catch {
      this.finish();
    }
  }

  close(): void {
    if (!this.ws || this.closed) return;
    try {
      this.ws.close(1000, "done");
    } catch {
      /* already gone */
    }
    this.finish();
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    void bookAsrAudio(this.env, this.sentMs);
    this.h.onClose();
  }
}
