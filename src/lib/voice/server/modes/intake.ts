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
    // onReply: speak as soon as the reply-only call answers, before the profile extraction (newer intakeTurn).
    let spoken = false;
    const speakReply = (reply: string, language: string) => {
      if (spoken || signal.aborted) return; // a speculative turn redone with the final transcript stays silent
      spoken = true;
      this.done = true;
      this.s.sentenceReady(u.id);
      this.s.speaker.say(u.id, reply, { lang: language, side: "user" });
      this.s.speaker.end(u.id);
      this.s.emit({ t: "turn", turn: { id: u.id, who: "agent", text: reply, lang: language } });
    };
    type Opts = { defer?: (p: Promise<unknown>) => void; onReply?: (reply: string, language: string) => void };
    const turn = intakeTurn as unknown as (e: Env, userId: string, t: string, o?: Opts) => ReturnType<typeof intakeTurn>;
    const call = () => turn(this.s.env as unknown as Env, this.s.ticket.u, u.text, { defer: (p) => void p.catch(() => undefined), onReply: speakReply });
    // One retry: a transient model error (empty reply, briefly unavailable) must not lose the take.
    const r = await call().catch((e) => (signal.aborted ? Promise.reject(e) : call()));
    if (signal.aborted) return;
    speakReply(r.reply, r.language); // no-op when onReply already spoke
    this.s.emit({ t: "intake", profile: r.profile, firstName: r.firstName, language: r.language });
    // Outside the turn chain: end once the reply has played on the device.
    void this.s.speaker.whenPlayed(20_000).then(() => this.s.finish("intake_done"));
  }

  async finish(): Promise<void> {
    /* Onboarding records the setup itself. */
  }
}
