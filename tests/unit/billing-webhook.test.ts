import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyWebhook } from "@/lib/billing/dodo";
import { addMonths, FREE_LETTERS } from "@/lib/billing/plans";
import { billingStatus } from "@/lib/billing/status";
import { creditBalance, referralCodeOf } from "@/lib/billing/store";
import { POST as webhookRoute } from "@/app/api/billing/webhook/route";
import { addMember, assertCanReadLetter, letterAllowed, resolvePlan } from "@/lib/server/entitlements";
import { buy, checkout, newUser, pay, stubDodo, testEnv } from "./billing-helpers";

afterEach(() => vi.unstubAllGlobals());

const secret = "whsec_" + btoa("super-secret-key-for-tests-000000");
async function sign(id: string, ts: number, body: string, key = secret): Promise<string> {
  const raw = Uint8Array.from(atob(key.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return "v1," + btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${body}`)))));
}
const hdr = (id: string, ts: number, sig: string) => new Headers({ "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": sig });

describe("webhook signature", () => {
  const now = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type: "payment.succeeded", data: {} });

  it("accepts a valid Standard Webhooks signature, including among rotated ones", async () => {
    const good = await sign("evt_1", now, body);
    expect(await verifyWebhook(secret, hdr("evt_1", now, good), body)).toBe(true);
    expect(await verifyWebhook(secret, hdr("evt_1", now, `v1,AAAA ${good}`), body)).toBe(true);
  });

  it("rejects a bad signature, a tampered body, a stale timestamp, missing headers and no secret", async () => {
    const good = await sign("evt_1", now, body);
    const other = "whsec_" + btoa("a-different-secret-key-0000000000");
    expect(await verifyWebhook(secret, hdr("evt_1", now, await sign("evt_1", now, body, other)), body)).toBe(false);
    expect(await verifyWebhook(secret, hdr("evt_1", now, good), body + " ")).toBe(false);
    expect(await verifyWebhook(secret, hdr("evt_1", now - 3_600, await sign("evt_1", now - 3_600, body)), body)).toBe(false);
    expect(await verifyWebhook(secret, new Headers(), body)).toBe(false);
    expect(await verifyWebhook("", hdr("evt_1", now, good), body)).toBe(false);
  });

  it("the route answers 401 and grants nothing for an unsigned or forged call", async () => {
    const res = await webhookRoute(new Request("http://x/api/billing/webhook", { method: "POST", body, headers: hdr("evt_x", now, "v1,forged") }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid signature", code: "invalid_signature" });
  });
});

describe("grants and idempotency", () => {
  it("grants on payment.succeeded only, once per webhook id and once per purchase", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_grant");
    const c = await checkout(env, u, "one_case");
    expect((await pay(env, c.purchaseId, c.price.amountGrosz, "payment.failed")).outcome).toBe("ignored");
    expect((await resolvePlan(env, u)).kind).toBe("free");
    const evt = { type: "payment.succeeded", data: { payment_id: "pay_1", metadata: { purchase_id: c.purchaseId }, total_amount: c.price.amountGrosz, currency: "PLN" } };
    const { processWebhook } = await import("@/lib/billing/webhook");
    expect((await processWebhook(env, "evt_dup", evt)).outcome).toBe("granted");
    expect((await processWebhook(env, "evt_dup", evt)).outcome).toBe("duplicate");
    expect((await processWebhook(env, "evt_other", evt)).outcome).toBe("granted"); // redelivery with a new id
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM entitlements WHERE user_id = ?").bind(u).first<{ n: number }>();
    expect(n!.n).toBe(1);
    expect((await resolvePlan(env, u)).kind).toBe("one_case");
    expect(await referralCodeOf(env, u)).toMatch(/^DOSS-[A-Z2-9]{6}$/);
  });

  it("refuses an underpayment, a wrong currency and an unknown purchase", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_bad");
    const c = await checkout(env, u, "one_case");
    expect((await pay(env, c.purchaseId, 100)).outcome).toBe("underpaid");
    expect((await pay(env, c.purchaseId, c.price.amountGrosz, "payment.succeeded", { currency: "USD" })).outcome).toBe("wrong_currency");
    expect((await pay(env, "pur_missing", 9_900)).outcome).toBe("unknown_purchase");
    expect((await resolvePlan(env, u)).kind).toBe("free");
  });

  it("revokes the entitlement on a full refund and ignores a partial one", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_ref");
    const c = await buy(env, u, "one_case");
    expect((await pay(env, c.purchaseId, 0, "refund.succeeded", { amount: 1_000 })).outcome).toBe("partial_refund_ignored");
    expect((await resolvePlan(env, u)).kind).toBe("one_case");
    expect((await pay(env, c.purchaseId, 0, "refund.succeeded", { amount: c.price.amountGrosz })).outcome).toBe("revoked");
    expect((await resolvePlan(env, u)).kind).toBe("free");
    expect((await billingStatus(env, u, 0)).plan).toBe("free");
  });
});

describe("entitlement terms", () => {
  it("a One case lasts 18 months from purchase, then falls back to free", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_term");
    const c = await buy(env, u, "one_case");
    const paid = (await env.DB.prepare("SELECT paid_at FROM purchases WHERE id = ?").bind(c.purchaseId).first<{ paid_at: number }>())!.paid_at;
    const plan = await resolvePlan(env, u);
    expect(plan.expiresAt).toBe(addMonths(paid, 18));
    expect((await resolvePlan(env, u, addMonths(paid, 18) - 1)).kind).toBe("one_case");
    expect((await resolvePlan(env, u, addMonths(paid, 18) + 1)).kind).toBe("free");
  });

  it("a Household year lasts 12 months, flags renewal 30 days out, and a renewal stacks after expiry", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_year");
    await buy(env, u, "household_year");
    const first = (await resolvePlan(env, u)).expiresAt!;
    expect((await billingStatus(env, u, 0)).renewalDue).toBe(false);
    expect((await billingStatus(env, u, 0, first - 20 * 86_400_000)).renewalDue).toBe(true);
    const after = await billingStatus(env, u, 0, first + 1);
    expect(after).toMatchObject({ plan: "free", renewalDue: true });
    await buy(env, u, "household_year");
    expect((await resolvePlan(env, u)).expiresAt).toBe(addMonths(first, 12));
  });

  it("limits a household to the holder plus 3 family members, and only on a live Household year", async () => {
    stubDodo();
    const env = testEnv();
    const free = await newUser(env, "u_nofam");
    await expect(addMember(env, free, "Olena")).rejects.toMatchObject({ status: 402 });
    const one = await newUser(env, "u_onecase");
    await buy(env, one, "one_case");
    await expect(addMember(env, one, "Olena")).rejects.toMatchObject({ code: "payment_required" });
    const h = await newUser(env, "u_house");
    await buy(env, h, "household_year");
    await Promise.all(["Olena", "Maksym", "Iryna"].map((n) => addMember(env, h, n)));
    await expect(addMember(env, h, "Taras")).rejects.toMatchObject({ status: 409, code: "household_full" });
    const s = await billingStatus(env, h, 0);
    expect(s.household).toMatchObject({ limit: 4, slotsLeft: 0 });
    expect(s.household!.members).toHaveLength(3);
  });
});

describe("free letters", () => {
  it("allows 3 lifetime letters on Free, then 402 payment_required; paid plans are unlimited", async () => {
    stubDodo();
    const env = testEnv();
    const u = await newUser(env, "u_letters");
    expect(FREE_LETTERS).toBe(3);
    expect(letterAllowed({ kind: "free" }, 2)).toBe(true);
    expect(letterAllowed({ kind: "free" }, 3)).toBe(false);
    await expect(assertCanReadLetter(env, u, 2)).resolves.toBeUndefined();
    await expect(assertCanReadLetter(env, u, 3)).rejects.toMatchObject({ status: 402, code: "payment_required" });
    await buy(env, u, "one_case");
    await expect(assertCanReadLetter(env, u, 50)).resolves.toBeUndefined();
  });
});

describe("referral credit", () => {
  it("both sides get 40 zł: the referee at checkout, the referrer as credit on their next purchase", async () => {
    stubDodo();
    const env = testEnv();
    const a = await newUser(env, "u_refa");
    await buy(env, a, "one_case");
    const code = (await referralCodeOf(env, a))!;
    const b = await newUser(env, "u_refb");
    const cb = await checkout(env, b, "one_case", code);
    expect(await creditBalance(env, a)).toBe(0); // not before payment
    await pay(env, cb.purchaseId, cb.price.amountGrosz);
    expect(await creditBalance(env, a)).toBe(4_000);
    expect((await billingStatus(env, a, 0)).creditGrosz).toBe(4_000);

    const next = await checkout(env, a, "household_year");
    expect(next.price).toMatchObject({ baseGrosz: 39_900, creditGrosz: 4_000, amountGrosz: 35_900 });
    expect(await creditBalance(env, a)).toBe(0);
    await checkout(env, a, "household_year"); // restart: the abandoned one gives its credit back, the new one spends it
    expect(await creditBalance(env, a)).toBe(0);
  });

  it("claws the reward back when the referred purchase is refunded", async () => {
    stubDodo();
    const env = testEnv();
    const a = await newUser(env, "u_cla");
    await buy(env, a, "one_case");
    const b = await newUser(env, "u_clb");
    const cb = await buy(env, b, "one_case", (await referralCodeOf(env, a))!);
    expect(await creditBalance(env, a)).toBe(4_000);
    await pay(env, cb.purchaseId, 0, "refund.succeeded", { amount: cb.price.amountGrosz });
    expect(await creditBalance(env, a)).toBe(0);
  });

  it("two simultaneous checkouts cannot spend the same credit twice", async () => {
    stubDodo();
    const env = testEnv();
    const a = await newUser(env, "u_dbl");
    await buy(env, a, "one_case");
    const b = await newUser(env, "u_dblb");
    await buy(env, b, "one_case", (await referralCodeOf(env, a))!);
    const [x, y] = await Promise.all([checkout(env, a, "household_year"), checkout(env, a, "household_year")]);
    expect(x.price.creditGrosz + y.price.creditGrosz).toBeLessThanOrEqual(4_000);
    expect(await creditBalance(env, a)).toBeGreaterThanOrEqual(0);
  });
});
