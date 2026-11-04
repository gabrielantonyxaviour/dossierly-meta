import { z } from "zod";
import type { Profile } from "../case/types";

/*
 * Wire contract between the browser (or Twilio) and the VoiceDO relay.
 * Binary frames client→server: 16-bit LE mono PCM at 16 kHz, ~80 ms each.
 * Binary frames server→client: 16-bit LE mono PCM at 16 kHz for the utterance announced by the last `audio_start`.
 */

export const VOICE_MODES = ["welcome", "agent", "counter", "rehearse", "intake"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

/** Languages Muse Voice Transcribe hears (no Ukrainian/Russian) that the app offers for voice. */
export const VOICE_LANGS = ["en", "hi", "ta", "bn", "te", "mr", "kn", "tl", "vi", "tr", "ar", "es"] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number] | "pl";

export const LANG_NAME: Record<string, string> = {
  pl: "Polish", en: "English", hi: "Hindi", ta: "Tamil", bn: "Bengali", te: "Telugu", mr: "Marathi", kn: "Kannada",
  tl: "Tagalog", vi: "Vietnamese", tr: "Turkish", ar: "Arabic", es: "Spanish",
};

export const PCM_RATE = 16_000;
/** 80 ms of 16 kHz mono 16-bit audio. */
export const FRAME_BYTES = 2560;

export type Who = "agent" | "user" | "official";

export interface VoiceTurn {
  id: string;
  who: Who;
  /** What was said, in the speaker's language. */
  text: string;
  lang: string;
  /** The rendering for the other side (counter/rehearse), when there is one. */
  translation?: string;
  translationLang?: string;
  /** Turn arrived through the test-official clip or typed text rather than the microphone. */
  via?: "mic" | "clip" | "text" | "phone";
  /** Still streaming. */
  partial?: boolean;
}

export interface TurnMetric {
  turnId: string;
  /** ASR speechEnd → speechComplete (transcript ready). */
  asrMs?: number;
  /** Transcript ready → first spoken sentence from Spark. */
  llmMs?: number;
  /** First sentence → first TTS audio byte. */
  ttsMs?: number;
  /** Speech end (or transcript ready for typed/clip input) → first audio byte sent. */
  totalMs?: number;
  model?: string;
}

export interface CoachNote {
  turnId: string;
  /** Short line to the user in their language: what the official actually needs. */
  toUser: string;
  /** What Dossierly said to the official in Polish instead of the literal words. */
  toOfficial?: string;
  toOfficialGloss?: string;
}

export interface DocCard {
  turnId: string;
  docId: string;
  title: string;
  kind: string;
  /** Polish caption for the official. */
  captionPl: string;
  fields: Record<string, string>;
  /** The stored file itself (a page image or PDF from the case), served by /api/case/documents/:id/file. */
  file?: { url: string; type: "image" | "pdf" } | null;
  /** The full Polish text of a letter Dossierly drafted (no stored file). */
  textPl?: string;
}

export interface CapturedItem {
  turnId: string;
  kind: "task" | "deadline" | "reminder";
  id: string;
  title: string;
  /** Short status line, e.g. "KPA art. 41 · draft ready". */
  detail?: string;
  dueDate: string | null;
}

export interface RehearseFeedback {
  score: number;
  summary: string;
  went_well: string[];
  practise: Array<{ phrase_pl: string; meaning: string }>;
}

export type ServerEvent =
  | { t: "ready"; sessionId: string; mode: VoiceMode; userName: string | null; lang: string; asr: boolean }
  | { t: "listening"; on: boolean }
  | { t: "asr"; phase: "start" | "partial" | "end"; text?: string }
  | { t: "turn"; turn: VoiceTurn }
  | { t: "audio_start"; id: string; rate: number; side: "user" | "official" }
  | { t: "audio_end"; id: string }
  | { t: "stop_audio" }
  | { t: "coach"; note: CoachNote }
  | { t: "doc"; doc: DocCard }
  | { t: "captured"; item: CapturedItem }
  | { t: "metric"; metric: TurnMetric }
  | { t: "intake"; profile: Profile; firstName: string | null; language: string }
  | { t: "feedback"; feedback: RehearseFeedback }
  | { t: "ended"; reason: string }
  | { t: "error"; error: string; code?: string; fatal?: boolean }
  | { t: "debug"; info: Record<string, unknown> };

export const clientEventSchema = z.discriminatedUnion("t", [
  /** Typed input, or the speaker for the next clip frames. */
  z.object({ t: z.literal("text"), text: z.string().trim().min(1).max(1000), as: z.enum(["user", "official"]).optional() }),
  /** The following binary frames come from the labelled test-official clip, not the microphone. */
  z.object({ t: z.literal("source"), source: z.enum(["mic", "clip"]) }),
  /** Local playback finished (or was cut); lets the server time barge-in and echo gating. */
  z.object({ t: z.literal("played"), id: z.string().max(80) }),
  z.object({ t: z.literal("interrupt") }),
  z.object({ t: z.literal("finish") }),
  z.object({ t: z.literal("debug") }),
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;
