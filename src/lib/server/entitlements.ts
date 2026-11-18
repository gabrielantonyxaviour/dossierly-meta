import { activeEntitlement, legacyPass, type Active } from "@/lib/billing/store";
import { FREE_LETTERS, HOUSEHOLD_PEOPLE, type PlanKind } from "@/lib/billing/plans";
import type { Env } from "./env";
import { ApiError } from "./http";
import { randomId } from "./util";

export const LETTER_LIMIT_MESSAGE = `You have used your ${FREE_LETTERS} free letters. Choose One case or Household year to read more.`;

/** The plan that applies to an account right now. Expired and revoked grants fall back to free. */
export async function resolvePlan(env: Env, accountId: string, now = Date.now()): Promise<{ kind: PlanKind; expiresAt: number | null; peopleLimit: number }> {
  const a: Active | null = (await activeEntitlement(env, accountId, now)) ?? (await legacyPass(env, accountId, now));
  if (!a) return { kind: "free", expiresAt: null, peopleLimit: 1 };
  return { kind: a.plan, expiresAt: a.expiresAt === Number.MAX_SAFE_INTEGER ? null : a.expiresAt, peopleLimit: a.peopleLimit };
}

/** Free accounts read FREE_LETTERS letters over their lifetime; any live paid plan is unlimited. */
export function letterAllowed(plan: { kind: string }, lettersUsed: number): boolean {
  return plan.kind !== "free" || lettersUsed < FREE_LETTERS;
}

/** Throws 402 `payment_required` when the free allowance is used up and no paid plan is live. */
export async function assertCanReadLetter(env: Env, accountId: string, lettersUsed: number): Promise<void> {
  if (letterAllowed(await resolvePlan(env, accountId), lettersUsed)) return;
  throw new ApiError(402, LETTER_LIMIT_MESSAGE, "payment_required");
}

/** Records one letter read for the account. The gate is `assertCanReadLetter`, run before the read. */
export async function spendLetter(env: Env, accountId: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET letters_used = letters_used + 1 WHERE id = ?").bind(accountId).run();
}

export type Member = { id: string; name: string };

export async function listMembers(env: Env, holderId: string): Promise<Member[]> {
  const { results } = await env.DB.prepare("SELECT id, name FROM household_members WHERE holder_id = ? ORDER BY created_at, id").bind(holderId).all<Member>();
  return results;
}

/** Adds a family member in one conditional insert: a live Household year and fewer than 3 members already. */
export async function addMember(env: Env, holderId: string, name: string): Promise<Member> {
  const plan = await resolvePlan(env, holderId);
  if (plan.kind !== "household_year") throw new ApiError(402, "Family members need a Household year", "payment_required");
  const id = randomId("hm", 9);
  const res = await env.DB.prepare(
    "INSERT INTO household_members (id, holder_id, name, created_at) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM household_members WHERE holder_id = ?) < ?",
  ).bind(id, holderId, name, Date.now(), holderId, HOUSEHOLD_PEOPLE - 1).run();
  if (!res.meta?.changes) throw new ApiError(409, "A Household year covers you and up to 3 family members", "household_full");
  return { id, name };
}

export async function removeMember(env: Env, holderId: string, memberId: string): Promise<boolean> {
  const r = await env.DB.prepare("DELETE FROM household_members WHERE id = ? AND holder_id = ?").bind(memberId, holderId).run();
  return !!r.meta?.changes;
}
