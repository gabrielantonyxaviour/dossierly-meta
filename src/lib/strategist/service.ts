import { caseClient, CaseClientError, type CaseClient } from "../case/client";
import { FACT_KEYS, type CaseSnapshot } from "../case/types";
import { assertModelsEnabled, reserveModelSpend, settleModelSpend } from "../model/meter";
import { ModelError } from "../model/types";
import type { Env } from "../server/env";
import { recordRun } from "../server/runs";
import { runAgent, type Meter } from "./agent";
import { changedSince, persist, readReview, revisionOf, type StoredReview } from "./storage";
import { createWonderClient, type WonderClient } from "./transport";
import { LIMITS, StrategistError, WONDER_MODEL, type Review } from "./types";

export type ReviewStatus = "reviewed" | "unchanged";
export interface ReviewOutcome {
  status: ReviewStatus;
  revision: string;
  review: StoredReview | null;
  costUsd: number;
  /** True when the case store was written: the caller should refresh the UI (announceCaseChange on the client). */
  changed: boolean;
}

/** Seams for tests and the live check; production passes none. */
export interface ReviewDeps {
  client?: WonderClient;
  cases?: CaseClient;
  spentToday?: () => Promise<number>;
  reserve?: (usd: number) => Promise<void>;
  settle?: (reserved: number, actual: number) => Promise<void>;
  record?: (run: { model: string; ms: number; tokensIn: number; tokensOut: number; cachedTokens: number; costUsd: number }) => Promise<void>;
  now?: () => Date;
}

const inflight = new Map<string, Promise<ReviewOutcome>>();

async function spentLast24h(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COALESCE(SUM(cost_micro), 0) AS s FROM runs WHERE user_id = ? AND feature = 'strategist' AND ts > ?")
    .bind(userId, Date.now() - 86_400_000).first<{ s: number }>();
  return (row?.s ?? 0) / 1_000_000;
}

/** Keeps only evidence ids that exist in the case, so a review can never cite something that is not there. */
export function cleanEvidence(r: Review, c: CaseSnapshot): Review {
  const known = new Set<string>(["profile", ...FACT_KEYS.map((k) => `fact:${k}`)]);
  for (const k of ["documents", "deadlines", "tasks", "events", "appointments"] as const) for (const x of c[k]) known.add(x.id);
  const keep = (ids: string[]) => [...new Set(ids.map((i) => i.replace(/^#/, "")))].filter((i) => known.has(i));
  return { ...r, risks: r.risks.map((x) => ({ ...x, evidence: keep(x.evidence) })), inconsistencies: r.inconsistencies.map((x) => ({ ...x, evidence: keep(x.evidence) })) };
}

async function run(env: Env, userId: string, deps: ReviewDeps): Promise<ReviewOutcome> {
  try {
    assertModelsEnabled(env);
  } catch {
    throw new StrategistError("Model calls are switched off", "models_disabled", 503);
  }
  const c = deps.cases ?? caseClient(userId);
  const snapshot = await c.snapshot();
  const revision = await revisionOf(snapshot);
  const existing = readReview(snapshot);
  if (existing?.revision === revision) return { status: "unchanged", revision, review: existing, costUsd: 0, changed: false };
  if (!snapshot.documents.length && !snapshot.events.length && !snapshot.deadlines.length) throw new StrategistError("There is nothing in the case to review yet", "empty_case", 422);

  const meter: Meter = {
    spentBefore: await (deps.spentToday ?? (() => spentLast24h(env, userId)))(),
    reserve: deps.reserve ?? ((usd) => reserveModelSpend(env, usd)),
    settle: deps.settle ?? ((r, a) => settleModelSpend(env, r, a)),
  };
  const started = Date.now();
  let out;
  try {
    out = await runAgent(deps.client ?? createWonderClient(env), snapshot, meter, deps.now?.() ?? new Date());
  } catch (e) {
    if (e instanceof ModelError) throw new StrategistError(e.message, e.code === "over_budget" ? "over_budget" : "model_error", e.status);
    throw e;
  }
  const record = deps.record ?? ((r) => recordRun(env, userId, { ...r, ranOn: "cloud" }, "strategist"));
  await record({ model: WONDER_MODEL, ms: Date.now() - started, ...out.usage, costUsd: Number(out.costUsd.toFixed(6)) }).catch(() => undefined);

  const review = cleanEvidence(out.review, snapshot);
  const meta = { revision, reviewedAt: (deps.now?.() ?? new Date()).toISOString(), model: WONDER_MODEL, costUsd: out.costUsd, rounds: out.rounds, stop: out.stop, proposals: out.proposals.length };
  try {
    await persist(c, snapshot, review, meta, out.proposals);
  } catch (e) {
    if (e instanceof CaseClientError) throw new StrategistError("Could not save the review to the case", "case_unavailable", 503);
    throw e;
  }
  return { status: "reviewed", revision, review: { ...review, ...meta }, costUsd: out.costUsd, changed: true };
}

/** Runs (or returns the already-stored) review for the case as it is now. Concurrent calls for one user share one run. */
export function runReview(env: Env, userId: string, deps: ReviewDeps = {}): Promise<ReviewOutcome> {
  const hit = inflight.get(userId);
  if (hit) return hit;
  const p = run(env, userId, deps).finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

/** The stored review without calling the model. */
export async function latestReview(userId: string, cases: CaseClient = caseClient(userId)): Promise<StoredReview | null> {
  return readReview(await cases.snapshot());
}

export type BatchReport = { scanned: number; reviewed: number; unchanged: number; skipped: number; failed: Array<{ userId: string; code: string }>; costUsd: number };
const MAX_SCAN = 200;
const MAX_REVIEWS_PER_RUN = 15;

/**
 * Cron entry: reviews every user whose case changed in the last 24 h (revision-idempotent, so a quiet night costs nothing).
 * Needs the Worker's OpenNext context to be set the way the 2-minute watcher branch does it.
 */
export async function runNightlyReviews(env: Env, deps: { now?: () => Date; reviewer?: typeof runReview } = {}): Promise<BatchReport> {
  const now = (deps.now ?? (() => new Date()))();
  const review = deps.reviewer ?? runReview;
  const { results } = await env.DB.prepare("SELECT id FROM users ORDER BY created_at DESC LIMIT ?").bind(MAX_SCAN).all<{ id: string }>();
  const report: BatchReport = { scanned: results.length, reviewed: 0, unchanged: 0, skipped: 0, failed: [], costUsd: 0 };
  for (const { id } of results) {
    if (report.reviewed >= MAX_REVIEWS_PER_RUN) { report.skipped++; continue; }
    try {
      const snap = await caseClient(id).snapshot();
      if (!changedSince(snap, now.getTime() - 86_400_000)) { report.skipped++; continue; }
      const o = await review(env, id);
      report[o.status === "reviewed" ? "reviewed" : "unchanged"]++;
      report.costUsd += o.costUsd;
    } catch (e) {
      const code = e instanceof StrategistError ? e.code : e instanceof CaseClientError ? (e.code ?? "case_unavailable") : "internal";
      if (code === "empty_case") report.skipped++;
      else report.failed.push({ userId: id, code });
    }
  }
  return report;
}

/** For the inbox watcher: review after a new official letter landed. Never throws; returns null on any failure. */
export async function reviewAfterNewLetter(env: Env, userId: string): Promise<ReviewOutcome | null> {
  try {
    return await runReview(env, userId);
  } catch {
    return null;
  }
}

export { LIMITS };
