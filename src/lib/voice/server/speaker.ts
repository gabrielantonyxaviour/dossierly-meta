/*
 * Ordered speech output. Each sentence's TTS request starts the moment it is queued (prefetch), while playback to the
 * transport stays strictly in order, so sentence 2 is usually ready before sentence 1 finishes streaming.
 */
import { speak, type VoiceName } from "./tts";
import type { Transport } from "./transport";

interface Clip {
  utterance: string;
  side: "user" | "official";
  chunks: Uint8Array[];
  done: boolean;
  failed: boolean;
  wake: (() => void) | null;
  gen: number;
  end?: boolean;
}

export interface SpeakHooks {
  /** First audio byte of an utterance went out. */
  onFirstAudio?(utterance: string): void;
  onError?(message: string): void;
}

export class Speaker {
  private queue: Clip[] = [];
  private running = false;
  private abort = new AbortController();
  private open = new Set<string>();
  private started = new Set<string>();
  private gen = 0;
  /** Utterances whose audio_end was sent; the client reports back with `played`. */
  speaking = false;

  constructor(private apiKey: string, private t: Transport, private hooks: SpeakHooks = {}, private model?: string) {}

  say(utterance: string, text: string, opts: { lang: string; voice?: VoiceName; side: "user" | "official" }): void {
    const clip: Clip = { utterance, side: opts.side, chunks: [], done: false, failed: false, wake: null, gen: this.gen };
    this.queue.push(clip);
    const signal = this.abort.signal;
    void (async () => {
      try {
        for await (const c of speak(this.apiKey, { text, lang: opts.lang, voice: opts.voice, format: this.t.format, signal, model: this.model })) {
          clip.chunks.push(c);
          clip.wake?.();
        }
      } catch (e) {
        if (!signal.aborted) {
          clip.failed = true;
          this.hooks.onError?.(e instanceof Error ? e.message : "Speech output failed");
        }
      } finally {
        clip.done = true;
        clip.wake?.();
      }
    })();
    void this.pump();
  }

  /** Marks the end of an utterance (all its sentences queued). */
  end(utterance: string): void {
    this.queue.push({ utterance, side: "user", chunks: [], done: true, failed: false, wake: null, gen: this.gen, end: true });
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const clip = this.queue[0];
        if (clip.end) {
          this.queue.shift();
          if (this.open.delete(clip.utterance)) this.t.event({ t: "audio_end", id: clip.utterance });
          continue;
        }
        if (!this.open.has(clip.utterance)) {
          this.open.add(clip.utterance);
          this.speaking = true;
          this.t.event({ t: "audio_start", id: clip.utterance, rate: this.t.format === "pcm_16000" ? 16000 : 8000, side: clip.side });
        }
        for (;;) {
          if (clip.gen !== this.gen) break;
          while (clip.chunks.length) {
            const c = clip.chunks.shift()!;
            if (!this.started.has(clip.utterance)) {
              this.started.add(clip.utterance);
              this.hooks.onFirstAudio?.(clip.utterance);
            }
            this.t.audio(c);
          }
          if (clip.done) break;
          await new Promise<void>((r) => (clip.wake = r));
          clip.wake = null;
        }
        if (this.queue[0] === clip) this.queue.shift();
      }
    } finally {
      this.running = false;
    }
  }

  /** Barge-in: stop generating and drop everything queued, locally and on the far side. */
  cut(): void {
    this.gen++;
    this.abort.abort();
    this.abort = new AbortController();
    for (const c of this.queue) c.wake?.();
    this.queue = [];
    for (const u of this.open) this.t.event({ t: "audio_end", id: u });
    this.open.clear();
    this.speaking = false;
    this.t.clear();
  }

  get busy(): boolean {
    return this.queue.length > 0;
  }
}
