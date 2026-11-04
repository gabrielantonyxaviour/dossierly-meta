import { api } from "@/lib/client/api";
import type { ListenHandle, ListenHandlers } from "./types";

/** Languages sent to Muse Voice Transcribe; the rest stay on the browser's recognition. */
export const VOICE_LANGS = new Set(["pl", "en", "uk", "hi", "ta"]);
export const VOICE_MODEL = "muse-voice-transcribe-1.0";

export type AsrDetail = { model: string; ms?: number; translation?: string; translationModel?: string };

const TARGET_RATE = 16000;
const MAX_SECONDS = 22; // keeps the upload under the server's size limit

function downsample(chunks: Float32Array[], rate: number): Int16Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const input = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { input.set(c, o); o += c.length; }
  const ratio = rate / TARGET_RATE;
  const out = new Int16Array(Math.floor(total / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

function wavBase64(pcm: Int16Array): string {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, TARGET_RATE, true);
  v.setUint32(28, TARGET_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function transcribe(b64: string, lang: string, translate: "en" | "pl" | undefined, handlers: ListenHandlers, onDetail?: (d: AsrDetail) => void) {
  handlers.onInterim("Transcribing with Muse Voice…");
  const r = await api.asrTranscribe(b64, lang as "pl" | "en" | "uk" | "hi" | "ta", translate);
  if (!r.ok) return handlers.onError("network");
  onDetail?.({ model: r.data.model ?? VOICE_MODEL, ms: r.data.ms, translation: r.data.translation, translationModel: r.data.translationModel });
  handlers.onFinal((r.data.text ?? "").trim());
}

/**
 * Tap-to-talk capture for Muse Voice Transcribe: the microphone is recorded in the browser and sent once as a 16 kHz
 * WAV to the app, which transcribes it in the Worker and discards it; the app keeps the text, never the audio.
 */
export function listenVoice(lang: string, handlers: ListenHandlers, opts: { translate?: "en" | "pl"; onDetail?: (d: AsrDetail) => void } = {}): ListenHandle {
  const chunks: Float32Array[] = [];
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    const rate = ctx?.sampleRate ?? 48000;
    void ctx?.close();
    const pcm = downsample(chunks, rate);
    if (pcm.length < TARGET_RATE * 0.3) return handlers.onError("no-speech");
    void transcribe(wavBase64(pcm), lang, opts.translate, handlers, opts.onDetail);
  };

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => { if (!stopped) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(node);
      node.connect(ctx.destination);
      handlers.onInterim("Listening… (Muse Voice)");
      timer = setTimeout(finish, MAX_SECONDS * 1000);
    } catch (e) {
      stopped = true;
      handlers.onError((e as Error)?.name === "NotAllowedError" ? "not-allowed" : "unsupported");
    }
  })();

  return { stop: finish };
}
