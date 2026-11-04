import type { CaseSnapshot, CaseTask } from "@/lib/case/types";

/* Client helpers for the Muse Wonder case review (src/lib/strategist). Types only from the server module. */

export const REVIEW_DOC_ID = "doc-case-review";
export const PROPOSED_PREFIX = "[Proposed] ";
const PROPOSED_DETAIL = /^Proposed by the case review, not confirmed\.\s*/;

export type Severity = "low" | "medium" | "high" | "critical";
export type Actor = "user" | "university" | "employer" | "office";
export type Risk = { what: string; why: string; evidence: string[]; severity: Severity; deadlineImpact: string; deadlineDate: string | null };
export type PlanStep = { order: number; action: string; date: string | null; dependsOn: number[]; actor: Actor; legalBasis: string | null };
export type Inconsistency = { what: string; detail: string; evidence: string[]; legalConsequence: string | null; suggestedFix: string };
export type StoredReview = {
  summary: string; risks: Risk[]; plan: PlanStep[]; inconsistencies: Inconsistency[]; questions: string[];
  revision: string; reviewedAt: string; model: string; costUsd: number; rounds: number; stop: string; proposals: number;
};

/** Counts for entry cards, read straight from the stored review document (no parsing of the items). */
export function reviewCounts(c: CaseSnapshot): { risks: number; high: number; inconsistencies: number; reviewedAt: string } | null {
  const f = c.documents.find((d) => d.id === REVIEW_DOC_ID && d.source === "agent")?.extractedFields;
  if (!f?.revision) return null;
  const keys = Object.keys(f);
  const risks = keys.filter((k) => k.startsWith("risk_"));
  const high = risks.filter((k) => /"severity"\s*:\s*"(high|critical)"/.test(f[k])).length;
  return { risks: risks.length, high, inconsistencies: keys.filter((k) => k.startsWith("inconsistency_")).length, reviewedAt: f.reviewedAt ?? "" };
}

export const isProposal = (t: CaseTask) => t.origin === "agent" && t.title.startsWith(PROPOSED_PREFIX);
export const proposals = (c: CaseSnapshot) => c.tasks.filter((t) => t.status === "open" && isProposal(t));

/** "[Proposed] Ask the dean's office (2026-11-20)" → { title: "Ask the dean's office", dueDate: "2026-11-20" } for deadline proposals. */
export function parseProposal(t: CaseTask): { title: string; detail: string; dueDate: string | null } {
  const raw = t.title.slice(PROPOSED_PREFIX.length);
  const m = /^(.*)\s\((\d{4}-\d{2}-\d{2})\)$/.exec(raw);
  const isDeadline = /Proposed deadline \d{4}-\d{2}-\d{2}/.test(t.detail);
  const detail = t.detail.replace(PROPOSED_DETAIL, "").replace(/^Proposed deadline \d{4}-\d{2}-\d{2}\.\s*/, "");
  return m && isDeadline ? { title: m[1], detail, dueDate: m[2] } : { title: raw, detail, dueDate: null };
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const bySeverity = (a: Risk, b: Risk) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
export const SEV_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
export const ACTOR_LABEL: Record<Actor, string> = { user: "You", university: "University", employer: "Employer", office: "Office" };

/** Evidence ids → a label and a link into the case, when the item still exists. */
export function evidenceRef(c: CaseSnapshot, id: string): { label: string; href: string | null } | null {
  const doc = c.documents.find((d) => d.id === id);
  if (doc) return { label: doc.title, href: `/app/case/documents/${doc.id}` };
  const dl = c.deadlines.find((d) => d.id === id);
  if (dl) return { label: dl.title, href: `/app/case/deadlines/${dl.id}` };
  const ap = c.appointments.find((a) => a.id === id);
  if (ap) return { label: ap.title, href: "/app/case?tab=dates" };
  const ev = c.events.find((e) => e.id === id);
  if (ev) return { label: ev.summary.length > 60 ? `${ev.summary.slice(0, 57)}…` : ev.summary, href: `/app/case?tab=timeline#${ev.id}` };
  const t = c.tasks.find((x) => x.id === id);
  if (t) return { label: t.title, href: "/app/case?tab=tasks" };
  const fact = (c.facts as Record<string, { value: string } | null | undefined>)[id];
  if (fact) return { label: fact.value, href: "/app/case" };
  return null;
}
