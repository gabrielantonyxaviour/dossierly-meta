/*
 * Counter: phone flat on the desk between the user and the official.
 * Official (Polish) → fast bare translation lane, spoken to the user, plus a parallel case-aware watcher that pulls up
 * requested documents, captures tasks/deadlines and adds what a word-for-word interpreter would miss.
 * User → one case-aware lane that translates faithfully or, when the literal words would confuse, coaches.
 */
import type { CaseDocument } from "../../../case/types";
import type { CapturedItem, DocCard, VoiceTurn } from "../../protocol";
import { jsonCall, streamLines } from "../llm";
import { officialToUserSystem, userToOfficialSystem, watcherSystem } from "../prompts";
import type { Utterance, VoiceSession } from "../session";
import { dueInDays, looksPolish } from "../util";
import { similar } from "./agent";
import type { ModeHandler } from "./index";

type Watch = {
  docs?: string[];
  tasks?: Array<{ title?: string; detail?: string; due_in_days?: number | null; due_date?: string | null }>;
  meaning?: string | null;
  check?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PL_DOC: Record<string, string> = {
  passport: "Paszport", rental_agreement: "Umowa najmu", health_insurance: "Ubezpieczenie zdrowotne",
  university_certificate: "Zaświadczenie z uczelni", photo: "Zdjęcie", upo: "UPO (potwierdzenie złożenia wniosku)", letter: "Pismo", other: "Dokument",
};

export class CounterMode implements ModeHandler {
  readonly bargeIn = false;
  private exchange: VoiceTurn[] = [];
  private captured: CapturedItem[] = [];
  private shown = new Set<string>();
  private pending = new Set<Promise<void>>();

  constructor(private s: VoiceSession) {}

  async open(): Promise<void> {
    /* The counter waits for the first speaker. */
  }

  private exchangeText(): string {
    return this.exchange
      .slice(-8)
      .map((t) => `${t.who === "official" ? "OFFICIAL" : "USER"}: ${t.text}${t.translation ? ` [= ${t.translation}]` : ""}`)
      .join("\n") || "(start of the conversation)";
  }

  async utterance(u: Utterance, signal: AbortSignal): Promise<void> {
    const official = u.as ? u.as === "official" : looksPolish(u.text);
    if (official) await this.fromOfficial(u, signal);
    else await this.fromUser(u, signal);
  }

  private async fromOfficial(u: Utterance, signal: AbortSignal): Promise<void> {
    const turn: VoiceTurn = { id: u.id, who: "official", text: u.text, lang: "pl", via: u.via, translationLang: this.s.lang, partial: true };
    this.s.emit({ t: "turn", turn });
    const context = this.exchangeText();
    // Side lane starts at once, in parallel with the spoken translation.
    const watcher = this.watch(u, context);
    let said = "";
    const res = await streamLines(
      this.s.env,
      { role: "interpret", effort: "minimal", system: officialToUserSystem(this.s.lang), messages: [{ role: "user", content: u.text }], speak: ["SAY"], signal, maxTokens: 1200 },
      {
        onSentence: (_k, sentence) => {
          if (!said) this.s.sentenceReady(u.id);
          said = said ? `${said} ${sentence}` : sentence;
          this.s.speaker.say(u.id, sentence, { lang: this.s.lang, side: "user" });
          this.s.emit({ t: "turn", turn: { ...turn, translation: said } });
        },
      },
    );
    this.s.speaker.end(u.id);
    const done = { ...turn, translation: said || res.fields.SAY || "", partial: false };
    this.s.emit({ t: "turn", turn: done });
    this.exchange.push(done);
    // Never hold the next turn for the side lane.
    const p = watcher.catch(() => undefined).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  private async watch(u: Utterance, context: string): Promise<void> {
    const docs = this.s.snapshot?.documents ?? [];
    const w = await jsonCall<Watch>(this.s.env, {
      role: "interpret",
      effort: "low",
      system: watcherSystem(this.s.lang),
      user: `${this.s.caseText}\n\nEXCHANGE\n${context}\n\nTURN (official)\n${u.text}`,
      maxTokens: 2500,
    });
    if (!w) return;
    for (const id of (w.docs ?? []).slice(0, 2)) {
      const doc = docs.find((d) => d.id === id || id.endsWith(d.id));
      if (!doc || this.shown.has(doc.id)) continue;
      if (doc.status === "have") this.showDoc(u.id, doc);
      else {
        // Never show the official a document the user does not actually hold.
        this.shown.add(doc.id);
        this.s.emit({ t: "coach", note: { turnId: u.id, toUser: `The official asked for ${doc.title}. It is not in your case yet, so say you will send it and ask how (in person, by post or e-Doręczenia).` } });
      }
    }
    if (w.meaning) this.s.emit({ t: "coach", note: { turnId: u.id, toUser: w.meaning } });
    if (w.check) this.s.emit({ t: "coach", note: { turnId: u.id, toUser: w.check } });
    for (const task of (w.tasks ?? []).slice(0, 3)) await this.capture(u.id, task);
  }

  private showDoc(turnId: string, doc: CaseDocument): void {
    this.shown.add(doc.id);
    const card: DocCard = { turnId, docId: doc.id, title: doc.title, kind: doc.kind, captionPl: PL_DOC[doc.kind] ?? "Dokument", fields: doc.extractedFields };
    this.s.emit({ t: "doc", doc: card });
  }

  private async capture(turnId: string, task: NonNullable<Watch["tasks"]>[number]): Promise<void> {
    const title = task.title?.trim();
    if (!title || this.captured.some((c) => similar(c.title, title))) return;
    try {
      let due: { date: string; steps: string[] } | null = null;
      if (task.due_date && ISO_DATE.test(task.due_date)) due = { date: task.due_date, steps: [`Date given at the counter: ${task.due_date}.`] };
      else if (typeof task.due_in_days === "number" && task.due_in_days > 0 && task.due_in_days < 400) due = dueInDays(Math.round(task.due_in_days));
      let dueDeadlineId: string | null = null;
      if (due) {
        const d = await this.s.case.addDeadline({ title: title.slice(0, 200), dueDate: due.date, steps: due.steps, rule: "Said at the counter" });
        dueDeadlineId = d.id;
      }
      const t = await this.s.case.addTask({ title: title.slice(0, 200), detail: (task.detail ?? "").slice(0, 2000), origin: "counter", dueDeadlineId });
      const item: CapturedItem = { turnId, kind: "task", id: t.id, title: t.title, dueDate: due?.date ?? null };
      this.captured.push(item);
      this.s.emit({ t: "captured", item });
    } catch {
      this.s.emit({ t: "error", error: "Could not save that task to your case", code: "case_write" });
    }
  }

  private async fromUser(u: Utterance, signal: AbortSignal): Promise<void> {
    const turn: VoiceTurn = { id: u.id, who: "user", text: u.text, lang: this.s.lang, via: u.via, translationLang: "pl", partial: true };
    this.s.emit({ t: "turn", turn });
    let said = "";
    const res = await streamLines(
      this.s.env,
      {
        role: "interpret",
        effort: "minimal",
        system: userToOfficialSystem(this.s.lang),
        messages: [{ role: "user", content: `${this.s.caseText}\n\nEXCHANGE\n${this.exchangeText()}\n\nUSER SAID\n${u.text}` }],
        speak: ["SAY"],
        signal,
        maxTokens: 1600,
      },
      {
        onSentence: (_k, sentence) => {
          if (!said) this.s.sentenceReady(u.id);
          said = said ? `${said} ${sentence}` : sentence;
          this.s.speaker.say(u.id, sentence, { lang: "pl", side: "official" });
          this.s.emit({ t: "turn", turn: { ...turn, translation: said } });
        },
      },
    );
    this.s.speaker.end(u.id);
    const done = { ...turn, translation: said || res.fields.SAY || "", partial: false };
    this.s.emit({ t: "turn", turn: done });
    this.exchange.push(done);
    if (/coach/i.test(res.fields.MODE ?? "") && res.fields.WHY) {
      this.s.emit({ t: "coach", note: { turnId: u.id, toUser: res.fields.WHY, toOfficial: done.translation, toOfficialGloss: res.fields.GLOSS } });
    }
  }

  async finish(): Promise<void> {
    await Promise.all([...this.pending]);
    if (!this.exchange.length) return;
    const shown = [...this.shown].map((id) => this.s.snapshot?.documents.find((d) => d.id === id)?.title).filter(Boolean);
    const summary = `Counter conversation: ${this.exchange.length} turns.${shown.length ? ` Shown to the official: ${shown.join(", ")}.` : ""}${this.captured.length ? ` New tasks: ${this.captured.map((c) => `${c.title}${c.dueDate ? ` (by ${c.dueDate})` : ""}`).join("; ")}.` : ""}`;
    await this.s.case.addEvent({ type: "counter_session", summary, refs: this.captured.map((c) => c.id) });
  }
}
