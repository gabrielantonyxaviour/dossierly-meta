/* Honest per-turn latency: speech end → transcript (asr) → first sentence (llm) → first audio byte (tts). */
import type { TurnMetric } from "../protocol";

export type Metric = TurnMetric & { t0: number };

export class TurnClock {
  private m = new Map<string, Metric>();

  get(id: string): Metric | undefined {
    return this.m.get(id);
  }

  set(id: string, metric: Metric): void {
    this.m.set(id, metric);
  }

  start(id: string): Metric {
    const m = { turnId: id, t0: Date.now() };
    this.m.set(id, m);
    return m;
  }

  /** The first spoken sentence of a turn is ready (before TTS). */
  sentenceReady(id: string, model?: string): void {
    const m = this.m.get(id);
    if (!m || m.llmMs !== undefined) return;
    m.llmMs = Date.now() - m.t0 - (m.asrMs ?? 0);
    if (model) m.model = model;
    m.ttsMs = -Date.now();
  }

  /** First audio byte of the turn left for the caller. Returns the finished metric once. */
  firstAudio(id: string): TurnMetric | null {
    const m = this.m.get(id);
    if (!m || m.totalMs !== undefined) return null;
    const now = Date.now();
    if (m.ttsMs !== undefined && m.ttsMs < 0) m.ttsMs = now + m.ttsMs;
    m.totalMs = now - m.t0;
    const { t0: _t0, ...metric } = m;
    void _t0;
    return metric;
  }
}
