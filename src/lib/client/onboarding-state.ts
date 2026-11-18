import { z } from "zod";
import { CaseSchema, LanguageSchema, LetterSchema } from "@/lib/schemas";
import { NeedSchema, type Need } from "@/lib/onboarding/schema";
import type { Answers } from "@/components/onboarding-preview/content";
import { emptyAnswers } from "@/components/onboarding-preview/content";
import { emptyCase, sampleCase } from "./sample";
import { tNow } from "@/lib/i18n/current";
import type { Dossier } from "./store";
import type { Case, HubChange, Interpretation, Letter, LetterLink, LetterRead, PrepareResult } from "./types";

export type SourceCapture = { embeddings?: boolean; pages?: number; origin?: string; sources: { url: string; fetchedAt: string | null; kind: "snapshot" | "bundled" | "extract" }[] };
export type Review = { state: "reviewed" | "skipped"; note: string };
export type OnboardingDraft = {
  version: 1; step: number; answers: Answers; caseId: string; active: Need;
  source: "sample" | "own" | "mail" | "empty" | null; filename: string; pages: string[];
  read: LetterRead | null; facts: Letter | null; delivery: string; factsConfirmed: boolean; factsAccepted: boolean;
  capture: SourceCapture | null; updatesCheckedAt: string | null; link: LetterLink | null; prepared: PrepareResult | null; prepareTask: string | null;
  appointment: { date: string; purpose: string; office: string }; have: Record<string, boolean>;
  phrase: string; interpretation: Interpretation | null; changes: HubChange[] | null;
  reviews: Partial<Record<Need, Review>>; notes: Partial<Record<Need, string>>;
  pending: string | null; error: string; confirmedCaseId: string | null;
};
export const freshDraft = (): OnboardingDraft => ({
  version: 1, step: 1, answers: emptyAnswers(), caseId: `case-${crypto.randomUUID()}`, active: "letters",
  source: null, filename: "", pages: [], read: null, facts: null, delivery: "", factsConfirmed: false, factsAccepted: false,
  capture: null, updatesCheckedAt: null, link: null, prepared: null, prepareTask: null, appointment: { date: "", purpose: "", office: "" }, have: {},
  phrase: "", interpretation: null, changes: null, reviews: {}, notes: {}, pending: null, error: "", confirmedCaseId: null,
});
const AnswersSchema = z.object({ name: z.string().max(100), language: LanguageSchema, reason: z.string().max(40), stage: z.string().max(80), city: z.string().max(100), office: z.string().max(160), needs: z.array(NeedSchema).max(6), main: z.union([NeedSchema, z.literal("")]) });
export function restoreDraft(value: unknown): OnboardingDraft | null {
  const parsed = z.object({ version: z.literal(1), step: z.number().int().min(1).max(6), answers: AnswersSchema, caseId: z.string().max(80), pages: z.array(z.string().max(6_000_000)).max(4), source: z.enum(["sample", "own", "mail", "empty"]).nullable(), facts: LetterSchema.nullable() }).passthrough().safeParse(value);
  if (!parsed.success) return null;
  const draft = { ...freshDraft(), ...parsed.data } as OnboardingDraft;
  return { ...draft, pending: null, error: draft.pending && !draft.prepareTask ? tNow("onboarding")("draftInterrupted") : draft.error };
}
export function orderNeeds(draft: OnboardingDraft): Need[] {
  const { needs, main } = draft.answers;
  return main && needs.includes(main) ? [main, ...needs.filter((need) => need !== main)] : needs;
}
export function draftCase(draft: OnboardingDraft): Case {
  const language = LanguageSchema.parse(draft.answers.language);
  const c = draft.source === "sample" ? sampleCase() : emptyCase(draft.answers.name.trim(), language, draft.facts?.office?.slice(0, 160) || draft.answers.office.trim() || "Office not yet confirmed");
  return { ...c, id: draft.source === "sample" ? c.id : draft.caseId, profile: { ...c.profile, language }, context: { reason: draft.answers.reason, stage: draft.answers.stage, city: draft.answers.city }, caseNumber: draft.facts?.caseNumber || c.caseNumber, type: draft.source === "sample" ? c.type : draft.answers.reason.toLowerCase(), events: draft.factsConfirmed && draft.facts ? [...c.events.filter((e) => e.id !== `letter-${draft.caseId}`), reviewedLetterEvent(draft)] : c.events, documents: draft.prepared ? draft.prepared.checklist.map((item) => ({ name: item.item.slice(0, 160), have: draft.have[item.item] === true })).slice(0, 40) : c.documents };
}
export function reviewedLetterEvent(draft: OnboardingDraft) {
  return { id: `letter-${draft.caseId}`, date: draft.delivery, kind: "letter" as const, title: (draft.facts?.title || "Reviewed letter").slice(0, 200), summary: [draft.facts?.asks.join("\n"), draft.facts?.asksLocal.join("\n"), draft.facts?.deadlineRule.quote].filter(Boolean).join("\n").slice(0, 1500), refs: [] };
}
export function clearDocument(draft: OnboardingDraft): OnboardingDraft {
  const empty = freshDraft();
  return { ...empty, answers: draft.answers, caseId: draft.caseId, step: 4, active: orderNeeds(draft)[0] || "letters" };
}
export function confirmedDossier(draft: OnboardingDraft): Dossier {
  if (draft.source === "empty") {
    if (!draft.answers.name.trim() || !draft.answers.reason || !draft.answers.stage || draft.answers.needs.some((need) => !draft.reviews[need])) throw new Error(tNow("onboarding")("reviewProfileFirst"));
    return { case: CaseSchema.parse(draftCase(draft)), sample: false, letters: [], runs: [], onboarding: { answers: draft.answers, reviews: draft.reviews, notes: {} } };
  }
  if (draft.source === "sample" || !draft.source || !draft.factsConfirmed || !draft.facts || !draft.delivery || !draft.answers.name.trim()) throw new Error(tNow("onboarding")("reviewDocumentFirst"));
  if (draft.answers.needs.some((need) => !draft.reviews[need])) throw new Error(tNow("onboarding")("reviewPriorities"));
  const id = `letter-${draft.caseId}`;
  const event = reviewedLetterEvent(draft);
  const c = CaseSchema.parse({ ...draftCase(draft), events: [event], deadlines: draft.link?.deadline ? [{ id: `deadline-${draft.caseId}`, date: draft.link.deadline.date, what: draft.facts.title.slice(0, 300) || "Respond to letter", sourceEventId: id }] : [] });
  return { case: c, sample: false, letters: [{ id, title: event.title, deliveryDate: draft.delivery, deadline: draft.link?.deadline?.date ?? null, linkedTo: [], explanation: event.summary, draftLocal: draft.link?.draftLocal ?? "", draftUser: draft.link?.draftUser ?? "", pages: draft.pages, extracted: draft.facts }], runs: [], onboarding: { answers: draft.answers, reviews: draft.reviews, notes: draft.notes, results: { prepared: draft.prepared, capture: draft.capture, interpretation: draft.interpretation, changes: draft.changes, updatesCheckedAt: draft.updatesCheckedAt, link: draft.link } }, ...(draft.prepared ? { lastPreparedAt: new Date().toISOString() } : {}) };
}
