/* Scoring of one Look read against the ground truth. Deadline arithmetic goes through the product's own KPA engine. */
import { computeKpaDeadline, type DeadlineInput, type DeadlineStart } from "../../src/lib/legal/deadlines";
import type { LookRead } from "../../src/lib/look/types";
import { DOC_PATTERNS, type DocId } from "../data/corpus";

export interface Truth {
  id: string; type: string; variant: string; caseNumber: string; letterDate: string; documents: DocId[];
  period: { amount: number; unit: "days" } | null; deadlineKind: "period" | "fixed_date" | "none";
  deliveryDate: string; dueDate: string | null; appointment: { date: string; time: string } | null;
}
type Read = Omit<LookRead, "lookId">;

/** Letter type derived from the structured fields the product already extracts (no extra model call). */
export function derivedType(r: Read): string {
  if (r.letter?.appointment) return "appointment";
  if (r.kind === "decision") return "decision";
  if (/\b64\b/.test(r.letter?.legalBasis ?? "")) return "wezwanie_braki";
  if (r.letter?.asks.length) return "wezwanie_dokumenty";
  return "other";
}

export function docsF1(truth: DocId[], r: Read): { p: number; r: number; f1: number } {
  const asks = (r.letter?.asks ?? []).map((a, i) => `${r.letter?.asksLocal[i] ?? ""} ${a}`.toLowerCase());
  const hits = (text: string) => (Object.keys(DOC_PATTERNS) as DocId[]).filter((d) => new RegExp(DOC_PATTERNS[d], "i").test(text));
  const matchedTruth = new Set<DocId>();
  let goodAsks = 0;
  for (const a of asks) {
    const h = hits(a).filter((d) => truth.includes(d));
    if (h.length) goodAsks++;
    h.forEach((d) => matchedTruth.add(d));
  }
  const p = asks.length ? goodAsks / asks.length : 0;
  const rec = truth.length ? matchedTruth.size / truth.length : 1;
  return { p, r: rec, f1: p + rec ? (2 * p * rec) / (p + rec) : 0 };
}

function dueFor(start: DeadlineStart, r: Read): string | null {
  const rule = r.letter!.deadlineRule;
  const input: DeadlineInput = { start, period: { amount: rule.amount!, unit: rule.unit! }, quote: rule.quote, legalBasis: r.letter!.legalBasis };
  try {
    return computeKpaDeadline(input).dueDate;
  } catch {
    return null;
  }
}

/** Mirrors commit.ts startFor: counted from the letter date only when the model says so, else from delivery. */
export function dueDateOf(r: Read, delivery: string): string | null {
  const rule = r.letter?.deadlineRule;
  if (!rule?.amount || !rule.unit) return null;
  if (rule.from === "letter_date") return r.letter?.dateOnLetter ? dueFor({ kind: "letter_date", date: r.letter.dateOnLetter }, r) : null;
  return dueFor({ kind: "delivery", date: delivery }, r);
}

export interface FieldScores {
  caseNumber: boolean; letterDate: boolean; type: boolean; period: boolean | null; startRule: boolean | null;
  docs: { p: number; r: number; f1: number } | null; deadlineCorrect: boolean | null; appointment: boolean | null;
}

export function scoreRead(t: Truth, r: Read | null): FieldScores {
  const hasDocs = t.documents.length > 0;
  if (!r) {
    return { caseNumber: false, letterDate: false, type: false, period: t.deadlineKind === "period" ? false : null, startRule: t.deadlineKind === "period" ? false : null, docs: hasDocs ? { p: 0, r: 0, f1: 0 } : null, deadlineCorrect: t.deadlineKind === "none" ? null : false, appointment: t.appointment ? false : null };
  }
  const fromItem = r.items.find((i) => i.role === "case_number")?.text ?? "";
  const cn = (r.facts.caseNumber ?? "").trim();
  const caseNumber = cn ? cn === t.caseNumber : fromItem.includes(t.caseNumber);
  const rule = r.letter?.deadlineRule;
  let deadlineCorrect: boolean | null = null;
  if (t.deadlineKind === "period") deadlineCorrect = dueDateOf(r, t.deliveryDate) === t.dueDate;
  else if (t.deadlineKind === "fixed_date") {
    const [y, m, d] = t.dueDate!.split("-");
    deadlineCorrect = (rule?.quote ?? "").includes(`${d}.${m}.${y}`);
  }
  const ap = r.letter?.appointment;
  return {
    caseNumber,
    letterDate: r.letter?.dateOnLetter === t.letterDate,
    type: derivedType(r) === t.type,
    period: t.deadlineKind === "period" ? rule?.amount === t.period!.amount && rule?.unit === t.period!.unit : null,
    startRule: t.deadlineKind === "period" ? rule?.from === "delivery" : null,
    docs: hasDocs ? docsF1(t.documents, r) : null,
    deadlineCorrect,
    appointment: t.appointment ? ap?.date === t.appointment.date && ap?.time === t.appointment.time : null,
  };
}
