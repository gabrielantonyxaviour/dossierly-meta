/*
 * Counter: phone flat on the desk between the user and the official.
 * Official (Polish) → fast bare translation lane spoken to the user, plus parallel side lanes: a named document comes up
 * from the partial transcript (no model), a case-aware coach card (Spark 1.3 raced against 1.2), and a watcher
 * (Spark 1.2) for documents and tasks. User → one case-aware lane that translates faithfully or coaches; when they say
 * they moved, the KPA art. 41 address-change notice is drafted and turned to the official.
 */
import type { CaseDocument } from "../../../case/types";
import { draftAddressChange, type AddressChangeEnv } from "../../../legal/address-change";
import type { CapturedItem, DocCard, VoiceTurn } from "../../protocol";
import { jsonCall, streamLines } from "../llm";
import { officialToUserSystem, userToOfficialSystem, watcherSystem } from "../prompts";
import type { Utterance, VoiceSession } from "../session";
import { dueInDays, looksPolish } from "../util";
import { similar } from "./agent";
import { ADDRESS_INTENT, PL_DOC, addressChange, askedDocs, coachCard, type AddressFacts } from "./counter-lanes";
import type { ModeHandler } from "./index";

type Watch = {
  docs?: string[];
  tasks?: Array<{ title?: string; detail?: string; due_in_days?: number | null; due_date?: string | null }>;
  check?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ADDRESS_TASK = /address|adres|notice|zawiadom|writing|piśmie/i;

export class CounterMode implements ModeHandler {
  readonly bargeIn = false;
  readonly speculate = true;
  private exchange: VoiceTurn[] = [];
  /** Things the official was shown, for the models' view of the exchange. */
  private notes: string[] = [];
  private captured: CapturedItem[] = [];
  private shown = new Set<string>();
  private pending = new Set<Promise<void>>();
  private draft: { docId: string; title: string } | null = null;

  constructor(private s: VoiceSession) {}

  async open(): Promise<void> {
    /* The counter waits for the first speaker. */
  }

  private get docs(): CaseDocument[] {
    return this.s.snapshot?.documents ?? [];
  }

  private exchangeText(): string {
    const lines = this.exchange.slice(-8).map((t) => `${t.who === "official" ? "OFFICIAL" : "USER"}: ${t.text}${t.translation ? ` [= ${t.translation}]` : ""}`);
    if (this.notes.length) lines.push(`(Shown to the official: ${this.notes.join("; ")})`);
    return lines.join("\n") || "(start of the conversation)";
  }

  /** The official names a document: it comes up for them while they are still speaking. */
  partial(text: string): void {
    this.offerAsked(text, "live");
  }

  /** Shows (or, if the user lacks it, flags) every document named in `text`. True when any was named. */
  private offerAsked(text: string, turnId: string): boolean {
    const asked = askedDocs(text, this.docs);
    for (const doc of asked) this.offer(turnId, doc);
    return asked.length > 0;
  }

  private offer(turnId: string, doc: CaseDocument): void {
    if (this.shown.has(doc.id)) return;
    this.shown.add(doc.id);
    if (doc.status === "have") return this.showDoc(turnId, doc);
    // Never show the official a document the user does not actually hold.
    this.s.emit({ t: "coach", note: { turnId, toUser: `The official asked for ${doc.title}. It is not in your case yet, so say you will send it and ask how (in person, by post or e-Doręczenia).` } });
  }

  async utterance(u: Utterance, signal: AbortSignal): Promise<void> {
    const official = u.as ? u.as === "official" : looksPolish(u.text);
    if (official) await this.fromOfficial(u, signal);
    else await this.fromUser(u, signal);
  }

  private side(p: Promise<unknown>): void {
    const q: Promise<void> = p.then(() => undefined, () => undefined).finally(() => this.pending.delete(q));
    this.pending.add(q);
  }

  private async fromOfficial(u: Utterance, signal: AbortSignal): Promise<void> {
    const turn: VoiceTurn = { id: u.id, who: "official", text: u.text, lang: "pl", via: u.via, translationLang: this.s.lang, partial: true };
    this.s.emit({ t: "turn", turn });
    const context = this.exchangeText();
    const askedForDoc = this.offerAsked(u.text, u.id);
    const input = `${this.s.caseText}\n\nEXCHANGE\n${context}\n\nTURN (official)\n${u.text}`;
    // Side lanes start at once, in parallel with the spoken translation, and never hold the next turn.
    if (!askedForDoc) this.side(coachCard(this.s.env, input, this.s.lang).then((c) => c && !signal.aborted && this.s.emit({ t: "coach", note: { turnId: u.id, toUser: c.text } })));
    this.side(this.watch(u, input, signal));
    const prepared = this.draft ? `a written notice of change of address (${this.draft.title}), already shown to the official` : undefined;
    let said = "";
    const res = await streamLines(
      this.s.env,
      { role: "interpret", effort: "minimal", system: officialToUserSystem(this.s.lang, prepared), messages: [{ role: "user", content: u.text }], speak: ["SAY"], signal, maxTokens: 1200 },
      {
        onSentence: (_k, sentence) => {
          if (!said) this.s.sentenceReady(u.id);
          said = said ? `${said} ${sentence}` : sentence;
          this.s.speaker.say(u.id, sentence, { lang: this.s.lang, side: "user" });
          this.s.emit({ t: "turn", turn: { ...turn, translation: said } });
        },
      },
    );
    if (signal.aborted) return; // redone with the final transcript under the same id
    this.s.speaker.end(u.id);
    const done = { ...turn, translation: said || res.fields.SAY || "", partial: false };
    this.s.emit({ t: "turn", turn: done });
    this.exchange.push(done);
  }

  private async watch(u: Utterance, input: string, signal: AbortSignal): Promise<void> {
    const w = await jsonCall<Watch>(this.s.env, { role: "interpret", effort: "minimal", system: watcherSystem(this.s.lang), user: input, maxTokens: 2000 });
    if (!w || signal.aborted) return;
    for (const id of (w.docs ?? []).slice(0, 2)) {
      const doc = this.docs.find((d) => d.id === id || id.endsWith(d.id));
      if (doc) this.offer(u.id, doc);
    }
    if (w.check) this.s.emit({ t: "coach", note: { turnId: u.id, toUser: w.check } });
    for (const task of (w.tasks ?? []).slice(0, 3)) await this.capture(u.id, task);
  }

  private showDoc(turnId: string, doc: CaseDocument): void {
    const card: DocCard = { turnId, docId: doc.id, title: doc.title, kind: doc.kind, captionPl: PL_DOC[doc.kind] ?? "Dokument", fields: doc.extractedFields };
    this.notes.push(doc.title);
    this.s.emit({ t: "doc", doc: card });
  }

  private async capture(turnId: string, task: NonNullable<Watch["tasks"]>[number]): Promise<void> {
    let title = task.title?.trim();
    let detail = (task.detail ?? "").trim();
    if (!title) return;
    // The notice is already drafted: name the task the way the case reads it.
    if (this.draft && ADDRESS_TASK.test(`${title} ${detail}`)) {
      title = "Report new address in writing";
      detail = "KPA art. 41 · draft ready";
    }
    if (this.captured.some((c) => similar(c.title, title!))) return;
    try {
      let due: { date: string; steps: string[] } | null = null;
      if (task.due_date && ISO_DATE.test(task.due_date)) due = { date: task.due_date, steps: [`Date given at the counter: ${task.due_date}.`] };
      else if (typeof task.due_in_days === "number" && task.due_in_days >= 0 && task.due_in_days < 400) due = dueInDays(Math.round(task.due_in_days));
      let dueDeadlineId: string | null = null;
      if (due) {
        const d = await this.s.case.addDeadline({ title: title.slice(0, 200), dueDate: due.date, steps: due.steps, rule: "Said at the counter" });
        dueDeadlineId = d.id;
      }
      const t = await this.s.case.addTask({ title: title.slice(0, 200), detail: detail.slice(0, 2000), origin: "counter", dueDeadlineId });
      const item: CapturedItem = { turnId, kind: "task", id: t.id, title: t.title, detail: detail || undefined, dueDate: due?.date ?? null };
      this.captured.push(item);
      this.s.emit({ t: "captured", item });
    } catch {
      this.s.emit({ t: "error", error: "Could not save that task to your case", code: "case_write" });
    }
  }

  /** Drafts the notice of change of address (dm-paper's template, one case write) and turns it to the official. */
  private async draftNotice(turnId: string, facts: AddressFacts): Promise<void> {
    const snapshot = this.s.snapshot;
    if (!snapshot || this.draft) return;
    try {
      const d = await draftAddressChange(this.s.env as unknown as AddressChangeEnv, { userId: this.s.ticket.u, snapshot, ...facts });
      this.draft = { docId: d.docId, title: d.title };
      this.shown.add(d.docId);
      this.notes.push(d.title);
      this.s.emit({
        t: "doc",
        doc: { turnId, docId: d.docId, title: d.title, kind: "address_change", captionPl: "Zawiadomienie o zmianie adresu", fields: { caseNumber: facts.caseNumber, oldAddress: facts.oldAddress, newAddress: facts.newAddress, movedOn: facts.movedOn } },
      });
    } catch {
      this.s.emit({ t: "error", error: "Could not draft the address change notice", code: "draft_failed" });
    }
  }

  private async fromUser(u: Utterance, signal: AbortSignal): Promise<void> {
    const turn: VoiceTurn = { id: u.id, who: "user", text: u.text, lang: this.s.lang, via: u.via, translationLang: "pl", partial: true };
    this.s.emit({ t: "turn", turn });
    const context = this.exchangeText();
    // Drafting runs alongside the spoken Polish, so the notice reaches the official's half while they listen.
    const facts = !this.draft && ADDRESS_INTENT.test(u.text) ? addressChange(this.s.snapshot) : null;
    if (facts) this.side(this.draftNotice(u.id, facts));
    let said = "";
    const res = await streamLines(
      this.s.env,
      {
        role: "interpret",
        effort: "minimal",
        system: userToOfficialSystem(this.s.lang),
        messages: [{ role: "user", content: `${this.s.caseText}\n\nEXCHANGE\n${context}\n\nUSER SAID\n${u.text}` }],
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
    if (signal.aborted) return; // redone with the final transcript under the same id
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
    const shown = [...this.shown].map((id) => (id === this.draft?.docId ? this.draft.title : this.docs.find((d) => d.id === id)?.title)).filter(Boolean);
    const summary = `Counter conversation: ${this.exchange.length} turns.${shown.length ? ` Shown to the official: ${shown.join(", ")}.` : ""}${this.captured.length ? ` New tasks: ${this.captured.map((c) => `${c.title}${c.dueDate ? ` (by ${c.dueDate})` : ""}`).join("; ")}.` : ""}`;
    await this.s.case.addEvent({ type: "counter_session", summary, refs: [...this.captured.map((c) => c.id), ...(this.draft ? [this.draft.docId] : [])] });
  }
}
