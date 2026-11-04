/* Caseworker call: in-app "Talk to Dossierly", the welcome call after onboarding, and the outbound phone call. */
import type { ChatMessage } from "../../../model/types";
import type { CapturedItem } from "../../protocol";
import { streamLines } from "../llm";
import { agentSystem } from "../prompts";
import type { Utterance, VoiceSession } from "../session";
import { firstName, shortId, warsawIso } from "../util";
import type { ModeHandler } from "./index";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\d]{3,}/gu) ?? []);
/** Same task in other words: most of the shorter title's words appear in the other. */
export function similar(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let hit = 0;
  for (const w of x) if (y.has(w)) hit++;
  return hit / Math.min(x.size, y.size) >= 0.6;
}

export class AgentMode implements ModeHandler {
  readonly bargeIn = true;
  private history: ChatMessage[] = [];
  private captured: CapturedItem[] = [];
  private reminded = new Set<string>();
  private ending = false;

  constructor(private s: VoiceSession) {}

  private get kind(): "agent" | "welcome" | "phone" {
    return this.s.mode === "welcome" ? "welcome" : this.s.mode === "phone" ? "phone" : "agent";
  }

  private system(): string {
    const reason = this.kind === "phone" && this.s.ticket.r ? `\n\nREASON FOR THIS CALL\n${this.s.ticket.r}` : "";
    const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date());
    return `${agentSystem(this.s.lang, this.kind)}\n\nLocal time now: ${now} (Warsaw).\n${this.s.caseText}${reason}`;
  }

  async open(): Promise<void> {
    const script = this.kind === "welcome" ? this.s.ticket.r?.trim() : "";
    const id = shortId();
    const metric = this.s.newMetric(id);
    if (script) {
      // Onboarding's server-generated opening line: speak it verbatim, no model round-trip.
      this.s.emit({ t: "turn", turn: { id, who: "agent", text: script, lang: this.s.lang } });
      this.s.sentenceReady(id);
      this.s.speaker.say(id, script, { lang: this.s.lang, side: "user" });
      this.s.speaker.end(id);
      this.history.push({ role: "assistant", content: `SAY: ${script}` });
      void metric;
      return;
    }
    const name = firstName(this.s.snapshot);
    const cue =
      this.kind === "phone"
        ? `(The user just picked up the phone${name ? `; their name is ${name}` : ""}. Open the call.)`
        : this.kind === "welcome"
          ? "(Call connected. Greet the user and start walking them through what you found in their case.)"
          : "(Call connected. Greet the user in one short sentence and ask what they need.)";
    await this.reply(id, cue, new AbortController().signal, true);
  }

  async utterance(u: Utterance, signal: AbortSignal): Promise<void> {
    if (this.ending) return;
    this.s.emit({ t: "turn", turn: { id: `${u.id}-u`, who: "user", text: u.text, lang: this.s.lang, via: u.via } });
    await this.reply(u.id, u.text, signal, false);
  }

  private async reply(id: string, input: string, signal: AbortSignal, cue: boolean): Promise<void> {
    const messages: ChatMessage[] = [...this.history.slice(-16), { role: "user", content: input }];
    let said = "";
    const res = await streamLines(
      this.s.env,
      { role: this.s.env.VOICE_AGENT_ROLE === "agent" ? "agent" : "interpret", effort: "minimal", system: this.system(), messages, speak: ["SAY"], signal, maxTokens: 1800 },
      {
        onSentence: (_k, sentence) => {
          if (signal.aborted) return;
          if (!said) this.s.sentenceReady(id);
          said = said ? `${said} ${sentence}` : sentence;
          this.s.speaker.say(id, sentence, { lang: this.s.lang, side: "user" });
          this.s.emit({ t: "turn", turn: { id, who: "agent", text: said, lang: this.s.lang, partial: true } });
        },
      },
    );
    this.s.speaker.end(id);
    if (signal.aborted) {
      if (said) this.history.push({ role: "user", content: input }, { role: "assistant", content: `SAY: ${said} [cut off]` });
      return;
    }
    if (said) this.s.emit({ t: "turn", turn: { id, who: "agent", text: said, lang: this.s.lang } });
    this.history.push({ role: "user", content: input });
    // Keep the action lines in history so the model knows they are done and does not repeat them.
    const acts = ["TASK", "DEADLINE", "REMIND"].flatMap((k) => (res.fields[k] ? res.fields[k].split("\n").map((l) => `${k}: ${l}`) : []));
    this.history.push({ role: "assistant", content: [`SAY: ${res.fields.SAY ?? said}`, ...acts].join("\n") });
    void cue;
    await this.actions(id, res.fields);
    await this.remind(id, res.fields);
    if (/^y/i.test(res.fields.END ?? "")) {
      this.ending = true;
      setTimeout(() => void this.s.finish("agent_ended"), 6000);
    }
  }

  private known(title: string): boolean {
    const c = this.s.snapshot;
    const titles = [...this.captured.map((x) => x.title), ...(c?.tasks.filter((x) => x.status === "open").map((x) => x.title) ?? []), ...(c?.deadlines.map((x) => x.title) ?? [])];
    return titles.some((t) => similar(t, title));
  }

  private async actions(turnId: string, f: Record<string, string>): Promise<void> {
    for (const line of (f.TASK ?? "").split("\n").filter(Boolean)) {
      const [title, detail, due] = line.split("|").map((x) => x.trim());
      if (!title || this.known(title)) continue;
      try {
        let dueDeadlineId: string | null = null;
        let dueDate: string | null = null;
        if (due && ISO_DATE.test(due)) {
          const d = await this.s.case.addDeadline({ title, dueDate: due, steps: ["Agreed on a call with Dossierly."] });
          dueDeadlineId = d.id;
          dueDate = d.dueDate;
        }
        const t = await this.s.case.addTask({ title: title.slice(0, 200), detail: (detail ?? "").slice(0, 2000), origin: "agent", dueDeadlineId });
        this.push({ turnId, kind: "task", id: t.id, title: t.title, dueDate });
      } catch {
        this.s.emit({ t: "error", error: "Could not save that task to your case", code: "case_write" });
      }
    }
    for (const line of (f.DEADLINE ?? "").split("\n").filter(Boolean)) {
      const [title, date, how] = line.split("|").map((x) => x.trim());
      if (!title || !ISO_DATE.test(date ?? "") || this.known(title)) continue;
      try {
        const d = await this.s.case.addDeadline({ title, dueDate: date, steps: how ? [how] : [] });
        this.push({ turnId, kind: "deadline", id: d.id, title: d.title, dueDate: d.dueDate });
      } catch {
        this.s.emit({ t: "error", error: "Could not save that deadline to your case", code: "case_write" });
      }
    }
  }

  /** "Remind me tomorrow at nine": a reminder on the deadline (confirms one the inbox runtime pre-set, never doubles it). */
  private async remind(turnId: string, f: Record<string, string>): Promise<void> {
    for (const line of (f.REMIND ?? "").split("\n").filter(Boolean).slice(0, 2)) {
      const [rawId, when] = line.split("|").map((x) => x.trim());
      const id = (rawId ?? "").replace(/^#/, "");
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(when ?? "");
      const d = this.s.snapshot?.deadlines.find((x) => x.id === id);
      if (!d || !m || this.reminded.has(d.id)) continue;
      try {
        const at = warsawIso(m[1], m[2]);
        const same = (x: { at: string }) => Date.parse(x.at) === Date.parse(at);
        const reminders = d.reminders.some(same) ? d.reminders : [...d.reminders, { at, channel: "call" as const, sentAt: null }];
        if (reminders !== d.reminders) {
          await this.s.case.patchDeadline(d.id, { reminders });
          d.reminders = reminders;
        }
        this.reminded.add(d.id);
        this.push({ turnId, kind: "reminder", id: d.id, title: `Reminder: ${d.title}`, detail: `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${m[1]}T00:00:00Z`))}, ${m[2]}`, dueDate: d.dueDate });
      } catch {
        this.s.emit({ t: "error", error: "Could not set that reminder", code: "case_write" });
      }
    }
  }

  private push(item: CapturedItem): void {
    this.captured.push(item);
    this.s.emit({ t: "captured", item });
  }

  async finish(): Promise<void> {
    const userTurns = this.s.turns.filter((t) => t.who === "user");
    if (!userTurns.length && this.kind !== "phone") return;
    const label = this.kind === "phone" ? "Phone call from Dossierly" : this.kind === "welcome" ? "Welcome call with Dossierly" : "Voice call with Dossierly";
    const asked = userTurns.slice(0, 3).map((t) => `"${t.text.slice(0, 80)}"`).join(", ");
    const made = this.captured.length ? ` Added: ${this.captured.map((c) => c.title).join("; ")}.` : "";
    // Phone calls about a letter reference its deadline (and drafts) by #id in the reason.
    const about = this.kind === "phone" ? [...(this.s.ticket.r ?? "").matchAll(/#([A-Za-z0-9_-]{1,64})/g)].map((x) => x[1]) : [];
    const refs = [...new Set([...about, ...this.captured.map((c) => c.id)])].slice(0, 20);
    await this.s.case.addEvent({ type: "call", summary: `${label}.${asked ? ` You asked ${asked}.` : ""}${made}`, refs });
  }
}
