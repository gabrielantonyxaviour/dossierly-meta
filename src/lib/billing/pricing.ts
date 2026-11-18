import { foundingDiscountGrosz, MIN_CHARGE_GROSZ, PLANS, REFERRAL_GROSZ, type PaidPlan } from "./plans";

/** `percentOff` is a promo code (may reach 0 zł) or, with `floor`, a whitelisted discount (never below MIN_CHARGE_GROSZ). It replaces founding, referral and credit. */
export type PriceInput = { plan: PaidPlan; founding: boolean; referral: boolean; creditGrosz: number; percentOff?: { percent: number; floor: boolean } };
export type Price = { baseGrosz: number; foundingDiscountGrosz: number; referralDiscountGrosz: number; creditGrosz: number; amountGrosz: number; promoDiscountGrosz: number };

/**
 * The only place a charge is computed. Dodo takes one discount code per checkout, so founding (the FOUNDING100 code,
 * One case only) never stacks with the referral discount or credit: when founding applies, both are zero and credit stays on the balance.
 * Otherwise referral discount first, then credit; the total never drops below MIN_CHARGE_GROSZ.
 */
export function computePrice({ plan, founding, referral, creditGrosz, percentOff }: PriceInput): Price {
  const baseGrosz = PLANS[plan].priceGrosz;
  if (percentOff) {
    const raw = Math.round((baseGrosz * percentOff.percent) / 100);
    const promoDiscountGrosz = percentOff.floor ? Math.min(raw, baseGrosz - MIN_CHARGE_GROSZ) : raw;
    return { baseGrosz, foundingDiscountGrosz: 0, referralDiscountGrosz: 0, creditGrosz: 0, promoDiscountGrosz, amountGrosz: baseGrosz - promoDiscountGrosz };
  }
  if (founding && plan === "one_case") {
    const off = foundingDiscountGrosz(baseGrosz);
    return { baseGrosz, foundingDiscountGrosz: off, referralDiscountGrosz: 0, creditGrosz: 0, amountGrosz: baseGrosz - off, promoDiscountGrosz: 0 };
  }
  const room = baseGrosz - MIN_CHARGE_GROSZ;
  const referralDiscountGrosz = referral ? Math.min(REFERRAL_GROSZ, room) : 0;
  const credit = Math.max(0, Math.min(Math.floor(creditGrosz), room - referralDiscountGrosz));
  return { baseGrosz, foundingDiscountGrosz: 0, referralDiscountGrosz, creditGrosz: credit, amountGrosz: baseGrosz - referralDiscountGrosz - credit, promoDiscountGrosz: 0 };
}
