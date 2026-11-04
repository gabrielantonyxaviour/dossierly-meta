/* Rehearse: a simulated Polish official interviews the user about their real case, then gives feedback. */
import type { ChatMessage } from "../../../model/types";
import type { RehearseFeedback } from "../../protocol";
import { jsonCall, streamLines } from "../llm";
import { feedbackSystem, rehearseSystem } from "../prompts";
import type { Utterance, VoiceSession } from "../session";
import { shortId } from "../util";
import type { ModeHandler } from "./index";

export const REHEARSE_QUESTIONS = 6;

export class RehearseMode implements ModeHandler {
  readonly bargeIn = false;
  private history: ChatMessage[] = [];
  private asked = 0;
  private done = false;

  constructor(private s: VoiceSession) {}

  private system(): string {
    return `${rehearseSystem(this.s.lang)}\n\n${this.s.caseText}`;
  }

  async open(): Promise<void> {
    await this.official(shortId(), "(The user sits down at your desk. Greet them and ask the first question.)", new AbortController().signal);
  }

  async utterance(u: Utterance, signal: AbortSignal): Promise<void> {
    if (this.done) return;
    this.s.emit({ t: "turn", turn: { id: `${u.id}-u`, who: "user", text: u.text, lang: this.s.lang, via: u.via } });
    if (this.asked >= REHEARSE_QUESTIONS) {
      this.history.push({ role: "user", content: u.text });
      const id = u.id;
      await this.official(id, `${u.text}\n\n(This was the last answer. Thank the user briefly and close the interview in one sentence.)`, signal, true);
      await this.feedback();
      return;
    }
    await this.official(u.id, u.text, signal);
  }

  private async official(id: string, input: string, signal: AbortSignal, closing = false): Promise<void> {
    let said = "";
    const res = await streamLines(
      this.s.env,
      { role: "interpret", effort: "minimal", system: this.system(), messages: [...this.history.slice(-14), { role: "user", content: input }], speak: ["SAY"], signal, maxTokens: 1500 },
      {
        onSentence: (_k, sentence) => {
          if (!said) this.s.sentenceReady(id);
          said = said ? `${said} ${sentence}` : sentence;
          this.s.speaker.say(id, sentence, { lang: "pl", voice: "official", side: "user" });
          this.s.emit({ t: "turn", turn: { id, who: "official", text: said, lang: "pl", partial: true } });
        },
      },
    );
    this.s.speaker.end(id);
    const text = res.fields.SAY ?? said;
    this.s.emit({ t: "turn", turn: { id, who: "official", text, lang: "pl", translation: res.fields.EN, translationLang: this.s.lang } });
    if (res.fields.TIP) this.s.emit({ t: "coach", note: { turnId: id, toUser: res.fields.TIP } });
    if (!closing) this.history.push({ role: "user", content: input });
    this.history.push({ role: "assistant", content: `SAY: ${text}\nEN: ${res.fields.EN ?? ""}` });
    if (!closing) this.asked++;
  }

  private async feedback(): Promise<void> {
    if (this.done) return;
    this.done = true;
    const transcript = this.s.turns.map((t) => `${t.who === "official" ? "OFFICIAL" : "USER"}: ${t.text}`).join("\n");
    const fb = await jsonCall<RehearseFeedback>(this.s.env, {
      role: "agent",
      effort: "low",
      system: feedbackSystem(this.s.lang),
      user: `${this.s.caseText}\n\nTRANSCRIPT\n${transcript}`,
      maxTokens: 3000,
    });
    if (fb && typeof fb.score === "number") this.s.emit({ t: "feedback", feedback: { score: Math.max(0, Math.min(100, Math.round(fb.score))), summary: String(fb.summary ?? ""), went_well: (fb.went_well ?? []).slice(0, 3), practise: (fb.practise ?? []).slice(0, 4) } });
    else this.s.emit({ t: "error", error: "Feedback could not be prepared; try ending again", code: "feedback_failed" });
  }

  async finish(): Promise<void> {
    if (!this.done && this.asked > 1) await this.feedback();
    if (this.asked > 0) await this.s.case.addEvent({ type: "note", summary: `Rehearsed the office interview: ${this.asked} questions in Polish.` });
  }
}
