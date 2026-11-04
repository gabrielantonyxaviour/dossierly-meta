import { describe, expect, it } from "vitest";
import { freshLocalEnv } from "@/lib/server/local";
import { listLedger, recordLedger } from "@/lib/server/ledger";

describe("ledger hash chain", () => {
  it("chains entries and verifies", async () => {
    const env = freshLocalEnv();
    await recordLedger(env, { userId: "u1", kind: "model", what: "interpret via Nemotron Lightning", region: "eu-north1", action: "allowed", bytes: 812, masked: 2 });
    await recordLedger(env, { userId: "u1", kind: "egress", what: "grounded web search", action: "denied", detail: { reason: "cap" } });
    await recordLedger(env, { userId: "u1", kind: "job", what: "nightly watch" });
    const { entries, root, verified } = await listLedger(env, "u1", 10);
    expect(entries).toHaveLength(3);
    expect(entries[0].what).toBe("nightly watch");
    expect(entries[0].prevHash).toBe(entries[1].hash);
    expect(root).toBe(entries[0].hash);
    expect(verified).toBe(true);
  });

  it("isolates users", async () => {
    const env = freshLocalEnv();
    await recordLedger(env, { userId: "a", kind: "model", what: "x" });
    await recordLedger(env, { userId: "b", kind: "model", what: "y" });
    expect((await listLedger(env, "a", 10)).entries.map((e) => e.what)).toEqual(["x"]);
  });

  it("detects tampering and refuses UPDATE/DELETE", async () => {
    const env = freshLocalEnv();
    await recordLedger(env, { userId: "u", kind: "model", what: "one" });
    await recordLedger(env, { userId: "u", kind: "model", what: "two" });
    await expect(env.DB.prepare("UPDATE ledger SET what = 'forged'").run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM ledger").run()).rejects.toThrow(/append-only/);
  });

  it("stays consistent under concurrent writes", async () => {
    const env = freshLocalEnv();
    await Promise.all(Array.from({ length: 8 }, (_, i) => recordLedger(env, { userId: "c", kind: "model", what: `m${i}` })));
    const { entries, verified } = await listLedger(env, "c", 50);
    expect(entries).toHaveLength(8);
    expect(verified).toBe(true);
    expect(new Set(entries.map((e) => e.seq)).size).toBe(8);
  });
});
