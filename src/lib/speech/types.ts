export interface ListenHandlers {
  onInterim(text: string): void;
  /** Called once after stop() with the full transcript (may be empty). */
  onFinal(text: string): void;
  onError(code: "not-allowed" | "no-speech" | "network" | "unsupported" | "other"): void;
}

export interface ListenHandle {
  stop(): void;
}

/**
 * Swap point for speech. Muse Voice Transcribe (src/lib/speech/metavoice.ts) handles pl/en/uk/hi/ta when a model key is
 * configured; the browser Web Speech API covers the rest.
 */
export interface SpeechProvider {
  readonly id: string;
  canListen(): boolean;
  canSpeak(): boolean;
  listen(lang: string, handlers: ListenHandlers): ListenHandle | null;
  speak(text: string, lang: string): Promise<void>;
  cancel(): void;
}
