/*
 * Local speech-activity detector on the PCM the session already holds (16-bit LE mono, 16 kHz). The ElevenLabs
 * realtime API commits a transcript only after its own silence window, so this reports "speech ended" a little
 * earlier, which is what lets a turn start on the last partial transcript instead of waiting for the final.
 */

export interface VadOptions {
  /** RMS (of 32768) above which a frame counts as speech. */
  threshold?: number;
  /** Silence after speech that ends it. */
  endSilenceMs?: number;
  /** Speech shorter than this is a click, not a start. */
  minSpeechMs?: number;
}

export interface VadEvent {
  type: "start" | "end";
  /** For "end": how long the silence that ended it has lasted (the speech really ended this long ago). */
  silenceMs: number;
}

const rms = (pcm: ArrayBuffer): number => {
  const n = pcm.byteLength >> 1;
  if (!n) return 0;
  const v = new DataView(pcm);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = v.getInt16(i * 2, true);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
};

export class SpeechDetector {
  private speaking = false;
  private speechMs = 0;
  private silenceMs = 0;
  private readonly threshold: number;
  private readonly endSilenceMs: number;
  private readonly minSpeechMs: number;

  constructor(o: VadOptions = {}) {
    this.threshold = o.threshold ?? 500;
    this.endSilenceMs = o.endSilenceMs ?? 400;
    this.minSpeechMs = o.minSpeechMs ?? 120;
  }

  /** Feeds one frame; returns the transition it caused, if any. */
  push(pcm: ArrayBuffer): VadEvent | null {
    const ms = pcm.byteLength / 32;
    if (rms(pcm) >= this.threshold) {
      this.silenceMs = 0;
      this.speechMs += ms;
      if (!this.speaking && this.speechMs >= this.minSpeechMs) {
        this.speaking = true;
        return { type: "start", silenceMs: 0 };
      }
      return null;
    }
    this.silenceMs += ms;
    if (!this.speaking) {
      this.speechMs = 0;
      return null;
    }
    if (this.silenceMs >= this.endSilenceMs) {
      const silenceMs = this.silenceMs;
      this.reset();
      return { type: "end", silenceMs };
    }
    return null;
  }

  get active(): boolean {
    return this.speaking;
  }

  reset(): void {
    this.speaking = false;
    this.speechMs = 0;
    this.silenceMs = 0;
  }
}
