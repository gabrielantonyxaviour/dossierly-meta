import type { Env } from "@/lib/server/env";
import { listMembers, resolvePlan, type Member } from "@/lib/server/entitlements";
import { FOUNDING_CAP, FOUNDING_GROSZ, FREE_LETTERS, HOUSEHOLD_PEOPLE, PLANS, REFERRAL_GROSZ, RENEWAL_WINDOW_DAYS, type PlanKind } from "./plans";
import { creditBalance, foundingSeatsLeft, referralCodeOf } from "./store";

export type BillingStatus = {
  plan: PlanKind;
  planName: string;
  expiresAt: string | null;
  /** Household year only: true from 30 days before expiry (and after it lapses, until renewed). */
  renewalDue: boolean;
  lettersUsed: number;
  freeLetters: number;
  lettersLeft: number | null;
  foundingSeatsLeft: number;
  foundingCap: number;
  foundingPriceGrosz: number;
  referralCode: string | null;
  referralRewardGrosz: number;
  creditGrosz: number;
  household: { limit: number; members: Member[]; slotsLeft: number } | null;
  prices: { oneCaseGrosz: number; householdYearGrosz: number; currency: "PLN" };
};

export async function billingStatus(env: Env, accountId: string, lettersUsed: number, now = Date.now()): Promise<BillingStatus> {
  const plan = await resolvePlan(env, accountId, now);
  const lapsed = plan.kind === "free"
    ? await env.DB.prepare("SELECT 1 AS x FROM entitlements WHERE user_id = ? AND plan = 'household_year' AND revoked_at IS NULL AND expires_at <= ? LIMIT 1").bind(accountId, now).first()
    : null;
  const members = plan.kind === "household_year" ? await listMembers(env, accountId) : [];
  const soon = plan.kind === "household_year" && plan.expiresAt !== null && plan.expiresAt - now <= RENEWAL_WINDOW_DAYS * 86_400_000;
  return {
    plan: plan.kind,
    planName: plan.kind === "free" ? "Free" : PLANS[plan.kind].name,
    expiresAt: plan.expiresAt ? new Date(plan.expiresAt).toISOString() : null,
    renewalDue: soon || !!lapsed,
    lettersUsed,
    freeLetters: FREE_LETTERS,
    lettersLeft: plan.kind === "free" ? Math.max(0, FREE_LETTERS - lettersUsed) : null,
    foundingSeatsLeft: await foundingSeatsLeft(env, now),
    foundingCap: FOUNDING_CAP,
    foundingPriceGrosz: FOUNDING_GROSZ,
    referralCode: await referralCodeOf(env, accountId),
    referralRewardGrosz: REFERRAL_GROSZ,
    creditGrosz: await creditBalance(env, accountId),
    household: plan.kind === "household_year" ? { limit: HOUSEHOLD_PEOPLE, members, slotsLeft: Math.max(0, HOUSEHOLD_PEOPLE - 1 - members.length) } : null,
    prices: { oneCaseGrosz: PLANS.one_case.priceGrosz, householdYearGrosz: PLANS.household_year.priceGrosz, currency: "PLN" },
  };
}
