/** What a person sees when speech recognition fails; provider details go to the server log only. */
export const ASR_USER_ERROR = "Speech recognition hit a problem. Tap the mic to try again, or type instead.";
export const ASR_RECONNECTING = "Reconnecting speech recognition…";

/** Server-side log line for a provider failure (Workers logs); never sent to the client. */
export function logAsrFailure(detail: unknown): void {
  // eslint-disable-next-line no-console -- Workers observability is the log sink
  console.warn(JSON.stringify({ at: "voice.asr", detail: String(detail).slice(0, 300) }));
}
