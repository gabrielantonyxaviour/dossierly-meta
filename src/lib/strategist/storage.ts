import { CaseClientError, type CaseClient } from "../case/client";
import type { CaseSnapshot } from "../case/types";
import { sha256Hex } from "../server/util";
import { reviewSchema, type Proposal, type Review } from "./types";

/* Stored in EXISTING collections only: documents (id REVIEW_DOC_ID), events, tasks. No schema changes. */

export const REVIEW_DOC_ID = "doc-case-review";
export const eventIdFor = (rev: string) => `ev-review-${rev}`;
const proposalIdFor = (rev: string, n: number) => `prop-${rev}-${n}`;
export const PROPOSED_PREFIX = "[Proposed] ";
const MAX_FIELD = 1000;

/** Everything the review itself writes is excluded, so a review never changes the revision it was made for. */
const isOwn = (id: string) => id === REVIEW_DOC_ID || id.startsWith("ev-review-") || id.startsWith("prop-");

export async function revisionOf(c: CaseSnapshot): Promise<string> {
  const keep = <T extends { id: string }>(rows: T[]) => rows.filter((r) => !isOwn(r.id));
  const canon = JSON.stringify([c.profile, c.facts, keep(c.documents), c.deadlines, keep(c.tasks), keep(c.events), c.appointments]);
  return (await sha256Hex(canon)).slice(0, 16);
}

/** Last-24h activity: anything created or an event dated in the window (the store has no updatedAt). */
export function changedSince(c: CaseSnapshot, sinceMs: number): boolean {
  const at = (iso: string) => Date.parse(iso) >= sinceMs;
  return [...c.documents, ...c.deadlines, ...c.tasks, ...c.appointments].filter((r) => !isOwn(r.id)).some((r) => at(r.createdAt)) ||
    c.events.filter((e) => !isOwn(e.id)).some((e) => at(e.createdAt) || at(e.at));
}

/** Every string slot (container + key) in a JSON value. */
function slots(v: unknown, out: Array<[Record<string, unknown>, string]> = []): Array<[Record<string, unknown>, string]> {
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === "string") out.push([v as Record<string, unknown>, k]);
      else slots(x, out);
    }
  }
  return out;
}

/** Shrinks the longest string until the JSON fits one extractedFields value. */
function fit(value: unknown): string {
  const v = JSON.parse(JSON.stringify(value)) as unknown;
  for (let i = 0; i < 40; i++) {
    const s = JSON.stringify(v);
    if (s.length <= MAX_FIELD) return s;
    const longest = slots(v).sort((x, y) => String(y[0][y[1]]).length - String(x[0][x[1]]).length)[0];
    if (!longest) break;
    const [o, k] = longest;
    o[k] = `${String(o[k]).slice(0, Math.max(20, Math.floor(String(o[k]).length * 0.7)))}…`;
  }
  return JSON.stringify(v).slice(0, MAX_FIELD);
}

export type ReviewMeta = { revision: string; reviewedAt: string; model: string; costUsd: number; rounds: number; stop: string; proposals: number };
export type StoredReview = Review & ReviewMeta;

export function toFields(review: Review, meta: ReviewMeta): Record<string, string> {
  const f: Record<string, string> = { revision: meta.revision, reviewedAt: meta.reviewedAt, model: meta.model, costUsd: meta.costUsd.toFixed(4), rounds: String(meta.rounds), stop: meta.stop, proposals: String(meta.proposals), summary: review.summary.slice(0, MAX_FIELD) };
  const put = (prefix: string, items: unknown[]) => items.forEach((it, i) => void (f[`${prefix}_${String(i + 1).padStart(2, "0")}`] = fit(it)));
  put("risk", review.risks.slice(0, 20));
  put("plan", review.plan.slice(0, 30));
  put("inconsistency", review.inconsistencies.slice(0, 20));
  put("question", review.questions.slice(0, 12));
  return f;
}

/** The latest stored review in the snapshot, or null. */
export function readReview(c: CaseSnapshot): StoredReview | null {
  const f = c.documents.find((d) => d.id === REVIEW_DOC_ID && d.source === "agent")?.extractedFields;
  if (!f?.revision) return null;
  const list = (prefix: string) => Object.keys(f).filter((k) => k.startsWith(`${prefix}_`)).sort().map((k) => { try { return JSON.parse(f[k]); } catch { return f[k]; } });
  const parsed = reviewSchema.safeParse({ summary: f.summary ?? "", risks: list("risk"), plan: list("plan"), inconsistencies: list("inconsistency"), questions: list("question") });
  if (!parsed.success) return null;
  return { ...parsed.data, revision: f.revision, reviewedAt: f.reviewedAt ?? "", model: f.model ?? "", costUsd: Number(f.costUsd ?? 0), rounds: Number(f.rounds ?? 0), stop: f.stop ?? "", proposals: Number(f.proposals ?? 0) };
}

const exists = (e: unknown) => e instanceof CaseClientError && e.status === 409;

/** Writes the review doc (replacing only our own agent doc), a timeline note, and proposals as new agent tasks. Returns what was added. */
export async function persist(c: CaseClient, snapshot: CaseSnapshot, review: Review, meta: ReviewMeta, proposals: Proposal[]): Promise<{ docId: string; eventId: string; taskIds: string[] }> {
  const existing = snapshot.documents.find((d) => d.id === REVIEW_DOC_ID);
  if (existing && existing.source !== "agent") throw new CaseClientError(409, "Review document id is taken", "review_id_taken");
  const fields = toFields(review, meta);
  if (existing) await c.patch("documents", REVIEW_DOC_ID, { extractedFields: fields, title: "Case review" });
  else await c.create("documents", { id: REVIEW_DOC_ID, kind: "other", title: "Case review", status: "have", source: "agent", extractedFields: fields });

  const evidence = [...new Set([...review.risks, ...review.inconsistencies].flatMap((x) => x.evidence))].filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)).slice(0, 18);
  const eventId = eventIdFor(meta.revision);
  const summary = `Case review: ${review.risks.length} risks, ${review.inconsistencies.length} inconsistencies, ${review.plan.length} planned steps`;
  try {
    await c.create("events", { id: eventId, type: "note", summary, refs: [REVIEW_DOC_ID, ...evidence] });
  } catch (e) {
    if (!exists(e)) throw e;
  }

  const taskIds: string[] = [];
  for (const [i, p] of proposals.entries()) {
    const id = proposalIdFor(meta.revision, i + 1);
    const title = `${PROPOSED_PREFIX}${p.kind === "deadline" && p.dueDate ? `${p.title} (${p.dueDate})` : p.title}`.slice(0, 200);
    const detail = `Proposed by the case review, not confirmed. ${p.kind === "deadline" ? `Proposed deadline ${p.dueDate}. ` : ""}${p.detail}`.slice(0, 2000);
    try {
      await c.create("tasks", { id, title, detail, origin: "agent", status: "open", dueDeadlineId: p.relatedDeadlineId });
      taskIds.push(id);
    } catch (e) {
      if (!exists(e)) throw e;
    }
  }
  return { docId: REVIEW_DOC_ID, eventId, taskIds };
}
