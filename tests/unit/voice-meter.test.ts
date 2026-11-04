import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Usage } from "@/lib/model/types";

const provider = vi.hoisted(() => ({ streamCalls: 0, chatCalls: 0, usage: null as Usage | null }));
vi.mock("@/lib/model/meta", () => ({
  metaChatStream: () =>
    (async function* () {
      provider.streamCalls++;
      yield { type: "delta", text: "SAY: The official asks for your passport." };
      if (provider.usage) yield { type: "usage", usage: provider.usage };
    })(),
  metaChat: async () => {
    provider.chatCalls++;
    return { content: '{"docs":["paszport"]}', usage: { tokensIn: 400, tokensOut: 100, cachedTokens: 0 } };
  },
}));

import { asrCostUsd, costUsd } from "@/lib/model/cost";
import { checkAndSpend, getBudgets } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";
import { jsonCall, streamLines } from "@/lib/voice/server/llm";
import { bookAsrAudio, primeVoiceBudget, resetVoiceMeter } from "@/lib/voice/server/meter";

const TURN: Usage = { tokensIn: 1000, tokensOut: 500, cachedTokens: 0 };
const MODEL = "muse-spark-1.2"; // the interpret role's default
const args = { role: "interpret" as const, system: "s", messages: [], speak: ["SAY"] };
const side = { role: "interpret" as const, system: "s", user: "u" };
const spent = async (env: object) => (await getBudgets(env as never)).model_usd.spent;
const env = (extra: Record<string, string> = {}) => ({ ...freshLocalEnv({ MODEL_API_KEY: "k" }), ...extra });

beforeEach(() => {
  resetVoiceMeter();
  provider.streamCalls = 0;
  provider.chatCalls = 0;
  provider.usage = TURN;
});

describe("live voice spend", () => {
  it("books a streamed turn's billed usage against the daily model cap", async () => {
    const e = env();
    await streamLines(e, args, {});
    await vi.waitFor(async () => expect(await spent(e)).toBeCloseTo(costUsd(MODEL, TURN), 6));
  });

  it("never makes a turn wait for the booking: a stalled budget write does not delay it", async () => {
    const stalled = new Promise<never>(() => undefined);
    const stmt = { bind: () => stmt, run: () => stalled, first: () => stalled, all: () => stalled };
    const r = await streamLines({ MODEL_API_KEY: "k", DB: { prepare: () => stmt } }, args, {});
    expect(r.fields.SAY).toBe("The official asks for your passport.");
  });

  it("books an estimate for a stream cut short (barge-in, a corrected partial)", async () => {
    const e = env();
    const ctl = new AbortController();
    ctl.abort();
    await streamLines(e, { ...args, signal: ctl.signal }, {});
    await vi.waitFor(async () => expect(await spent(e)).toBeGreaterThan(0));
  });

  it("books a side lane's JSON call", async () => {
    const e = env();
    expect(await jsonCall(e, side)).toEqual({ docs: ["paszport"] });
    await vi.waitFor(async () => expect(await spent(e)).toBeCloseTo(costUsd(MODEL, { tokensIn: 400, tokensOut: 100, cachedTokens: 0 }), 6));
  });

  it("MODELS_DISABLED=1 stops spoken and side lanes before they reach the provider", async () => {
    const e = env({ MODELS_DISABLED: "1" });
    await expect(streamLines(e, args, {})).rejects.toMatchObject({ code: "models_disabled" });
    expect(await jsonCall(e, side)).toBeNull();
    expect(provider.streamCalls + provider.chatCalls).toBe(0);
  });

  it("records the call that passes the cap, then refuses the next ones", async () => {
    const e = env({ MODEL_DAILY_USD_CAP: "0.005" }); // one turn costs $0.003375
    await streamLines(e, args, {});
    await vi.waitFor(async () => expect(await spent(e)).toBeCloseTo(costUsd(MODEL, TURN), 6));
    await streamLines(e, args, {});
    await vi.waitFor(async () => expect(await spent(e)).toBeCloseTo(2 * costUsd(MODEL, TURN), 6));
    await expect(streamLines(e, args, {})).rejects.toMatchObject({ code: "over_budget", status: 429 });
    expect(await jsonCall(e, side)).toBeNull();
    expect(provider.streamCalls).toBe(2);
    expect(provider.chatCalls).toBe(0);
  });

  it("a session start primes the gate when today's cap is already spent", async () => {
    const e = env();
    expect(await checkAndSpend(e as never, "model_usd", 5)).toBe(true);
    await primeVoiceBudget(e);
    await expect(streamLines(e, args, {})).rejects.toMatchObject({ code: "over_budget" });
    expect(provider.streamCalls).toBe(0);
  });

  it("books the audio streamed to the speech service", async () => {
    const e = env();
    await bookAsrAudio(e, 10 * 60_000);
    expect(await spent(e)).toBeCloseTo(asrCostUsd(600), 6);
  });

  it("without a database binding the lanes still run (unit and local use)", async () => {
    const r = await streamLines({ MODEL_API_KEY: "k" }, args, {});
    expect(r.fields.SAY).toBe("The official asks for your passport.");
  });
});
