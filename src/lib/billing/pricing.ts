import { foundingDiscountGrosz, MIN_CHARGE_GROSZ, PLANS, REFERRAL_GROSZ, type PaidPlan } from "./plans";

export type PriceInput = { plan: PaidPlan; founding: boolean; referral: boolean; creditGrosz: number };
export type Price = { baseGrosz: number; foundingDiscountGrosz: number; referralDiscountGrosz: number; creditGrosz: number; amountGrosz: number };

/**
 * The only place a charge is computed. Dodo takes one discount code per checkout, so founding (the FOUNDING100 code,
 * One case only) never stacks with the referral discount or credit: when founding applies, both are zero and credit stays on the balance.
 * Otherwise referral discount first, then credit; the total never drops below MIN_CHARGE_GROSZ.
 */
export function computePrice({ plan, founding, referral, creditGrosz }: PriceInput): Price {
  const baseGrosz = PLANS[plan].priceGrosz;
  if (founding && plan === "one_case") {
    const off = foundingDiscountGrosz(baseGrosz);
    return { baseGrosz, foundingDiscountGrosz: off, referralDiscountGrosz: 0, creditGrosz: 0, amountGrosz: baseGrosz - off };
  }
  const room = baseGrosz - MIN_CHARGE_GROSZ;
  const referralDiscountGrosz = referral ? Math.min(REFERRAL_GROSZ, room) : 0;
  const credit = Math.max(0, Math.min(Math.floor(creditGrosz), room - referralDiscountGrosz));
  return { baseGrosz, foundingDiscountGrosz: 0, referralDiscountGrosz, creditGrosz: credit, amountGrosz: baseGrosz - referralDiscountGrosz - credit };
}
