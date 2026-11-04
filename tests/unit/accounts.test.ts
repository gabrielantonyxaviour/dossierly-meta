import { beforeEach, describe, expect, it, vi } from "vitest";

const letterResult = vi.hoisted(() => ({ readable: true }));
vi.mock("@/lib/features/letters", () => ({
  readLetter: async () => ({ letter: { readable: letterResult.readable, title: "Wezwanie" }, run: {}, runs: [] }),
}));

import { POST as readRoute } from "@/app/api/letters/read/route";
import { GET as meRoute } from "@/app/api/me/route";
import { POST as sessionRoute } from "@/app/api/session/route";
import { POST as signoutRoute } from "@/app/api/auth/signout/route";
import { getEnv } from "@/lib/server/env";
import { accountFromCookie, createAccountUser, ensureUser, requireUserState, sessionCookie, SAMPLE_USER_ID } from "@/lib/server/session";
import { randomId } from "@/lib/server/util";

const png = "data:image/png;base64,iVBORw0KGgo=";
const json = (cookie: string | null, path: string, body?: unknown, method = "POST") =>
  new Request(`http://x${path}`, { method, headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function newAccount(kind: "passkey" | "device" = "device") {
  const env = getEnv();
  const id = randomId("u", 9);
  await createAccountUser(env, id, kind);
  return { id, cookie: (await sessionCookie(id, env)).split(";")[0] };
}

beforeEach(() => { letterResult.readable = true; });

describe("account guard", () => {
  it("treats legacy anonymous cookies, the sample user and unsigned cookies as no session", async () => {
    const env = getEnv();
    await ensureUser(env, "u_legacy"); // an old anonymous row: no account_kind
    const legacy = (await sessionCookie("u_legacy", env)).split(";")[0];
    await ensureUser(env, SAMPLE_USER_ID);
    const sample = (await sessionCookie(SAMPLE_USER_ID, env)).split(";")[0];
    for (const cookie of [legacy, sample, "settla_uid=u_x.forged", null]) {
      await expect(requireUserState(json(cookie, "/api/me", undefined, "GET"))).rejects.toMatchObject({ status: 401, code: "no_session" });
      const res = await meRoute(json(cookie, "/api/me", undefined, "GET"));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "No active session", code: "no_session" });
      expect(await accountFromCookie(cookie, env)).toBeNull();
    }
    expect((await sessionRoute(json(legacy, "/api/session", { sample: true }))).status).toBe(401);
  });

  it("POST /api/session never creates users", async () => {
    const before = await getEnv().DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect((await sessionRoute(json(null, "/api/session", {}))).status).toBe(401);
    const after = await getEnv().DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(after!.n).toBe(before!.n);
  });

  it("sign-out clears the session cookie", async () => {
    expect((await signoutRoute()).headers.get("set-cookie")).toMatch(/settla_uid=;.*Max-Age=0/);
  });

  it("switching to the sample case keeps the account and maps requests to sample-arjun", async () => {
    const { id, cookie } = await newAccount();
    let me = await (await sessionRoute(json(cookie, "/api/session", { sample: true }))).json();
    expect(me).toMatchObject({ accountId: id, activeCase: "sample" });
    const s = await requireUserState(json(cookie, "/api/me", undefined, "GET"));
    expect(s.userId).toBe(SAMPLE_USER_ID);
    expect(s.accountId).toBe(id);
    me = await (await meRoute(json(cookie, "/api/me", undefined, "GET"))).json();
    expect(me.accountId).toBe(id);
    me = await (await sessionRoute(json(cookie, "/api/session", { sample: false }))).json();
    expect(me.activeCase).toBe("own");
    expect((await requireUserState(json(cookie, "/api/me", undefined, "GET"))).userId).toBe(id);
  });
});

describe("letters are free", () => {
  const read = (cookie: string) => readRoute(json(cookie, "/api/letters/read", { pages: [png], language: "en" }));

  it("counts reads without blocking the account", async () => {
    const { cookie } = await newAccount();
    for (let i = 0; i < 3; i++) expect((await read(cookie)).status).toBe(200);
    const me = await (await meRoute(json(cookie, "/api/me", undefined, "GET"))).json();
    expect(me.lettersUsed).toBe(3);
  });
});
