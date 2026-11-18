/** Single source of truth for prices and limits. All money is in grosz (1 zł = 100), VAT included. */

export type PaidPlan = "one_case" | "household_year";
export type PlanKind = "free" | PaidPlan;

const PLANS_ONE_CASE_GROSZ = 19_900;
export const CURRENCY = "PLN";
export const FREE_LETTERS = 3;
export const FOUNDING_CAP = 100;
/** FOUNDING100 is a Dodo discount code on the One case product: 50.25% off 199 zł leaves 99 zł. Basis points, as Dodo stores percentages. */
export const FOUNDING_CODE_DEFAULT = "FOUNDING100";
export const FOUNDING_BASIS_POINTS = 5_025;
/** Same rounding as Dodo: the discount is rounded to the nearest grosz (9999.75 -> 10000), so the total is 9900. */
export const foundingDiscountGrosz = (baseGrosz: number): number => Math.round((baseGrosz * FOUNDING_BASIS_POINTS) / 10_000);
export const FOUNDING_GROSZ = PLANS_ONE_CASE_GROSZ - foundingDiscountGrosz(PLANS_ONE_CASE_GROSZ);
export const REFERRAL_GROSZ = 4_000;
/** Smallest amount we ever charge, so discounts and credit can never reach zero or go negative. */
export const MIN_CHARGE_GROSZ = 500;
export const RESERVATION_MS = 24 * 60 * 60 * 1000; // matches Dodo's 24h checkout-session lifetime
export const RENEWAL_WINDOW_DAYS = 30;
/** Account holder plus three family members. */
export const HOUSEHOLD_PEOPLE = 4;

export const PLANS: Record<PaidPlan, { name: string; priceGrosz: number; months: number; people: number; blurb: string }> = {
  one_case: { name: "One case", priceGrosz: PLANS_ONE_CASE_GROSZ, months: 18, people: 1, blurb: "One person's residence case for 18 months. Pay once, nothing renews." },
  household_year: { name: "Household year", priceGrosz: 39_900, months: 12, people: HOUSEHOLD_PEOPLE, blurb: "Up to 4 people (you plus 3 family members) for a year. One payment, not a subscription." },
};

export const FREE_PLAN = {
  name: "Free", priceGrosz: 0,
  features: ["One case path", "Deadline calculator", `${FREE_LETTERS} letters explained (lifetime)`, "Email reminders"],
};

export const isPaidPlan = (v: unknown): v is PaidPlan => v === "one_case" || v === "household_year";
export const formatZl = (grosz: number): string => `${(grosz / 100).toFixed(grosz % 100 === 0 ? 0 : 2)} zł`;

/** Calendar-month arithmetic in UTC (18 months from 31 Aug lands on the last day of Feb). */
export function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}
