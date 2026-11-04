/*
 * Intake: the first words of setup (onboarding's voice-first hello). The user speaks first; the realtime ASR's final
 * transcript goes to onboarding's intakeTurn (Spark: saves name, permit and language to the case), Dossierly speaks
 * the reply, the client gets the saved profile, and the session ends once the reply has played.
 */
import { intakeTurn } from "../../../onboarding/intake";
import type { Env } from "../../../server/env";
import type { Utterance, VoiceSession } from "../session";
import type { ModeHandler } from "./index";

export class IntakeMode implements ModeHandler {
  readonly bargeIn = false;
  readonly speculate = true;
  private done = false;

  constructor(private s: VoiceSession) {}

  async open(): Promise<void> {
    /* The user speaks first. */
  }

  async utterance(u: Utterance, signal: AbortSignal): Promise<void> {
    if (this.done) return;
    this.s.emit({ t: "turn", turn: { id: `${u.id}-u`, who: "user", text: u.text, lang: this.s.lang, via: u.via } });
    // defer: the profile save finishes in the background (the DO stays alive while the reply plays).
    const turn = intakeTurn as unknown as (e: Env, userId: string, t: string, o?: { defer?: (p: Promise<unknown>) => void }) => ReturnType<typeof intakeTurn>;
    const r = await turn(this.s.env as unknown as Env, this.s.ticket.u, u.text, { defer: (p) => void p.catch(() => undefined) });
    if (signal.aborted) return; // redone with the final transcript
    this.done = true;
    this.s.sentenceReady(u.id);
    this.s.speaker.say(u.id, r.reply, { lang: r.language, side: "user" });
    this.s.speaker.end(u.id);
    this.s.emit({ t: "turn", turn: { id: u.id, who: "agent", text: r.reply, lang: r.language } });
    this.s.emit({ t: "intake", profile: r.profile, firstName: r.firstName, language: r.language });
    // Outside the turn chain: end once the reply has played on the device.
    void this.s.speaker.whenPlayed(20_000).then(() => this.s.finish("intake_done"));
  }

  async finish(): Promise<void> {
    /* Onboarding records the setup itself. */
  }
}
