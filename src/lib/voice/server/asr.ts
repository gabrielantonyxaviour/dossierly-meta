/*
 * Muse Voice Transcribe realtime client for the Workers runtime. The key travels in the first JSON frame, so this only
 * ever runs server-side (inside VoiceDO). Audio in: 16-bit LE mono PCM at 16 kHz, paced ~real time by the caller.
 */
import { resolveRole, type EnvLike } from "../../model/roles";

export interface AsrHandlers {
  onSpeechStart(): void;
  onPartial(text: string): void;
  /** audioMs: position in the streamed audio where speech ended, when the service reports it. */
  onSpeechEnd(audioMs: number | null): void;
  onFinal(text: string, turnId: string): void;
  onSpeaker?(label: string): void;
  onError(message: string): void;
  onClose(): void;
}

export interface AsrOptions {
  mode?: "ENDPOINTING" | "DIARIZATION" | "PUSH_TO_TALK";
  languageBias: string[];
  keywords: string[];
}

type WS = WebSocket & { accept?: () => void };

export class MetaAsr {
  private ws: WS | null = null;
  private closed = false;
  private ready = false;
  private queue: ArrayBuffer[] = [];
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
    const cfg = resolveRole("asr", this.env);
    if (!cfg.apiKey) throw new Error("Speech recognition is not configured");
    this.closed = false;
    this.ready = false;
    this.queue = [];
    this.sentMs = 0;
    const base = cfg.baseUrl.replace(/^wss:/, "https:");
    const res = await fetch(`${base}/asr/realtime?sessionId=${crypto.randomUUID()}`, { headers: { Upgrade: "websocket" } });
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
    ws.send(JSON.stringify({
      authorization: { accessToken: `Bearer ${cfg.apiKey}` },
      audioEncoding: "PCM_16KHZ",
      model: cfg.model,
      mode: this.opts.mode ?? "ENDPOINTING",
      keywords: this.opts.keywords.filter((k) => k.length <= 30).slice(0, 40),
      languageBias: this.opts.languageBias,
    }));
  }

  private onMessage(data: unknown): void {
    this.stats.received++;
    if (typeof data !== "string") {
      this.stats.last = `binary ${(data as ArrayBuffer)?.byteLength ?? "?"}`;
      return;
    }
    if (!data.includes("audioProgress")) this.stats.last = data.slice(0, 200);
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(data);
    } catch {
      return;
    }
    const type = e.type as string | undefined;
    const text = (typeof e.transcript === "string" ? e.transcript : typeof e.text === "string" ? e.text : "").trim();
    if (!this.ready && (e.sessionId || type === "speechStart" || type === "transcript")) {
      this.ready = true;
      for (const f of this.queue.splice(0)) this.ws?.send(f);
      if (!type) return;
    }
    if (type === "speechStart") this.h.onSpeechStart();
    else if (type === "transcript") {
      if (text) this.h.onPartial(text);
    }
    else if (type === "speechEnd") this.h.onSpeechEnd(typeof e.audioProcessedMs === "number" ? e.audioProcessedMs : null);
    else if (type === "speechComplete") {
      if (text) this.h.onFinal(text, String(e.turnId ?? crypto.randomUUID()));
    }
    else if (type === "speaker" && typeof e.label === "string") this.h.onSpeaker?.(e.label);
    else if (type === "error") this.h.onError(typeof e.message === "string" ? e.message : "Speech recognition error");
  }

  send(pcm: ArrayBuffer): void {
    if (!this.ws || this.closed) return;
    this.sentMs += pcm.byteLength / 32;
    if (!this.ready) {
      if (this.queue.length < 40) this.queue.push(pcm);
      else this.stats.dropped++;
      return;
    }
    try {
      this.ws.send(pcm);
      this.stats.sent++;
    } catch {
      this.finish();
    }
  }

  close(): void {
    if (!this.ws || this.closed) return;
    try {
      this.ws.send(JSON.stringify({ type: "endStream" }));
      this.ws.close(1000, "done");
    } catch {
      /* already gone */
    }
    this.finish();
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.h.onClose();
  }
}
