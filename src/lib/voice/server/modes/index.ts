import type { VoiceSession, Utterance } from "../session";
import { AgentMode } from "./agent";
import { CounterMode } from "./counter";
import { IntakeMode } from "./intake";
import { RehearseMode } from "./rehearse";

export interface ModeHandler {
  /** New speech cuts the agent off mid-sentence (conversational modes only). */
  readonly bargeIn: boolean;
  /** Start the turn on the last partial at speech end (redone if the final transcript differs). */
  readonly speculate?: boolean;
  /** Join a speaker's utterances split by a short pause, while the first is not yet spoken. */
  readonly merge?: boolean;
  open(): Promise<void>;
  utterance(u: Utterance, signal: AbortSignal): Promise<void>;
  /** Live partial transcript (Counter: pull up a named document before the sentence ends). */
  partial?(text: string): void;
  /** Writes the session summary to the case timeline. */
  finish(): Promise<void>;
}

export function modeHandler(s: VoiceSession): ModeHandler {
  if (s.mode === "counter") return new CounterMode(s);
  if (s.mode === "rehearse") return new RehearseMode(s);
  if (s.mode === "intake") return new IntakeMode(s);
  return new AgentMode(s);
}
