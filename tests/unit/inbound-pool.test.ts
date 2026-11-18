import { describe, expect, it } from "vitest";
import { freshLocalEnv } from "../../src/lib/server/local";
import { accountForRecipient, getOrCreateAddress, rotateAddress, type InboundEnv } from "../../src/lib/inbound/address";

type E = InboundEnv;
async function poolEnv(locals: string[]) {
  const env = freshLocalEnv({ INBOUND_MAIL_DOMAIN: "in.example.test", INBOUND_POOL: "on" } as never) as E;
  for (const l of locals) await env.DB.prepare("INSERT INTO inbound_pool (local_part) VALUES (?)").bind(l).run();
  return env;
}

describe("forwarding addresses from the pre-routed pool", () => {
  it("hands each account its own pooled address and maps it back", async () => {
    const env = await poolEnv(["case-aaaaaaaaaa", "case-bbbbbbbbbb", "case-cccccccccc"]);
    const a = await getOrCreateAddress(env, "acct-p1");
    const b = await getOrCreateAddress(env, "acct-p2");
    expect(a.address).toBe("case-aaaaaaaaaa@in.example.test");
    expect(b.address).toBe("case-bbbbbbbbbb@in.example.test");
    expect((await getOrCreateAddress(env, "acct-p1")).address).toBe(a.address);
    expect(await accountForRecipient(env, a.address)).toBe("acct-p1");
  });
  it("rotation takes the next pooled address and the old one stops mapping", async () => {
    const env = await poolEnv(["case-dddddddddd", "case-eeeeeeeeee"]);
    const first = await getOrCreateAddress(env, "acct-p3");
    const next = await rotateAddress(env, "acct-p3");
    expect(next.address).toBe("case-eeeeeeeeee@in.example.test");
    expect(await accountForRecipient(env, first.address)).toBeNull();
  });
  it("an empty pool is a clear 503, never a random unrouted address", async () => {
    const env = await poolEnv([]);
    await expect(getOrCreateAddress(env, "acct-p4")).rejects.toMatchObject({ code: "address_pool_empty" });
  });
});
