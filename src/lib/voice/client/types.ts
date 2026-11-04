/* Public shape of useAgentCall (the voice hook), kept apart so the hook stays small. */
import type { CapturedItem, CoachNote, DocCard, RehearseFeedback, ServerEvent, TurnMetric, VoiceMode, VoiceTurn } from "../protocol";

export type IntakeResult = Omit<Extract<ServerEvent, { t: "intake" }>, "t">;

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export interface AgentCallOptions {
  mode: VoiceMode;
  lang?: string;
  /** welcome: the server-generated opening line, spoken first. */
  script?: string;
  onEnd?: () => void;
}

export interface AgentCall {
  status: CallStatus;
  error: string | null;
  turns: VoiceTurn[];
  partial: string | null;
  /** Which half is hearing speech right now (counter): "user" = the user's language, "official" = Polish. */
  speaking: "user" | "official" | null;
  level: number;
  muted: boolean;
  metrics: TurnMetric[];
  coach: CoachNote[];
  docs: DocCard[];
  captured: CapturedItem[];
  feedback: RehearseFeedback | null;
  /** Intake mode: what the first spoken words saved to the profile. */
  intake: IntakeResult | null;
  userName: string | null;
  lang: string;
  clipBusy: boolean;
  /** Waiting for the user to allow the microphone. */
  micWaiting: boolean;
  start(): Promise<void>;
  stop(): void;
  sendText(text: string, as?: "user" | "official"): void;
  setMuted(m: boolean): void;
  playClip(i: number): Promise<void>;
  dismissDoc(docId: string): void;
}
