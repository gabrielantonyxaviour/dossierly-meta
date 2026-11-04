import type { VoiceSession, Utterance } from "../session";
import { AgentMode } from "./agent";
import { CounterMode } from "./counter";
import { RehearseMode } from "./rehearse";

export interface ModeHandler {
  /** New speech cuts the agent off mid-sentence (conversational modes only). */
  readonly bargeIn: boolean;
  open(): Promise<void>;
  utterance(u: Utterance, signal: AbortSignal): Promise<void>;
  /** Writes the session summary to the case timeline. */
  finish(): Promise<void>;
}

export function modeHandler(s: VoiceSession): ModeHandler {
  if (s.mode === "counter") return new CounterMode(s);
  if (s.mode === "rehearse") return new RehearseMode(s);
  return new AgentMode(s);
}
