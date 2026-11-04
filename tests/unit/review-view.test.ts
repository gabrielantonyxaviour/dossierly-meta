import { describe, expect, it } from "vitest";
import { toFields } from "@/lib/strategist/storage";
import type { CaseSnapshot, CaseTask } from "@/lib/case/types";
import { evidenceRef, parseProposal, proposals, reviewCounts } from "@/components/app/review/derive";
import { deriveNotices } from "@/components/app/notifications/derive";

const now = "2026-11-04T17:00:00.000Z";
const review = {
  summary: "Your address on the application is out of date.",
  risks: [
    { what: "Letters go to the dorm", why: "KPA art. 41 §2", evidence: ["doc-mos"], severity: "high" as const, deadlineImpact: "Delivery counts at the old address", deadlineDate: null },
    { what: "Photo missing", why: "Summons item 3", evidence: ["dl-summons"], severity: "medium" as const, deadlineImpact: "", deadlineDate: "2026-11-18" },
  ],
  plan: [{ order: 1, action: "Report the new address in writing", date: "2026-11-05", dependsOn: [], actor: "user" as const, legalBasis: "KPA art. 41" }],
  inconsistencies: [{ what: "Dorm vs new flat", detail: "MOS has the dorm; the lease starts 1 Oct", evidence: ["doc-mos", "doc-lease"], legalConsequence: "Letters to the dorm count as delivered (KPA art. 41 §2)", suggestedFix: "File a change of address today" }],
  questions: ["Did you tell the office you moved?"],
};
const meta = { revision: "r1", reviewedAt: now, model: "muse-wonder-1.0", costUsd: 0.04, rounds: 3, stop: "final", proposals: 1 };
const task = (over: Partial<CaseTask>): CaseTask => ({ id: "prop-r1-1", title: "[Proposed] Report new address", detail: "Proposed by the case review, not confirmed. Use the drafted notice.", dueDeadlineId: null, origin: "agent", status: "open", createdAt: now, ...over });

const snap = (): CaseSnapshot => ({
  profile: {} as CaseSnapshot["profile"], facts: {} as CaseSnapshot["facts"],
  documents: [
    { id: "doc-case-review", kind: "other", title: "Case review", status: "have", fileKey: null, pages: null, source: "agent", extractedFields: toFields(review, meta), createdAt: now },
    { id: "doc-mos", kind: "upo", title: "MOS filing confirmation", status: "have", fileKey: null, pages: 1, source: "email", extractedFields: {}, createdAt: now },
  ],
  deadlines: [], appointments: [],
  tasks: [task({}), task({ id: "prop-r1-2", title: "[Proposed] Send photo (2026-11-17)", detail: "Proposed by the case review, not confirmed. Proposed deadline 2026-11-17. Before the summons date." }), task({ id: "t3", title: "Normal task", origin: "user" })],
  events: [{ id: "ev-review-r1", at: now, type: "note", summary: "Case review: 2 risks, 1 inconsistencies, 1 planned steps", refs: ["doc-case-review"], createdAt: now }],
});

describe("case review view", () => {
  it("counts risks, high risks and inconsistencies from the stored document", () => {
    expect(reviewCounts(snap())).toEqual({ risks: 2, high: 1, inconsistencies: 1, reviewedAt: now });
    expect(reviewCounts({ ...snap(), documents: [] })).toBeNull();
  });
  it("finds open proposals and strips the prefix; deadline proposals keep their date", () => {
    const s = snap();
    expect(proposals(s).map((t) => t.id)).toEqual(["prop-r1-1", "prop-r1-2"]);
    expect(parseProposal(s.tasks[0])).toEqual({ title: "Report new address", detail: "Use the drafted notice.", dueDate: null });
    expect(parseProposal(s.tasks[1])).toEqual({ title: "Send photo", detail: "Before the summons date.", dueDate: "2026-11-17" });
  });
  it("links evidence to case items and drops unknown ids", () => {
    expect(evidenceRef(snap(), "doc-mos")).toEqual({ label: "MOS filing confirmation", href: "/app/case/documents/doc-mos" });
    expect(evidenceRef(snap(), "nope")).toBeNull();
  });
  it("the review note notifies as 'Case review ready' and opens the review", () => {
    const n = deriveNotices(snap(), new Date(now)).find((x) => x.id === "ev:ev-review-r1");
    expect(n?.title).toBe("Case review ready");
    expect(n?.href).toBe("/app/case/review");
  });
});
