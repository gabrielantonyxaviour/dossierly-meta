/* Browser audio for voice sessions: one AudioContext for mic capture (with echo cancellation) and PCM playback. */

export const FRAME_SAMPLES = 1280; // 80 ms at 16 kHz

export class Mic {
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;

  constructor(private ctx: AudioContext) {}

  async start(onFrame: (pcm: ArrayBuffer, level: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    await this.ctx.audioWorklet.addModule("/voice/mic-worklet.js");
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "mic-capture");
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => onFrame(e.data.pcm, e.data.level);
    this.src.connect(this.node);
    // Worklets only run when connected to the graph; a muted gain keeps it silent.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink).connect(this.ctx.destination);
  }

  stop(): void {
    this.src?.disconnect();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = this.node = this.src = null;
  }
}

/** Gapless scheduler for raw PCM16 chunks; reports when each utterance has finished playing. */
export class Player {
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private ends = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  current: string | null = null;

  constructor(private ctx: AudioContext, private onDone: (id: string) => void, private onIdle: () => void) {}

  get active(): boolean {
    return this.sources.size > 0 || this.ctx.currentTime < this.next;
  }

  play(pcm: ArrayBuffer, rate: number): void {
    const n = Math.floor(pcm.byteLength / 2);
    if (!n) return;
    const view = new DataView(pcm);
    const buf = this.ctx.createBuffer(1, n, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.04, this.next);
    src.start(at);
    this.next = at + buf.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (!this.active) this.onIdle();
    };
    this.watch();
  }

  /** Resolves once everything queued has played (or after timeoutMs), so a goodbye is not cut off. */
  drained(timeoutMs: number): Promise<void> {
    const until = Date.now() + timeoutMs;
    return new Promise((done) => {
      const check = () => (!this.active || Date.now() > until ? done() : setTimeout(check, 100));
      check();
    });
  }

  /** The utterance's last chunk has been queued: report when it has actually played out. */
  end(id: string): void {
    this.ends.set(id, this.next);
    this.watch();
  }

  private watch(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      for (const [id, at] of this.ends) {
        if (this.ctx.currentTime >= at) {
          this.ends.delete(id);
          this.onDone(id);
        }
      }
      if (!this.ends.size && !this.active && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 100);
  }

  flush(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* not started */
      }
    }
    this.sources.clear();
    this.next = 0;
    for (const id of this.ends.keys()) this.onDone(id);
    this.ends.clear();
  }
}

/** Splits a PCM16 buffer into 80 ms frames. */
export function frames(pcm: ArrayBuffer): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (let o = 0; o < pcm.byteLength; o += FRAME_SAMPLES * 2) out.push(pcm.slice(o, Math.min(pcm.byteLength, o + FRAME_SAMPLES * 2)));
  return out;
}
