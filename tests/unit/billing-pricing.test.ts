import { afterEach, describe, expect, it, vi } from "vitest";
import { addMonths, FOUNDING_CAP, foundingDiscountGrosz, MIN_CHARGE_GROSZ } from "@/lib/billing/plans";
import { computePrice } from "@/lib/billing/pricing";
import { creditBalance, foundingClaimed } from "@/lib/billing/store";
import { ApiError } from "@/lib/server/http";
import { buy, checkout, newUser, pay, stubDodo, testEnv } from "./billing-helpers";

afterEach(() => vi.unstubAllGlobals());

describe("computePrice", () => {
  it("uses the plan prices, founding price, referral discount and credit", () => {
    expect(computePrice({ plan: "one_case", founding: false, referral: false, creditGrosz: 0 }).amountGrosz).toBe(19_900);
    expect(computePrice({ plan: "household_year", founding: false, referral: false, creditGrosz: 0 }).amountGrosz).toBe(39_900);
    expect(computePrice({ plan: "one_case", founding: true, referral: false, creditGrosz: 0 }).amountGrosz).toBe(9_900);
    expect(computePrice({ plan: "household_year", founding: true, referral: false, creditGrosz: 0 }).baseGrosz).toBe(39_900);
    expect(computePrice({ plan: "one_case", founding: true, referral: true, creditGrosz: 4_000 })).toMatchObject({ referralDiscountGrosz: 0, creditGrosz: 0, amountGrosz: 9_900 });
    expect(computePrice({ plan: "one_case", founding: false, referral: true, creditGrosz: 4_000 })).toMatchObject({ referralDiscountGrosz: 4_000, creditGrosz: 4_000, amountGrosz: 11_900 });
  });

  it("never goes below the minimum charge or negative, whatever the credit", () => {
    for (const credit of [0, 1, 9_999, 100_000, 10 ** 9, -500, 3.7]) {
      for (const referral of [true, false]) {
        const p = computePrice({ plan: "one_case", founding: true, referral, creditGrosz: credit });
        expect(p.amountGrosz).toBeGreaterThanOrEqual(MIN_CHARGE_GROSZ);
        expect(p.creditGrosz).toBeGreaterThanOrEqual(0);
        expect(p.baseGrosz - p.foundingDiscountGrosz - p.referralDiscountGrosz - p.creditGrosz).toBe(p.amountGrosz);
      }
    }
  });

  it("adds calendar months, clamping to month end", () => {
    expect(new Date(addMonths(Date.UTC(2026, 7, 31), 18)).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(new Date(addMonths(Date.UTC(2026, 10, 18), 12)).toISOString().slice(0, 10)).toBe("2027-11-18");
  });
});

describe("founding cap", () => {
  it("never sells more than 100 founding seats under concurrent checkouts", async () => {
    stubDodo();
    const env = testEnv();
    const users = await Promise.all(Array.from({ length: 130 }, (_, i) => newUser(env, `u_race_${i}`)));
    const results = await Promise.all(users.map((u) => checkout(env, u, "one_case")));
    expect(results.filter((r) => r.founding)).toHaveLength(FOUNDING_CAP);
    expect(results.filter((r) => !r.founding).every((r) => r.price.amountGrosz === 19_900)).toBe(true);
    expect(results.filter((r) => r.founding).every((r) => r.price.amountGrosz === 9_900)).toBe(true);
    expect(await foundingClaimed(env)).toBe(FOUNDING_CAP);
  });

  it("frees an abandoned seat when the same person restarts, and refunded seats stay used", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_restart");
    const a = await checkout(env, u, "one_case");
    const b = await checkout(env, u, "one_case");
    expect(a.founding && b.founding).toBe(true);
    expect(await foundingClaimed(env)).toBe(1);
    await pay(env, b.purchaseId, 9_900);
    await pay(env, b.purchaseId, 9_900, "refund.succeeded", { amount: 9_900 });
    expect(await foundingClaimed(env)).toBe(1);
    expect((await checkout(env, u, "one_case")).founding).toBe(false);
  });

  it("gives household years the normal price, never founding", async () => {
    stubDodo();
    const env = testEnv();
    const r = await checkout(env, await newUser(env, "u_h"), "household_year");
    expect(r).toMatchObject({ founding: false, price: { amountGrosz: 39_900 } });
  });
});

describe("checkout", () => {
  it("rejects an unknown or own referral code and a code from a returning payer", async () => {
    stubDodo();
    const env = testEnv();
    const a = await newUser(env, "u_a");
    await buy(env, a, "one_case");
    const code = (await env.DB.prepare("SELECT code FROM referral_codes WHERE user_id = ?").bind(a).first<{ code: string }>())!.code;
    await expect(checkout(env, a, "one_case", code)).rejects.toMatchObject({ code: "referral_invalid" });
    const b = await newUser(env, "u_b");
    await expect(checkout(env, b, "one_case", "DOSS-NOPE22")).rejects.toMatchObject({ code: "referral_invalid" });
    await buy(env, b, "one_case");
    const c = await newUser(env, "u_c");
    await buy(env, c, "one_case");
    await expect(checkout(env, c, "household_year", code)).rejects.toMatchObject({ code: "referral_not_eligible" });
  });

  it("founding checkout applies FOUNDING100 to the One case product, total 9900 grosz, no runtime discount", async () => {
    const calls = stubDodo();
    const env = testEnv();
    const r = await checkout(env, await newUser(env, "u_f1"), "one_case");
    expect(r.founding).toBe(true);
    expect(r.price).toMatchObject({ baseGrosz: 19_900, foundingDiscountGrosz: 10_000, amountGrosz: 9_900 });
    expect(foundingDiscountGrosz(19_900)).toBe(10_000); // 19900 * 0.5025 = 9999.75, rounded like Dodo
    expect(calls.some((c) => c.path === "/discounts")).toBe(false);
    expect(calls.filter((c) => c.path === "/checkouts").at(-1)!.body).toMatchObject({
      billing_currency: "PLN", product_cart: [{ product_id: "pdt_one", quantity: 1 }], discount_codes: ["FOUNDING100"],
    });
    const row = await env.DB.prepare("SELECT amount_grosz, dodo_discount_code FROM purchases WHERE id = ?").bind(r.purchaseId).first();
    expect(row).toMatchObject({ amount_grosz: 9_900, dodo_discount_code: "FOUNDING100" });
  });

  it("household never gets FOUNDING100", async () => {
    const calls = stubDodo();
    const env = testEnv();
    const r = await checkout(env, await newUser(env, "u_f2"), "household_year");
    expect(r.founding).toBe(false);
    const body = calls.filter((c) => c.path === "/checkouts").at(-1)!.body;
    expect(body.discount_codes).toBeUndefined();
    expect(body.product_cart).toEqual([{ product_id: "pdt_house", quantity: 1 }]);
  });

  it("founding and referral do not stack, yet the referrer is still credited", async () => {
    const calls = stubDodo();
    const env = testEnv();
    const a = await newUser(env, "u_ra");
    await buy(env, a, "one_case");
    const code = (await env.DB.prepare("SELECT code FROM referral_codes WHERE user_id = ?").bind(a).first<{ code: string }>())!.code;
    const b = await newUser(env, "u_rb");
    const r = await checkout(env, b, "one_case", code.toLowerCase());
    expect(r.founding).toBe(true);
    expect(r.price).toMatchObject({ referralDiscountGrosz: 0, creditGrosz: 0, amountGrosz: 9_900 });
    expect(calls.filter((c) => c.path === "/checkouts").at(-1)!.body.discount_codes).toEqual(["FOUNDING100"]);
    expect(await creditBalance(env, a)).toBe(0);
    await pay(env, r.purchaseId, r.price.amountGrosz);
    expect(await creditBalance(env, a)).toBe(4_000);
  });

  it("when founding seats are gone, referral falls back to a runtime single-use flat code", async () => {
    const calls = stubDodo();
    const env = testEnv();
    const a = await newUser(env, "u_rfa");
    await buy(env, a, "one_case");
    const code = (await env.DB.prepare("SELECT code FROM referral_codes WHERE user_id = ?").bind(a).first<{ code: string }>())!.code;
    for (let i = 0; i < FOUNDING_CAP; i++) {
      await env.DB.prepare("INSERT INTO purchases (id, user_id, plan, base_grosz, amount_grosz, founding, status, reserved_until, created_at) VALUES (?, ?, 'one_case', 19900, 9900, 1, 'succeeded', 0, 0)").bind(`pur_fill_${i}`, `u_fill_${i}`).run();
    }
    const b = await newUser(env, "u_rfb");
    const r = await checkout(env, b, "one_case", code);
    expect(r.founding).toBe(false);
    expect(r.price).toMatchObject({ baseGrosz: 19_900, referralDiscountGrosz: 4_000, amountGrosz: 15_900 });
    const disc = calls.find((c) => c.path === "/discounts" && (c.body.metadata as { purchase_id: string }).purchase_id === r.purchaseId)!;
    expect(disc.body).toMatchObject({ type: "flat", amount: 4_000, usage_limit: 1 });
    const session = calls.filter((c) => c.path === "/checkouts").at(-1)!;
    expect(session.body).toMatchObject({ billing_currency: "PLN", product_cart: [{ product_id: "pdt_one", quantity: 1 }] });
    expect(session.body.discount_codes).toEqual([disc.body.code]);
  });

  it("fails cleanly when Dodo is down and releases the seat", async () => {
    const env = testEnv();
    await checkout((stubDodo(), env), await newUser(env, "u_pre"), "one_case");
    vi.unstubAllGlobals();
    stubDodo(true);
    const d = await newUser(env, "u_rd");
    const err = await checkout(env, d, "one_case").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(await foundingClaimed(env)).toBe(1); // the failed attempt released its seat
  });
});
