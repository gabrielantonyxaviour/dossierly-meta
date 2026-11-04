/* Where a session's events and speech go: a browser WebSocket (PCM 16 kHz) or a Twilio Media Stream (μ-law 8 kHz). */
import type { ServerEvent } from "../protocol";
import type { TtsFormat } from "./tts";

export interface Transport {
  readonly format: TtsFormat;
  readonly kind: "browser" | "twilio";
  event(ev: ServerEvent): void;
  audio(bytes: Uint8Array): void;
  /** Drop speech already queued on the far side (barge-in). */
  clear(): void;
  close(code?: number, reason?: string): void;
}

type Sock = { send(data: string | ArrayBuffer): void; close(code?: number, reason?: string): void };

export class BrowserTransport implements Transport {
  readonly format = "pcm_16000" as const;
  readonly kind = "browser" as const;
  private carry: number | null = null;

  constructor(private ws: Sock) {}

  event(ev: ServerEvent): void {
    try {
      this.ws.send(JSON.stringify(ev));
    } catch {
      /* socket gone */
    }
  }

  /** PCM16 must stay sample-aligned across network chunks: carry a trailing odd byte. */
  audio(bytes: Uint8Array): void {
    let b = bytes;
    if (this.carry !== null) {
      const n = new Uint8Array(b.byteLength + 1);
      n[0] = this.carry;
      n.set(b, 1);
      b = n;
      this.carry = null;
    }
    if (b.byteLength % 2) {
      this.carry = b[b.byteLength - 1];
      b = b.subarray(0, b.byteLength - 1);
    }
    if (!b.byteLength) return;
    try {
      this.ws.send(b.slice().buffer as ArrayBuffer);
    } catch {
      /* socket gone */
    }
  }

  clear(): void {
    this.carry = null;
    this.event({ t: "stop_audio" });
  }

  close(code = 1000, reason = "done"): void {
    try {
      this.ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }
}

export class TwilioTransport implements Transport {
  readonly format = "ulaw_8000" as const;
  readonly kind = "twilio" as const;
  streamSid: string | null = null;
  /** Events a phone cannot show are kept for the call summary instead. */
  readonly log: ServerEvent[] = [];

  constructor(private ws: Sock) {}

  event(ev: ServerEvent): void {
    if (ev.t === "turn" || ev.t === "captured" || ev.t === "metric") this.log.push(ev);
  }

  audio(bytes: Uint8Array): void {
    if (!this.streamSid) return;
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    try {
      this.ws.send(JSON.stringify({ event: "media", streamSid: this.streamSid, media: { payload: btoa(bin) } }));
    } catch {
      /* gone */
    }
  }

  /** Twilio replays a mark when everything before it has played. */
  mark(name: string): void {
    if (!this.streamSid) return;
    try {
      this.ws.send(JSON.stringify({ event: "mark", streamSid: this.streamSid, mark: { name } }));
    } catch {
      /* gone */
    }
  }

  clear(): void {
    if (!this.streamSid) return;
    try {
      this.ws.send(JSON.stringify({ event: "clear", streamSid: this.streamSid }));
    } catch {
      /* gone */
    }
  }

  close(code = 1000, reason = "done"): void {
    try {
      this.ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }
}

/* ---------- G.711 μ-law (Twilio) → PCM16 16 kHz (Meta ASR) ---------- */

function ulawToLinear(u: number): number {
  u = ~u & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

const ULAW_TABLE = Int16Array.from({ length: 256 }, (_, i) => ulawToLinear(i));

/** Decodes 8 kHz μ-law and upsamples ×2 by linear interpolation into 16 kHz PCM16 LE. */
export function ulaw8kToPcm16k(ulaw: Uint8Array): ArrayBuffer {
  const out = new Int16Array(ulaw.length * 2);
  for (let i = 0; i < ulaw.length; i++) {
    const a = ULAW_TABLE[ulaw[i]];
    const b = i + 1 < ulaw.length ? ULAW_TABLE[ulaw[i + 1]] : a;
    out[i * 2] = a;
    out[i * 2 + 1] = (a + b) >> 1;
  }
  return out.buffer;
}
