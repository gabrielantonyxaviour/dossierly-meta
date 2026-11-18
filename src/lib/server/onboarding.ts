import type { Env } from "./env";
import { ApiError } from "./http";

/**
 * Onboarding progress (D1 onboarding_progress). Only the step and completion time live here; every answer
 * is written to the server case (CaseDO profile) as it is given, so an unfinished setup resumes anywhere.
 * D1 keeps steps 1..6 (CHECK constraint in 0005). The nine-step residence setup form stores its exact step in the
 * case profile (setupStep) and records min(step, 6) here. Completion opens the case home.
 */
export const ONBOARDING_STEPS = 6;
export type OnboardingStatus = "new" | "in_progress" | "completed";
export type OnboardingState = { status: OnboardingStatus; step: number; revision: number; completedAt: string | null };

type Row = { step: number; revision: number; completed_at: number | null };
const empty = (): OnboardingState => ({ status: "new", step: 1, revision: 0, completedAt: null });

export async function getOnboarding(env: Env, accountId: string): Promise<OnboardingState> {
  const row = await env.DB.prepare("SELECT step,revision,completed_at FROM onboarding_progress WHERE account_id = ?").bind(accountId).first<Row>();
  if (!row) return empty();
  return {
    status: row.completed_at !== null ? "completed" : "in_progress",
    step: Math.min(Math.max(row.step, 1), ONBOARDING_STEPS),
    revision: row.revision,
    completedAt: row.completed_at === null ? null : new Date(row.completed_at).toISOString(),
  };
}

async function write(env: Env, accountId: string, step: number, completedAt: number | null): Promise<OnboardingState> {
  const now = Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO onboarding_progress (account_id,updated_at) VALUES (?,?)").bind(accountId, now).run();
  await env.DB.prepare("UPDATE onboarding_progress SET step=?,revision=revision+1,completed_at=?,updated_at=? WHERE account_id=?")
    .bind(step, completedAt, now, accountId).run();
  return getOnboarding(env, accountId);
}

/** Moves to a step. Going back is allowed; a completed setup stays completed. */
export async function setOnboardingStep(env: Env, accountId: string, step: number): Promise<OnboardingState> {
  if (!Number.isInteger(step) || step < 1 || step > ONBOARDING_STEPS) throw new ApiError(400, "Unknown setup step", "invalid_step");
  const old = await getOnboarding(env, accountId);
  return write(env, accountId, step, old.completedAt ? Date.parse(old.completedAt) : null);
}

export async function completeOnboarding(env: Env, accountId: string): Promise<OnboardingState> {
  const old = await getOnboarding(env, accountId);
  if (old.status === "completed") return old;
  return write(env, accountId, ONBOARDING_STEPS, Date.now());
}

/** Starts setup again for the same server case (answers stay; they are pre-filled). */
export async function restartOnboarding(env: Env, accountId: string): Promise<OnboardingState> {
  return write(env, accountId, 1, null);
}
