import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as summaryRoute } from "@/app/api/admin/summary/route";
import { DELETE as wlDelete, POST as wlPost } from "@/app/api/admin/whitelist/route";
import { POST as promoPost } from "@/app/api/admin/promos/route";
import { POST as promoDisable } from "@/app/api/admin/promos/disable/route";
import { GET as meRoute } from "@/app/api/me/route";
import { POST as checkoutRoute } from "@/app/api/billing/checkout/route";
import { adminEmails } from "@/lib/admin/auth";
import { applyWhitelist } from "@/lib/admin/whitelist";
import { resolvePlan } from "@/lib/server/entitlements";
import { emailAccount } from "@/lib/server/email-accounts";
import { getEnv, type Env } from "@/lib/server/env";
import { sessionCookie } from "@/lib/server/session";
import { requestEmailCode, verifyEmailCode } from "@/lib/server/email-auth";
import { checkout, pay } from "./billing-helpers";

const ORIGIN = "http://localhost:3000";
let env: Env;
let seq = 0;
beforeAll(() => {
  env = getEnv();
  Object.assign(env, { DODO_PAYMENTS_API_KEY: "test-key", DODO_ENV: "test_mode", APP_URL: ORIGIN, DODO_PRODUCT_ONE_CASE: "pdt_one", DODO_PRODUCT_HOUSEHOLD_YEAR: "pdt_house", DODO_FOUNDING_CODE: "", ADMIN_EMAILS: "" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

type Call = { method: string; path: string; body: Record<string, unknown> | null };
function stubDodo(opts: { failDiscount?: boolean; failZeroCheckout?: boolean } = {}): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { method: string; body?: string }) => {
    const path = new URL(url).pathname;
    const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ method: init.method, path, body });
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    if (path === "/discounts") return opts.failDiscount ? new Response("{}", { status: 500 }) : Response.json({ discount_id: `dsc_${calls.length}`, code: body?.code });
    if (opts.failZeroCheckout && body?.discount_codes) return new Response("{}", { status: 422 });
    return Response.json({ session_id: `cks_${calls.length}`, checkout_url: `https://test.checkout.dodopayments.com/session/cks_${calls.length}` });
  });
  return calls;
}

async function signIn(email: string): Promise<{ id: string; cookie: string }> {
  const id = await emailAccount(env, email, null, Date.now());
  return { id, cookie: (await sessionCookie(id, env)).split(";")[0] };
}
const call = (handler: (r: Request) => Promise<Response>, method: string, cookie: string | null, body?: unknown, path = "/api/admin/summary") =>
  handler(new Request(`${ORIGIN}${path}`, {
    method, headers: { origin: ORIGIN, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
const uniq = (p: string) => `${p}${++seq}@example.org`;
const WL = { email: "x@example.org", grant: { kind: "one_case" } };
const PROMO = { code: "SPRING-50", percent: 50, plans: ["one_case"] };

const routes: [string, (r: Request) => Promise<Response>, string, unknown][] = [
  ["GET summary", summaryRoute, "GET", undefined],
  ["POST whitelist", wlPost, "POST", WL],
  ["DELETE whitelist", wlDelete, "DELETE", { id: "wl_x" }],
  ["POST promos", promoPost, "POST", PROMO],
  ["POST promos/disable", promoDisable, "POST", { id: "pr_x" }],
];

describe("admin access", () => {
  it("answers 401 with no session on every admin route", async () => {
    for (const [, h, m, b] of routes) {
      const res = await call(h, m, null, b);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: "no_session" });
    }
  });

  it("answers 403 forbidden for a signed-in non-admin, leaks nothing, and audits the denial", async () => {
    const u = await signIn(uniq("someone"));
    for (const [, h, m, b] of routes) {
      const res = await call(h, m, u.cookie, b);
      expect(res.status).toBe(403);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: "You do not have access to this", code: "forbidden" });
    }
    const rows = await env.DB.prepare("SELECT actor, subject FROM audit_log WHERE action = 'admin.denied' AND actor LIKE 'someone%'").all<{ actor: string; subject: string }>();
    expect(rows.results.length).toBe(routes.length);
    expect(rows.results[0].actor).toMatch(/@example\.org$/);
  });

  it("allows both default admin emails (any case) and reports isAdmin on /api/me", async () => {
    for (const email of ["gabriel@larinova.com", "contact@cosmiclan.com"]) {
      const a = await signIn(email.toUpperCase().toLowerCase());
      expect((await call(summaryRoute, "GET", a.cookie)).status).toBe(200);
      const me = await (await call(meRoute, "GET", a.cookie, undefined, "/api/me")).json();
      expect(me.isAdmin).toBe(true);
    }
    const u = await signIn(uniq("plain"));
    expect((await (await call(meRoute, "GET", u.cookie, undefined, "/api/me")).json()).isAdmin).toBe(false);
  });

  it("does not treat an account without a verified email as admin, and ADMIN_EMAILS overrides the default list", async () => {
    await env.DB.prepare("INSERT INTO users (id, created_at, account_kind) VALUES ('dev1', 1, 'device')").run();
    const cookie = (await sessionCookie("dev1", env)).split(";")[0];
    expect((await call(summaryRoute, "GET", cookie)).status).toBe(403);
    env.ADMIN_EMAILS = " Boss@Example.org , other@example.org ";
    try {
      expect(adminEmails(env)).toEqual(["boss@example.org", "other@example.org"]);
      expect((await call(summaryRoute, "GET", (await signIn("boss@example.org")).cookie)).status).toBe(200);
      expect((await call(summaryRoute, "GET", (await signIn("gabriel@larinova.com")).cookie)).status).toBe(403);
    } finally { env.ADMIN_EMAILS = ""; }
  });

  it("rejects admin writes from another origin", async () => {
    const a = await signIn("gabriel@larinova.com");
    env.APP_ENV = "production";
    try {
      const res = await wlPost(new Request(`${ORIGIN}/api/admin/whitelist`, { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json", cookie: a.cookie }, body: JSON.stringify(WL) }));
      expect(res.status).toBe(403);
    } finally { env.APP_ENV = "local"; }
  });
});

describe("whitelist", () => {
  const admin = () => signIn("gabriel@larinova.com");

  it("adds, lists, validates, rejects duplicates and removes, with audit rows", async () => {
    const a = await admin();
    const email = uniq("wl");
    const res = await call(wlPost, "POST", a.cookie, { email: email.toUpperCase(), grant: { kind: "household_year" }, note: "press" });
    expect(res.status).toBe(200);
    const entry = await res.json();
    expect(entry).toMatchObject({ email, grant: { kind: "household_year" }, note: "press", createdBy: "gabriel@larinova.com", usedAt: null, usedByAccount: null, entryExpiresAt: null });
    expect((await call(wlPost, "POST", a.cookie, { email, grant: { kind: "one_case" } })).status).toBe(409);
    expect((await call(wlPost, "POST", a.cookie, { email: "nope", grant: { kind: "one_case" } })).status).toBe(400);
    expect((await call(wlPost, "POST", a.cookie, { email: uniq("d"), grant: { kind: "discount_percent", value: 0 } })).status).toBe(400);
    expect((await call(wlPost, "POST", a.cookie, { email: uniq("d"), grant: { kind: "one_case" }, entryExpiresAt: "2001-01-01" })).status).toBe(400);
    const sum = await (await call(summaryRoute, "GET", a.cookie)).json();
    expect(sum.whitelist.some((e: { id: string }) => e.id === entry.id)).toBe(true);
    expect(sum.audit.some((e: { action: string; subject: string }) => e.action === "whitelist.add" && e.subject === email)).toBe(true);
    expect(await (await call(wlDelete, "DELETE", a.cookie, { id: entry.id })).json()).toEqual({ ok: true });
    expect((await call(wlDelete, "DELETE", a.cookie, { id: entry.id })).status).toBe(404);
    expect((await (await call(summaryRoute, "GET", a.cookie)).json()).audit.some((e: { action: string }) => e.action === "whitelist.remove")).toBe(true);
  });

  it("grants once on sign-in with source whitelist, never twice, and audits it", async () => {
    const a = await admin();
    const email = uniq("grant");
    await call(wlPost, "POST", a.cookie, { email, grant: { kind: "household_year" } });
    const id = await emailAccount(env, email, null, Date.now());
    expect(await applyWhitelist(env, id, email)).toBe(true);
    expect(await resolvePlan(env, id)).toMatchObject({ kind: "household_year", peopleLimit: 4 });
    expect(await applyWhitelist(env, id, email)).toBe(false);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM entitlements WHERE user_id = ? AND source = 'whitelist'").bind(id).first<{ n: number }>();
    expect(n!.n).toBe(1);
    const entry = (await (await call(summaryRoute, "GET", a.cookie)).json()).whitelist.find((e: { email: string }) => e.email === email);
    expect(entry).toMatchObject({ usedByAccount: id });
    expect(entry.usedAt).not.toBeNull();
    const au = await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'whitelist.used' AND subject = ?").bind(email).first<{ n: number }>();
    expect(au!.n).toBe(1);
  });

  it("applies through the real email sign-in, once, however many times the person signs in", async () => {
    const a = await admin();
    const email = uniq("flow");
    await call(wlPost, "POST", a.cookie, { email, grant: { kind: "one_case" } });
    vi.useFakeTimers();
    const signInByCode = async () => {
      vi.advanceTimersByTime(61_000);
      const t = Date.now();
      let otp = "";
      const rq = new Request(`${ORIGIN}/api/auth/email/request`, { method: "POST" });
      const sent = await requestEmailCode(env, rq, { email }, async (_to, code) => { otp = code; }, t);
      const vr = new Request(`${ORIGIN}/api/auth/email/verify`, { method: "POST", headers: { cookie: sent.cookie.split(";")[0] } });
      return verifyEmailCode(env, vr, { challengeId: sent.body.challengeId, code: otp }, t);
    };
    const first = await signInByCode();
    expect((await resolvePlan(env, first.userId)).kind).toBe("one_case");
    const second = await signInByCode();
    expect(second.userId).toBe(first.userId);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM entitlements WHERE user_id = ?").bind(first.userId).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it("respects the entry expiry and the grant expiry", async () => {
    const a = await admin();
    const e1 = uniq("entryexp"), e2 = uniq("grantexp");
    const soon = new Date(Date.now() + 3_600_000).toISOString(), later = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await call(wlPost, "POST", a.cookie, { email: e1, grant: { kind: "one_case" }, entryExpiresAt: soon });
    await call(wlPost, "POST", a.cookie, { email: e2, grant: { kind: "one_case" }, grantExpiresAt: later });
    const id1 = await emailAccount(env, e1, null, Date.now()), id2 = await emailAccount(env, e2, null, Date.now());
    expect(await applyWhitelist(env, id1, e1, Date.now() + 2 * 3_600_000)).toBe(false);
    expect((await resolvePlan(env, id1)).kind).toBe("free");
    expect(await applyWhitelist(env, id2, e2)).toBe(true);
    expect((await resolvePlan(env, id2)).expiresAt).toBe(Date.parse(later));
  });

  it("matches the exact address only: a +tag entry is not the plain address and vice versa", async () => {
    const a = await admin();
    const base = uniq("tag");
    const tagged = base.replace("@", "+qa@");
    await call(wlPost, "POST", a.cookie, { email: tagged, grant: { kind: "one_case" } });
    const idPlain = await emailAccount(env, base, null, Date.now());
    expect(await applyWhitelist(env, idPlain, base)).toBe(false);
    const idTag = await emailAccount(env, tagged, null, Date.now());
    expect(await applyWhitelist(env, idTag, tagged.toUpperCase())).toBe(true);
    const other = uniq("tag2");
    await call(wlPost, "POST", a.cookie, { email: other, grant: { kind: "one_case" } });
    const idOtherTag = await emailAccount(env, other.replace("@", "+x@"), null, Date.now());
    expect(await applyWhitelist(env, idOtherTag, other.replace("@", "+x@"))).toBe(false);
  });

  it("a discount entry becomes a pending discount applied automatically at the next checkout", async () => {
    const a = await admin();
    const email = uniq("disc");
    await call(wlPost, "POST", a.cookie, { email, grant: { kind: "discount_percent", value: 25 } });
    const id = await emailAccount(env, email, null, Date.now());
    expect(await applyWhitelist(env, id, email)).toBe(true);
    expect((await resolvePlan(env, id)).kind).toBe("free");
    const calls = stubDodo();
    const c = await checkout(env, id, "one_case");
    expect(c.founding).toBe(false);
    expect(c.price).toMatchObject({ baseGrosz: 19_900, promoDiscountGrosz: 4_975, amountGrosz: 14_925 });
    const flat = calls.find((x) => x.path === "/discounts")!;
    expect(flat.body).toMatchObject({ type: "flat", amount: 4_975 });
    expect(calls.find((x) => x.path === "/checkouts")!.body!.discount_codes).toEqual([flat.body!.code]);
    // an abandoned checkout releases it; a paid one consumes it for good
    expect((await checkout(env, id, "household_year")).price.promoDiscountGrosz).toBe(9_975);
    const paid = await checkout(env, id, "one_case");
    await pay(env, paid.purchaseId, paid.price.amountGrosz);
    expect((await checkout(env, id, "household_year")).price.promoDiscountGrosz).toBe(0);
  });
});

describe("promos", () => {
  const admin = () => signIn("contact@cosmiclan.com");
  const codeOf = () => `T${++seq}-OFF`;

  it("creates a Dodo discount in the current mode, saves the promo, audits, and lists it", async () => {
    const a = await admin();
    const calls = stubDodo();
    const code = codeOf();
    const res = await call(promoPost, "POST", a.cookie, { code: code.toLowerCase(), percent: 100, plans: ["one_case"], maxUses: 5, perCustomer: 1, note: "launch" });
    expect(res.status).toBe(200);
    const p = await res.json();
    expect(p).toMatchObject({ code, kind: "percent", percent: 100, plans: ["one_case"], maxUses: 5, perCustomer: 1, uses: 0, active: true, createdBy: "contact@cosmiclan.com" });
    expect(p.dodoDiscountId).toMatch(/^dsc_/);
    expect(calls[0].body).toMatchObject({ type: "percentage", amount: 10_000, code, restricted_to: ["pdt_one"], usage_limit: 5, per_customer_usage_limit: 1 });
    const sum = await (await call(summaryRoute, "GET", a.cookie)).json();
    expect(sum.promos.some((x: { code: string }) => x.code === code)).toBe(true);
    expect(sum.audit.some((e: { action: string; subject: string }) => e.action === "promo.add" && e.subject === code)).toBe(true);
    expect((await call(promoPost, "POST", a.cookie, { code, percent: 10, plans: ["one_case"] })).status).toBe(409);
    for (const bad of [{ code: "AB", percent: 10, plans: ["one_case"] }, { code: "OKAY-1", percent: 101, plans: ["one_case"] }, { code: "OKAY-2", percent: 10, plans: [] }, { code: "FOUNDING100", percent: 10, plans: ["one_case"] }]) {
      expect((await call(promoPost, "POST", a.cookie, bad)).status).toBe(400);
    }
  });

  it("does not save the promo when Dodo fails (dodo_failed)", async () => {
    const a = await admin();
    stubDodo({ failDiscount: true });
    const code = codeOf();
    const res = await call(promoPost, "POST", a.cookie, { code, percent: 20, plans: ["one_case"] });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "dodo_failed" });
    expect(await env.DB.prepare("SELECT 1 AS x FROM promo_codes WHERE code = ?").bind(code).first()).toBeNull();
  });

  it("disables a promo and deletes the Dodo discount; checkout then says promo_invalid", async () => {
    const a = await admin();
    const calls = stubDodo();
    const code = codeOf();
    const p = await (await call(promoPost, "POST", a.cookie, { code, percent: 30, plans: ["one_case"] })).json();
    const d = await (await call(promoDisable, "POST", a.cookie, { id: p.id })).json();
    expect(d).toMatchObject({ id: p.id, active: false });
    expect(calls.some((c) => c.method === "DELETE" && c.path === `/discounts/${p.dodoDiscountId}`)).toBe(true);
    const u = await signIn(uniq("buyer"));
    const res = await call(checkoutRoute, "POST", u.cookie, { plan: "one_case", promoCode: code }, "/api/billing/checkout");
    expect(await res.json()).toMatchObject({ code: "promo_invalid" });
    expect((await call(promoDisable, "POST", a.cookie, { id: "pr_missing" })).status).toBe(404);
  });

  async function makePromo(over: Record<string, unknown> = {}) {
    const a = await admin();
    const code = codeOf();
    return { code, promo: await (await call(promoPost, "POST", a.cookie, { code, percent: 50, plans: ["one_case"], ...over })).json() };
  }
  const tryCheckout = (cookie: string, code: string, plan = "one_case") =>
    call(checkoutRoute, "POST", cookie, { plan, promoCode: code }, "/api/billing/checkout").then(async (r) => ({ status: r.status, body: await r.json() }));

  it("validates: invalid, not for plan, expired, not started, used up per customer and overall", async () => {
    stubDodo();
    const u = await signIn(uniq("val"));
    expect((await tryCheckout(u.cookie, "NOPE-CODE")).body.code).toBe("promo_invalid");
    const { code } = await makePromo();
    expect((await tryCheckout(u.cookie, code, "household_year")).body.code).toBe("promo_not_for_plan");
    const exp = await makePromo();
    await env.DB.prepare("UPDATE promo_codes SET expires_at = ? WHERE code = ?").bind(Date.now() - 1000, exp.code).run();
    expect((await tryCheckout(u.cookie, exp.code)).body.code).toBe("promo_expired");
    const fut = await makePromo();
    await env.DB.prepare("UPDATE promo_codes SET starts_at = ? WHERE code = ?").bind(Date.now() + 86_400_000, fut.code).run();
    expect((await tryCheckout(u.cookie, fut.code)).body.code).toBe("promo_invalid");

    // per customer 1: pay once, second checkout by the same buyer is used up
    const ok = await tryCheckout(u.cookie, code.toLowerCase());
    expect(ok.status).toBe(200);
    await pay(env, ok.body.purchaseId, ok.body.price.amountGrosz);
    expect((await tryCheckout(u.cookie, code)).body.code).toBe("promo_used_up");
    // maxUses 1: a different buyer is blocked once the first paid
    const one = await makePromo({ maxUses: 1 });
    const b1 = await signIn(uniq("m1")), b2 = await signIn(uniq("m2"));
    const first = await tryCheckout(b1.cookie, one.code);
    expect((await tryCheckout(b2.cookie, one.code)).body.code).toBe("promo_used_up"); // b1's open reservation holds the use
    await pay(env, first.body.purchaseId, first.body.price.amountGrosz);
    expect((await tryCheckout(b2.cookie, one.code)).body.code).toBe("promo_used_up");
  });

  it("a promo replaces founding and referral; the Dodo checkout carries the promo code; uses and audit count on webhook success only", async () => {
    const a = await admin();
    const calls = stubDodo();
    const { code, promo } = await makePromo({ percent: 50 });
    const u = await signIn(uniq("buyer"));
    const res = await call(checkoutRoute, "POST", u.cookie, { plan: "one_case", promoCode: code, referralCode: "DOSS-NOPE" }, "/api/billing/checkout");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ founding: false, price: { baseGrosz: 19_900, promoDiscountGrosz: 9_950, referralDiscountGrosz: 0, creditGrosz: 0, amountGrosz: 9_950 } });
    expect(calls.filter((c) => c.path === "/checkouts").at(-1)!.body!.discount_codes).toEqual([code]);
    expect(calls.some((c) => c.path === "/discounts" && c.body!.type === "flat")).toBe(false);
    let sum = await (await call(summaryRoute, "GET", a.cookie)).json();
    expect(sum.promos.find((p: { id: string }) => p.id === promo.id).uses).toBe(0);
    await pay(env, body.purchaseId, 9_950);
    await pay(env, body.purchaseId, 9_950); // a duplicate success counts nothing more
    sum = await (await call(summaryRoute, "GET", a.cookie)).json();
    expect(sum.promos.find((p: { id: string }) => p.id === promo.id).uses).toBe(1);
    expect(sum.audit.filter((e: { action: string; subject: string }) => e.action === "promo.used" && e.subject === code)).toHaveLength(1);
    expect((await resolvePlan(env, u.id)).kind).toBe("one_case");
  });

  it("a 100% promo opens a 0 zł Dodo checkout and the webhook grants; if Dodo refuses it, the grant is made app-side", async () => {
    stubDodo();
    const free = await makePromo({ percent: 100, perCustomer: 5 });
    const calls = stubDodo();
    const u = await signIn(uniq("zero"));
    const r = await (await call(checkoutRoute, "POST", u.cookie, { plan: "one_case", promoCode: free.code }, "/api/billing/checkout")).json();
    expect(r.price).toMatchObject({ amountGrosz: 0, promoDiscountGrosz: 19_900 });
    expect(r.checkoutUrl).toContain("checkout.dodopayments.com");
    expect(calls.at(-1)!.body!.discount_codes).toEqual([free.code]);
    expect((await resolvePlan(env, u.id)).kind).toBe("free");
    await pay(env, r.purchaseId, 0);
    expect((await resolvePlan(env, u.id)).kind).toBe("one_case");

    stubDodo({ failZeroCheckout: true });
    const w = await signIn(uniq("fallback"));
    const f = await (await call(checkoutRoute, "POST", w.cookie, { plan: "one_case", promoCode: free.code }, "/api/billing/checkout")).json();
    expect(f.checkoutUrl).toContain(`purchase=${f.purchaseId}`);
    expect(f.checkoutUrl.startsWith(ORIGIN)).toBe(true);
    expect((await resolvePlan(env, w.id)).kind).toBe("one_case");
    const st = await env.DB.prepare("SELECT status FROM purchases WHERE id = ?").bind(f.purchaseId).first<{ status: string }>();
    expect(st!.status).toBe("succeeded");
  });
});
