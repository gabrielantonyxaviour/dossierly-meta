import { FOUNDING_GROSZ, MIN_CHARGE_GROSZ, PLANS, REFERRAL_GROSZ, type PaidPlan } from "./plans";

export type PriceInput = { plan: PaidPlan; founding: boolean; referral: boolean; creditGrosz: number };
export type Price = { baseGrosz: number; referralDiscountGrosz: number; creditGrosz: number; amountGrosz: number };

/**
 * The only place a charge is computed. Referral discount first, then credit; the total never drops
 * below MIN_CHARGE_GROSZ, and credit spent is whatever fits above that floor.
 */
export function computePrice({ plan, founding, referral, creditGrosz }: PriceInput): Price {
  const baseGrosz = founding && plan === "one_case" ? FOUNDING_GROSZ : PLANS[plan].priceGrosz;
  const room = baseGrosz - MIN_CHARGE_GROSZ;
  const referralDiscountGrosz = referral ? Math.min(REFERRAL_GROSZ, room) : 0;
  const credit = Math.max(0, Math.min(Math.floor(creditGrosz), room - referralDiscountGrosz));
  return { baseGrosz, referralDiscountGrosz, creditGrosz: credit, amountGrosz: baseGrosz - referralDiscountGrosz - credit };
}
