import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { freshLocalEnv } from "@/lib/server/local";
import { checkEmailOrigin, requestEmailCode, verifyEmailCode } from "@/lib/server/email-auth";
import { accountFromCookie, createAccountUser, loadUserState, sessionCookie } from "@/lib/server/session";
import { sendEmailCode } from "@/lib/server/email-delivery";
import { emailAccount } from "@/lib/server/email-accounts";
import { POST as requestRoute } from "@/app/api/auth/email/request/route";
import { POST as verifyRoute } from "@/app/api/auth/email/verify/route";
import { getEnv } from "@/lib/server/env";

const req = (cookie = "", body?: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/auth/email/request", {
  method: "POST", headers: { origin, cookie, "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
});
let env = freshLocalEnv();
beforeEach(() => { env = freshLocalEnv(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function begin(email = "arjun.raman@example.org", accountCookie = "") {
  let otp = "";
  const send = vi.fn(async (_email: string, code: string) => { otp = code; });
  const sent = await requestEmailCode(env, req(accountCookie), { email }, send);
  return { sent, otp, send, cookie: [sent.cookie.split(";")[0], accountCookie].filter(Boolean).join("; "),
    input: { challengeId: sent.body.challengeId, code: otp } };
}

describe("email-code identity", () => {
  it("does not create an account before proof; stores only a digest and signs into the same identity again", async () => {
    vi.useFakeTimers();
    const b = await begin("  ARJUN.RAMAN@example.org  ");
    expect(b.send.mock.calls[0][0]).toBe("arjun.raman@example.org");
    expect(b.otp).toMatch(/^\d{6}$/);
    expect(JSON.stringify(b.sent)).not.toContain(`"code":"${b.otp}"`);
    expect(await env.DB.prepare("SELECT id FROM users").first()).toBeNull();
    const row = await env.DB.prepare("SELECT code_hash FROM email_login_challenges").first<{ code_hash: string }>();
    expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.code_hash).not.toBe(b.otp);
    const verified = await verifyEmailCode(env, req(b.cookie), b.input);
    expect(await accountFromCookie(verified.cookie, env)).toMatchObject({ accountId: verified.userId, accountKind: "email" });
    await expect(verifyEmailCode(env, req(b.cookie), b.input)).rejects.toMatchObject({ code: "expired_code" });
    vi.advanceTimersByTime(61_000);
    const again = await begin();
    const next = await verifyEmailCode(env, req(again.cookie), again.input);
    expect(next.userId).toBe(verified.userId);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())!.n).toBe(1);
  });

  it("allows only one concurrent redemption of a valid challenge", async () => {
    const b = await begin();
    const results = await Promise.allSettled([verifyEmailCode(env, req(b.cookie), b.input), verifyEmailCode(env, req(b.cookie), b.input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("preserves signed-in legacy account, payments and sample choice when adding a new verified email", async () => {
    await createAccountUser(env, "u_existing", "device");
    await env.DB.prepare("UPDATE users SET plan_kind = 'case_pass', plan_chosen = 1, credits = 7, active_case = 'sample' WHERE id = ?").bind("u_existing").run();
    const oldCookie = (await sessionCookie("u_existing", env)).split(";")[0];
    const b = await begin(undefined, oldCookie);
    expect((await verifyEmailCode(env, req(b.cookie), b.input)).userId).toBe("u_existing");
    expect(await loadUserState(env, "u_existing")).toMatchObject({ accountKind: "email", activeCase: "sample", planChosen: true, plan: { kind: "case_pass", creditsLeft: 7 } });
  });

  it("never merges an already verified identity with the browser's other account", async () => {
    const owner = await emailAccount(env, "arjun.raman@example.org", null, Date.now());
    await createAccountUser(env, "u_other", "device");
    const cookie = (await sessionCookie("u_other", env)).split(";")[0];
    const b = await begin(undefined, cookie);
    expect((await verifyEmailCode(env, req(b.cookie), b.input)).userId).toBe(owner);
    expect(await loadUserState(env, "u_other")).toMatchObject({ accountKind: "device" });
  });

  it("deduplicates concurrent first logins without orphan users", async () => {
    const ids = await Promise.all([emailAccount(env, "new@example.org", null, 100), emailAccount(env, "new@example.org", null, 100)]);
    expect(ids[0]).toBe(ids[1]);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())!.n).toBe(1);
  });
});

describe("code failure and abuse boundaries", () => {
  it("requires the requesting browser and does not burn guesses from another browser", async () => {
    const b = await begin();
    await expect(verifyEmailCode(env, req(), b.input)).rejects.toMatchObject({ code: "invalid_code" });
    await expect(verifyEmailCode(env, req(b.cookie.replace(/\.[^;]+/, ".wrong")), b.input)).rejects.toMatchObject({ code: "invalid_code" });
    expect((await verifyEmailCode(env, req(b.cookie), b.input)).userId).toMatch(/^u_/);
  });

  it("expires after ten minutes and locks after five wrong guesses including concurrent guesses", async () => {
    const b = await begin();
    await expect(verifyEmailCode(env, req(b.cookie), b.input, Date.now() + 601_000)).rejects.toMatchObject({ code: "expired_code" });
    const wrong = b.otp === "000000" ? "999999" : "000000";
    await Promise.allSettled(Array.from({ length: 8 }, () => verifyEmailCode(env, req(b.cookie), { ...b.input, code: wrong })));
    await expect(verifyEmailCode(env, req(b.cookie), b.input)).rejects.toMatchObject({ code: "too_many_attempts" });
    expect((await env.DB.prepare("SELECT attempts FROM email_login_challenges").first<{ attempts: number }>())!.attempts).toBe(5);
    expect(await env.DB.prepare("SELECT id FROM users").first()).toBeNull();
  });

  it("enforces resend cooldown; a delivered resend invalidates the previous code", async () => {
    vi.useFakeTimers();
    const first = await begin();
    await expect(begin()).rejects.toMatchObject({ code: "rate_limited" });
    vi.advanceTimersByTime(61_000);
    const second = await begin();
    await expect(verifyEmailCode(env, req(first.cookie), first.input)).rejects.toMatchObject({ code: "expired_code" });
    expect((await verifyEmailCode(env, req(second.cookie), second.input)).userId).toMatch(/^u_/);
  });

  it("provider failure gives no false success or usable challenge", async () => {
    await expect(requestEmailCode(env, req(), { email: "arjun.raman@example.org" }, async () => { throw new Error("private provider failure"); }))
      .rejects.toMatchObject({ status: 503, code: "email_unavailable" });
    expect(await env.DB.prepare("SELECT id FROM email_login_challenges").first()).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM users").first()).toBeNull();
  });

  it("refuses unconfigured sender and unexpected origins", async () => {
    await expect(requestEmailCode(env, req(), { email: "arjun.raman@example.org" })).rejects.toMatchObject({ code: "email_unavailable" });
    expect(() => checkEmailOrigin(req("", {}, "https://other.example"), env)).toThrow();
    expect(() => checkEmailOrigin(req(), env)).not.toThrow();
    const normalized = new Request("http://localhost:3242/api/auth/email/request", { headers: { origin: "http://127.0.0.1:3242", host: "127.0.0.1:3242" } });
    expect(() => checkEmailOrigin(normalized, env)).not.toThrow();
    expect(() => checkEmailOrigin(normalized, { ...env, APP_ENV: "production", APP_URL: "https://dossierly.pages.dev" })).toThrow();
  });
});

describe("email API and provider", () => {
  it("issues a cookie only after code verification and returns an email account payload", async () => {
    const liveEnv = getEnv(); liveEnv.EMAIL_FROM = "login@dossierly.example";
    let otp = "";
    (liveEnv as unknown as { EMAIL: unknown }).EMAIL = { send: vi.fn(async (message: { text: string }) => {
      otp = message.text.match(/is (\d{6})\./)![1];
      return { messageId: "email_test" };
    }) };
    const sent = await requestRoute(req("", { email: "arjun.route@example.org" }));
    expect(sent.status).toBe(200);
    const body = await sent.json();
    expect(sent.headers.get("set-cookie")).not.toContain("settla_uid");
    const verify = await verifyRoute(req(sent.headers.get("set-cookie")!.split(";")[0], { challengeId: body.challengeId, code: otp }));
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ accountKind: "email", activeCase: "own", planChosen: false });
    expect(verify.headers.get("set-cookie")).toContain("settla_uid=");
  });

  it("validates JSON/code shape and rejects cross-origin requests without contacting a provider", async () => {
    const send = vi.fn(); vi.stubGlobal("fetch", send);
    for (const input of [{ email: "not-an-address" }, { email: "arjun@example.org", surprise: true }]) {
      expect((await requestRoute(req("", input))).status).toBe(400);
    }
    expect((await verifyRoute(req("", { challengeId: "bad", code: "123" }))).status).toBe(400);
    expect((await requestRoute(req("", {}, "https://attacker.example"))).status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends through the Cloudflare email binding and sanitizes provider errors", async () => {
    const send = vi.fn(async (_message: Record<string, unknown>) => ({ messageId: "email_test" }));
    const bound = { ...env, EMAIL_FROM: "login@dossierly.example", EMAIL: { send } } as typeof env;
    await sendEmailCode(bound, "arjun@example.org", "123456", "challenge-test");
    const payload = send.mock.calls[0][0] as { to: string; from: { email: string }; html: string; text: string; headers: Record<string, string> };
    expect(payload).toMatchObject({ to: "arjun@example.org", from: { email: "login@dossierly.example", name: "Dossierly" } });
    expect(payload.headers["X-Entity-Ref-ID"]).toBe("dossierly-signin/challenge-test");
    expect(payload.html).toContain("123456");
    expect(payload.html).toContain("Your sign-in code");
    expect(payload.text).toContain("123456");
    const failing = { ...bound, EMAIL: { send: async () => { throw new Error("private provider detail"); } } } as typeof env;
    await expect(sendEmailCode(failing, "arjun@example.org", "123456", "other")).rejects.toMatchObject({ status: 503, code: "email_unavailable" });
    await expect(sendEmailCode({ ...env, EMAIL: undefined } as typeof env, "arjun@example.org", "123456", "x")).rejects.toMatchObject({ status: 503 });
  });
});
