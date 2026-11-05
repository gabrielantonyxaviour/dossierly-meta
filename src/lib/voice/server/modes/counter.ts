/*
 * Counter: phone flat on the desk between the user and the official. Dossierly is the user's agent, not a translator.
 * Official (Polish) → one case-aware lane: it answers her directly in Polish when CASE settles it (and shows her the
 * document), asks the user first when it does not, or only relays; and it briefs the user (asked / told / do). Side
 * lanes: a named document comes up from the partial transcript (no model), and a watcher (Spark 1.2) captures tasks.
 * User → their point conveyed to the official in proper Polish with case context; the address-change notice
 * (KPA art. 41) is drafted as soon as the address comes up and turned to the official when the user raises it.
 */
import type { CaseDocument } from "../../../case/types";
import { draftAddressChange, type AddressChangeEnv } from "../../../legal/address-change";
import type { CapturedItem, DocCard, VoiceTurn } from "../../protocol";
import { jsonCall, streamLines } from "../llm";
import { officialAgentSystem, userToOfficialSystem, watcherSystem } from "../prompts";
import type { Utterance, VoiceSession } from "../session";
import { dueInDays, looksPolish } from "../util";
import { similar } from "./agent";
import { ADDRESS_INTENT, PL_DOC, addressChange, askedDocs, type AddressFacts } from "./counter-lanes";
import type { ModeHandler } from "./index";

type Watch = {
  docs?: string[];
  tasks?: Array<{ title?: string; detail?: string; due_in_days?: number | null; due_date?: string | null }>;
  check?: string | null;
};
type Brief = NonNullable<VoiceTurn["brief"]>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ADDRESS_TASK = /address|adres|notice|zawiadom|writing|piśmie/i;
const FILE_TYPE: Record<string, "image" | "pdf"> = { png: "image", jpg: "image", jpeg: "image", webp: "image", pdf: "pdf" };
/** The same document is not pushed to the official twice within this window (partial + final + watcher). */
const REOFFER_MS = 8000;
const BRIEF_KEY: Record<string, keyof Brief> = { ASKED: "asked", TOLD: "told", DO: "do" };
const join = (a: string | undefined, b: string) => (a ? `${a} ${b}` : b);
export const briefText = (b: Brief) => [b.asked, b.told, b.do].filter(Boolean).join(" ");

/** The document's own stored file, when it has one the viewer can render. */
export function storedFile(doc: CaseDocument): DocCard["file"] {
  const type = doc.fileKey ? FILE_TYPE[doc.fileKey.split(".").pop()?.toLowerCase() ?? ""] : undefined;
  return type ? { url: `/api/case/documents/${encodeURIComponent(doc.id)}/file`, type } : null;
}

export class CounterMode implements ModeHandler {
  readonly bargeIn = false;
  readonly speculate = true;
  readonly merge = true;
  private exchange: VoiceTurn[] = [];
  /** Things the official was shown, for the models' view of the exchange. */
  private notes: string[] = [];
  private captured: CapturedItem[] = [];
  private shown = new Set<string>();
  private offeredAt = new Map<string, number>();
  private pending = new Set<Promise<void>>();
  private draft: { docId: string; title: string } | null = null;
  private draftCard: DocCard | null = null;
  private drafting: Promise<void> | null = null;

  constructor(private s: VoiceSession) {}

  async open(): Promise<void> {
    /* The counter waits for the first speaker. */
  }

  private get docs(): CaseDocument[] {
    return this.s.snapshot?.documents ?? [];
  }

  private get person(): string {
    return this.s.snapshot?.profile.fullName?.trim() || "the client";
  }

  private prepared(): string | undefined {
    if (!this.draft && !this.drafting) return undefined;
    return "a notice of change of address (Zawiadomienie o zmianie adresu, KPA art. 41 § 1), drafted from his case for him to sign and file";
  }

  private exchangeText(): string {
    const lines = this.exchange.slice(-8).flatMap((t) => {
      const said = t.who === "official" ? t.reply : t.translation;
      return [`${t.who === "official" ? "OFFICIAL" : "CLIENT"}: ${t.text}`, ...(said ? [`DOSSIERLY TO OFFICIAL: ${said}`] : [])];
    });
    if (this.notes.length) lines.push(`(Shown to the official: ${this.notes.join("; ")})`);
    return lines.join("\n") || "(start of the conversation)";
  }

  /** The official names a document: it comes up for them while they are still speaking. */
  partial(text: string): void {
    this.offerAsked(text, "live");
  }

  private offerAsked(text: string, turnId: string): boolean {
    const asked = askedDocs(text, this.docs);
    for (const doc of asked) this.offer(turnId, doc);
    return asked.length > 0;
  }

  private offer(turnId: string, doc: CaseDocument): void {
    const now = Date.now();
    if (now - (this.offeredAt.get(doc.id) ?? 0) < REOFFER_MS) return;
    this.offeredAt.set(doc.id, now);
    if (doc.status === "have") return this.showDoc(turnId, doc);
    if (this.shown.has(doc.id)) return;
    this.shown.add(doc.id);
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

  /** Drafting starts as soon as the address comes up, so the notice is ready when it is needed. */
  private startDraft(turnId: string, text: string, show: boolean): void {
    if (this.drafting || this.draft || !ADDRESS_INTENT.test(text)) return;
    const facts = addressChange(this.s.snapshot);
    if (!facts) return;
    this.drafting = this.draftNotice(turnId, facts, show);
    this.side(this.drafting);
  }

  private async fromOfficial(u: Utterance, signal: AbortSignal): Promise<void> {
    const turn: VoiceTurn = { id: u.id, who: "official", text: u.text, lang: "pl", via: u.via, translationLang: this.s.lang, partial: true };
    this.s.emit({ t: "turn", turn });
    const context = this.exchangeText();
    this.offerAsked(u.text, u.id);
    this.startDraft(u.id, u.text, false);
    const input = `${this.s.caseText}\n\nEXCHANGE\n${context}\n\nTURN (official)\n${u.text}`;
    this.side(this.watch(u, input, signal));
    const brief: Brief = {};
    let reply = "";
    let first = true;
    const res = await streamLines(
      this.s.env,
      { role: "interpret", effort: "minimal", system: officialAgentSystem(this.s.lang, this.person, this.prepared()), messages: [{ role: "user", content: input }], speak: ["PL", "ASKED", "TOLD", "DO"], signal, maxTokens: 1600 },
      {
        onField: (k, v) => {
          if (k === "DOC" && !signal.aborted) this.showAsked(u.id, v);
        },
        onSentence: (k, sentence) => {
          if (signal.aborted) return;
          if (first) this.s.sentenceReady(u.id);
          first = false;
          if (k === "PL") {
            reply = join(reply, sentence);
            this.s.speaker.say(u.id, sentence, { lang: "pl", side: "official" });
          } else if (BRIEF_KEY[k]) {
            brief[BRIEF_KEY[k]] = join(brief[BRIEF_KEY[k]], sentence);
            this.s.speaker.say(u.id, sentence, { lang: this.s.lang, side: "user" });
          }
          this.s.emit({ t: "turn", turn: { ...turn, reply, brief: { ...brief }, translation: briefText(brief) } });
        },
      },
    );
    if (signal.aborted) return; // redone with the final transcript under the same id
    this.s.speaker.end(u.id);
    const f = res.fields;
    const fin: Brief = { asked: brief.asked || f.ASKED?.trim() || undefined, told: brief.told || f.TOLD?.trim() || undefined, do: brief.do || f.DO?.trim() || undefined };
    const m = (f.MODE ?? "").toLowerCase();
    const mode = m.includes("answer") ? "answer" : m.includes("ask") ? "ask" : "relay";
    const done: VoiceTurn = { ...turn, reply: reply || f.PL?.trim() || undefined, brief: fin, mode, translation: briefText(fin), partial: false };
    this.s.emit({ t: "turn", turn: done });
    this.exchange.push(done);
  }

  /** The DOC line of the agent's reply: the case document (or the drafted notice) to put in front of the official. */
  private showAsked(turnId: string, raw: string): void {
    const id = raw.trim().replace(/^#/, "");
    if (!id || /^none$/i.test(id)) return;
    if (this.draftCard && (id === this.draftCard.docId || /addr|zawiadom/i.test(id))) return this.showDraft(turnId);
    const doc = this.docs.find((d) => d.id === id || id.endsWith(d.id));
    if (doc) this.offer(turnId, doc);
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
    const card: DocCard = { turnId, docId: doc.id, title: doc.title, kind: doc.kind, captionPl: PL_DOC[doc.kind] ?? "Dokument", fields: doc.extractedFields, file: storedFile(doc) };
    if (!this.notes.includes(doc.title)) this.notes.push(doc.title);
    this.shown.add(doc.id);
    this.s.emit({ t: "doc", doc: card });
  }

  private showDraft(turnId: string): void {
    if (!this.draftCard || !this.draft) return;
    const now = Date.now();
    if (now - (this.offeredAt.get(this.draft.docId) ?? 0) < REOFFER_MS) return;
    this.offeredAt.set(this.draft.docId, now);
    this.shown.add(this.draft.docId);
    if (!this.notes.includes(this.draft.title)) this.notes.push(this.draft.title);
    this.s.emit({ t: "doc", doc: { ...this.draftCard, turnId } });
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

  /** Drafts the notice of change of address (dm-paper's template, one case write); `show` turns it to the official. */
  private async draftNotice(turnId: string, facts: AddressFacts, show: boolean): Promise<void> {
    const snapshot = this.s.snapshot;
    if (!snapshot || this.draft) return;
    try {
      const d = await draftAddressChange(this.s.env as unknown as AddressChangeEnv, { userId: this.s.ticket.u, snapshot, ...facts });
      this.draft = { docId: d.docId, title: d.title };
      this.draftCard = {
        turnId, docId: d.docId, title: d.title, kind: "address_change", captionPl: "Zawiadomienie o zmianie adresu", textPl: d.textPl,
        fields: { caseNumber: facts.caseNumber, oldAddress: facts.oldAddress, newAddress: facts.newAddress, movedOn: facts.movedOn },
      };
      if (show) this.showDraft(turnId);
    } catch {
      this.s.emit({ t: "error", error: "Could not draft the address change notice", code: "draft_failed" });
    }
  }

  private async fromUser(u: Utterance, signal: AbortSignal): Promise<void> {
    const turn: VoiceTurn = { id: u.id, who: "user", text: u.text, lang: this.s.lang, via: u.via, translationLang: "pl", partial: true };
    this.s.emit({ t: "turn", turn });
    const context = this.exchangeText();
    // The user raises the address: the notice reaches the official's half while they listen.
    if (ADDRESS_INTENT.test(u.text)) {
      if (this.draft) this.showDraft(u.id);
      else if (this.drafting) this.side(this.drafting.then(() => this.showDraft(u.id)));
      else this.startDraft(u.id, u.text, true);
    }
    let said = "";
    const res = await streamLines(
      this.s.env,
      {
        role: "interpret",
        effort: "minimal",
        system: userToOfficialSystem(this.s.lang, this.person, this.prepared()),
        messages: [{ role: "user", content: `${this.s.caseText}\n\nEXCHANGE\n${context}\n\nCLIENT SAID\n${u.text}` }],
        speak: ["SAY"],
        signal,
        maxTokens: 1600,
      },
      {
        onSentence: (_k, sentence) => {
          if (signal.aborted) return;
          if (!said) this.s.sentenceReady(u.id);
          said = join(said, sentence);
          this.s.speaker.say(u.id, sentence, { lang: "pl", side: "official" });
          this.s.emit({ t: "turn", turn: { ...turn, translation: said } });
        },
      },
    );
    if (signal.aborted) return; // redone with the final transcript under the same id
    this.s.speaker.end(u.id);
    const gloss = res.fields.GLOSS?.trim();
    const done: VoiceTurn = { ...turn, translation: said || res.fields.SAY || "", brief: gloss ? { told: gloss } : undefined, partial: false };
    this.s.emit({ t: "turn", turn: done });
    this.exchange.push(done);
  }

  async finish(): Promise<void> {
    await Promise.all([...this.pending]);
    if (!this.exchange.length) return;
    const shown = [...this.shown].map((id) => (id === this.draft?.docId ? this.draft.title : this.docs.find((d) => d.id === id)?.title)).filter(Boolean);
    const summary = `Counter conversation: ${this.exchange.length} turns.${shown.length ? ` Shown to the official: ${shown.join(", ")}.` : ""}${this.captured.length ? ` New tasks: ${this.captured.map((c) => `${c.title}${c.dueDate ? ` (by ${c.dueDate})` : ""}`).join("; ")}.` : ""}`;
    await this.s.case.addEvent({ type: "counter_session", summary, refs: [...this.captured.map((c) => c.id), ...(this.draft ? [this.draft.docId] : [])] });
  }
}
