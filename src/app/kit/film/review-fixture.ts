import type { CaseSnapshot } from "@/lib/case/types";
import { toFields } from "@/lib/strategist/storage";

/* LAYOUT FIXTURE: a plausible Muse Wonder review of the film case, for the preview-only /kit/film/review check. */

export function filmReview(nowIso: string) {
  const review = {
    summary: "Your application still has the dorm address. Until you report the move in writing, letters sent there count as delivered, so a missed letter could run out a deadline.",
    risks: [
      { what: "Official letters still go to the dorm", why: "The office sends post to the address on your application (DS Babilon). You moved to Grzybowska on 1 Oct.", evidence: ["doc-mos", "doc-lease"], severity: "high" as const, deadlineImpact: "A letter left at the dorm counts as delivered after 14 days, even if you never see it.", deadlineDate: null },
      { what: "The new photo is still missing", why: "The summons asks for three things; the lease and insurance are in your case, the photo is not.", evidence: ["doc-wezwanie", "doc-photo"], severity: "medium" as const, deadlineImpact: "If it isn't sent by the summons date, the application can be left unexamined.", deadlineDate: "2026-11-18" },
    ],
    plan: [
      { order: 1, action: "Report the new address in writing (zawiadomienie o zmianie adresu)", date: "2026-11-05", dependsOn: [], actor: "user" as const, legalBasis: "KPA art. 41" },
      { order: 2, action: "Get a photo that meets the MOS rules and run the photo check", date: "2026-11-10", dependsOn: [], actor: "user" as const, legalBasis: null },
      { order: 3, action: "Send the lease, insurance and photo in reply to the summons", date: "2026-11-17", dependsOn: [1, 2], actor: "user" as const, legalBasis: "KPA art. 64 § 2" },
    ],
    inconsistencies: [
      { what: "Dorm on the application, new flat on the lease", detail: "MOS confirmation: DS Babilon, ul. Kickiego 12. Lease from 1 Oct: ul. Grzybowska 43A m. 12.", evidence: ["doc-mos", "doc-lease"], legalConsequence: "Until you report the change, letters sent to the dorm count as delivered (KPA art. 41 § 2).", suggestedFix: "File the change of address today; the draft is ready." },
    ],
    questions: ["Did you collect any post at the dorm after 1 October?", "Will you send the reply by post or in person at Marszałkowska 3/5?"],
  };
  const meta = { revision: "kitrev01", reviewedAt: nowIso, model: "muse-wonder-1.0", costUsd: 0.041, rounds: 4, stop: "final", proposals: 2 };
  return { review: { ...review, ...meta }, fields: toFields(review, meta) };
}

export function withReview(snap: CaseSnapshot, nowIso: string): { snap: CaseSnapshot; review: ReturnType<typeof filmReview>["review"] } {
  const { review, fields } = filmReview(nowIso);
  snap.documents.push({ id: "doc-case-review", kind: "other", title: "Case review", status: "have", fileKey: null, pages: null, source: "agent", extractedFields: fields, createdAt: nowIso });
  snap.tasks.push(
    { id: "prop-kitrev01-1", title: "[Proposed] Report your new address in writing", detail: "Proposed by the case review, not confirmed. Under KPA art. 41 letters to the dorm count as delivered until you do.", dueDeadlineId: null, origin: "agent", status: "open", createdAt: nowIso },
    { id: "prop-kitrev01-2", title: "[Proposed] Send the new photo (2026-11-17)", detail: "Proposed by the case review, not confirmed. Proposed deadline 2026-11-17. One day before the summons date, to leave room for the post.", dueDeadlineId: "dl-summons", origin: "agent", status: "open", createdAt: nowIso },
  );
  snap.events.unshift({ id: "ev-review-kitrev01", at: nowIso, type: "note", summary: "Case review: 2 risks, 1 inconsistencies, 3 planned steps", refs: ["doc-case-review"], createdAt: nowIso });
  return { snap, review };
}
