import { call } from "./api";

export type PaidPlan = "one_case" | "household_year";
export type BillingStatus = {
  plan: "free" | PaidPlan;
  planName: string;
  expiresAt: string | null;
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
  household: { limit: number; members: { id: string; name: string }[]; slotsLeft: number } | null;
  prices: { oneCaseGrosz: number; householdYearGrosz: number; currency: "PLN" };
};
export type Checkout = { checkoutUrl: string; founding: boolean; price: { baseGrosz: number; amountGrosz: number; currency: "PLN" } };

export const billing = {
  status: () => call<BillingStatus>("/api/billing/status"),
  checkout: (plan: PaidPlan, code?: { promoCode?: string; referralCode?: string }) =>
    call<Checkout>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, returnPath: "/plan?paid=1", ...(code?.promoCode ? { promoCode: code.promoCode } : {}), ...(code?.referralCode ? { referralCode: code.referralCode } : {}) }),
    }),
};

/** 19900 -> "199 zł"; 9950 -> "99,50 zł" (Polish decimal comma). */
export const zl = (grosz: number) => `${grosz % 100 === 0 ? grosz / 100 : (grosz / 100).toFixed(2).replace(".", ",")} zł`;
