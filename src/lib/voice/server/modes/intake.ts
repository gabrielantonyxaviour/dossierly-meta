/*
 * Intake: the first words of setup (onboarding's voice-first hello). The user speaks first. On the realtime ASR's
 * transcript the reply streams from Spark sentence by sentence into TTS (onboarding's INTAKE_REPLY_SYSTEM) while
 * onboarding's intakeProfile extracts and saves the profile in parallel; the client gets the profile, and the session
 * ends once the reply has played. Falls back to the one-shot intakeTurn when the streaming exports are absent.
 */
import * as intake from "../../../onboarding/intake";
import type { Profile } from "../../../case/types";
import type { Env } from "../../../server/env";
import { streamLines } from "../llm";
import type { Utterance, VoiceSession } from "../session";
import type { ModeHandler } from "./index";

type Defer = { defer?: (p: Promise<unknown>) => void };
type Streaming = {
  INTAKE_REPLY_SYSTEM?: string;
  intakeInput?: (transcript: string) => string;
  intakeProfile?: (env: Env, userId: string, transcript: string, o?: Defer) => Promise<{ profile: Profile; firstName: string | null; language: string | null }>;
};
type OneShot = (e: Env, userId: string, t: string, o?: Defer & { onReply?: (reply: string, language: string) => void }) => ReturnType<typeof intake.intakeTurn>;

/** Worker-tail diagnostics for a reply that produced no speech (error text or the parsed fields, no audio, no PII beyond the transcript's own words). */
function logMiss(attempt: number, detail: string): void {
  // eslint-disable-next-line no-console -- worker-tail diagnostics for intake misses (asked for by onboarding)
  console.warn(JSON.stringify({ at: "voice.intake", attempt, detail: detail.slice(0, 240) }));
}

/** Not a TTS language code: ElevenLabs detects the reply's language itself (the person may speak any language). */
const AUTO = "auto";

export class IntakeMode implements ModeHandler {
  readonly bargeIn = false;
  readonly speculate = true;
  private done = false;

  constructor(private s: VoiceSession) {}

  async open(): Promise<void> {
    /* The user speaks first. */
  }

  private get env(): Env {
    return this.s.env as unknown as Env;
  }

  private readonly defer: Defer = { defer: (p) => void p.catch(() => undefined) };

  async utterance(u: Utterance, signal: AbortSignal): Promise<void> {
    if (this.done) return;
    this.s.emit({ t: "turn", turn: { id: `${u.id}-u`, who: "user", text: u.text, lang: this.s.lang, via: u.via } });
    const m = intake as unknown as Streaming;
    if (m.INTAKE_REPLY_SYSTEM && m.intakeInput && m.intakeProfile) await this.streamed(u, signal, m as Required<Streaming>);
    else await this.oneShot(u, signal);
    if (this.done) void this.s.speaker.whenPlayed(20_000).then(() => this.s.finish("intake_done"));
  }

  /** Reply streamed into speech; profile extraction alongside. One retry each for transient model errors. */
  private async streamed(u: Utterance, signal: AbortSignal, m: Required<Streaming>): Promise<void> {
    const profileOnce = () => m.intakeProfile(this.env, this.s.ticket.u, u.text, this.defer);
    const profileP = profileOnce().catch(() => (signal.aborted ? null : profileOnce())).catch(() => null);
    let said = "";
    const run = () =>
      streamLines(
        this.s.env,
        { role: "interpret", effort: "minimal", system: m.INTAKE_REPLY_SYSTEM, messages: [{ role: "user", content: m.intakeInput(u.text) }], speak: ["SAY"], signal, maxTokens: 1200 },
        {
          onSentence: (_k, sentence) => {
            if (signal.aborted) return;
            if (!said) this.s.sentenceReady(u.id);
            said = said ? `${said} ${sentence}` : sentence;
            this.done = true;
            this.s.speaker.say(u.id, sentence, { lang: AUTO, side: "user" });
            this.s.emit({ t: "turn", turn: { id: u.id, who: "agent", text: said, lang: this.s.lang, partial: true } });
          },
        },
      );
    let res: Awaited<ReturnType<typeof run>> | null = null;
    for (let attempt = 1; attempt <= 2 && !said && !signal.aborted; attempt++) {
      res = await run().catch((e) => (logMiss(attempt, e instanceof Error ? e.message : String(e)), null));
      if (res && !said && !signal.aborted) logMiss(attempt, `no sentence; fields ${JSON.stringify(res.fields).slice(0, 200)}`);
    }
    if (signal.aborted) return; // a speculative turn redone with the final transcript stays silent
    if (said) {
      this.s.speaker.end(u.id);
      const lang = res?.fields.LANG?.trim().slice(0, 8) || null;
      this.s.emit({ t: "turn", turn: { id: u.id, who: "agent", text: said, lang: lang ?? this.s.lang } });
      const p = await profileP;
      if (p) this.s.emit({ t: "intake", profile: p.profile, firstName: p.firstName, language: p.profile.preferredLanguage || p.language || lang || "en" });
      return;
    }
    // The stream gave nothing twice: the one-shot JSON path (which also saves the profile) before giving up.
    try {
      await this.oneShot(u, signal);
    } catch (e) {
      logMiss(3, `one-shot: ${e instanceof Error ? e.message : String(e)}`);
      if (!signal.aborted) this.s.emit({ t: "error", error: "Dossierly could not answer just now. Tap the microphone and say it again.", code: "intake_failed" });
    }
  }

  /** Older onboarding: intakeTurn speaks from onReply when it can, else on resolve; once either way. */
  private async oneShot(u: Utterance, signal: AbortSignal): Promise<void> {
    let spoken = false;
    const speakReply = (reply: string, language: string) => {
      if (spoken || signal.aborted) return;
      spoken = true;
      this.done = true;
      this.s.sentenceReady(u.id);
      this.s.speaker.say(u.id, reply, { lang: language, side: "user" });
      this.s.speaker.end(u.id);
      this.s.emit({ t: "turn", turn: { id: u.id, who: "agent", text: reply, lang: language } });
    };
    const turn = intake.intakeTurn as unknown as OneShot;
    const call = () => turn(this.env, this.s.ticket.u, u.text, { ...this.defer, onReply: speakReply });
    // One retry: a transient model error (empty reply, briefly unavailable) must not lose the take.
    const r = await call().catch((e) => (signal.aborted ? Promise.reject(e) : call()));
    if (signal.aborted) return;
    speakReply(r.reply, r.language);
    this.s.emit({ t: "intake", profile: r.profile, firstName: r.firstName, language: r.language });
  }

  async finish(): Promise<void> {
    /* Onboarding records the setup itself. */
  }
}
