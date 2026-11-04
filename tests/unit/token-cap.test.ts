import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { costUsd, estimateInputTokens } from "@/lib/model/cost";
import { meterFixed } from "@/lib/model/meter";
import { ModelError, type ChatClient, type ChatRequest } from "@/lib/model/types";
import { GLOBAL_CAPS, checkAndSpend, getBudgets, settleSpend } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";
import { enqueueAgentTask, getTask, taskView } from "@/lib/agent/queue";
import { advanceTask } from "@/lib/agent/service";
import { friendlyError } from "@/lib/client/api";

const OVER = "Daily limit reached. Try again after 08:00 MYT.";
const schema = z.object({ translation: z.string() });
const call = (maxTokens = 300) => ({
  task: "interpret" as const, system: "RULES", input: "Hello", schema, maxTokens,
  masker: maskerFor({ name: "Arjun Raman" }), replay: () => ({ translation: "REPLAY" }),
});
function fake(replies: string[], usage = { tokensIn: 1000, tokensOut: 100, cachedTokens: 600 }) {
  const calls: ChatRequest[] = [];
  const client: ChatClient = { async chat(r) { calls.push(r); return { content: replies[Math.min(calls.length, replies.length) - 1], usage }; } };
  return { client, calls };
}
const spent = async (env: ReturnType<typeof freshLocalEnv>) => (await getBudgets(env)).model_usd.spent;

describe("daily model cap", () => {
  it("is $5", () => expect(GLOBAL_CAPS.model_usd).toBe(5));

  it("refuses a call whose estimate exceeds what is left, without calling the client", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    expect(await checkAndSpend(env, "model_usd", GLOBAL_CAPS.model_usd - 0.001)).toBe(true);
    const { client, calls } = fake(['{"translation":"x"}']);
    // 10,000 output tokens at $4.25/M alone is $0.0425, more than the $0.001 left.
    await expect(runModel({ env, userId: "u", client }, call(10_000))).rejects.toMatchObject({ code: "over_budget", status: 429, message: OVER });
    expect(calls).toHaveLength(0);
    expect(await spent(env)).toBeCloseTo(GLOBAL_CAPS.model_usd - 0.001, 6);
  });

  it("settles a reservation to the actual cost, and releases it on a failure with no usage", async () => {
    const env = freshLocalEnv();
    expect(await checkAndSpend(env, "model_usd", 0.01)).toBe(true);
    await settleSpend(env, "model_usd", 0.01, 0.002);
    expect(await spent(env)).toBeCloseTo(0.002, 6);
    await settleSpend(env, "model_usd", 0.5, 0);
    expect(await spent(env)).toBe(0);

    const env2 = freshLocalEnv({ MODEL_API_KEY: "k" });
    const failing: ChatClient = { async chat() { throw new ModelError("busy", "rate_limited", 429); } };
    await expect(runModel({ env: env2, userId: null, client: failing }, call())).rejects.toMatchObject({ code: "rate_limited" });
    expect(await spent(env2)).toBe(0);
  });

  it("counts actual tokens at list prices, summed over the corrective retry", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const usage = { tokensIn: 1000, tokensOut: 100, cachedTokens: 600 };
    const { client, calls } = fake(["not json", '{"translation":"ok"}'], usage);
    await runModel({ env, userId: null, client }, call());
    expect(calls).toHaveLength(2);
    expect(await spent(env)).toBeCloseTo(2 * costUsd("muse-spark-1.2", usage), 6);
  });

  it("meters the retry separately: a second attempt that would pass the cap is refused", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const { client, calls } = fake(["not json", '{"translation":"ok"}'], { tokensIn: 100, tokensOut: 9900, cachedTokens: 0 });
    // The first attempt really costs ~$0.042, leaving no room for a second reservation of the same size.
    expect(await checkAndSpend(env, "model_usd", GLOBAL_CAPS.model_usd - 0.06)).toBe(true);
    await expect(runModel({ env, userId: null, client }, call(10_000))).rejects.toMatchObject({ code: "over_budget" });
    expect(calls).toHaveLength(1);
  });

  it("never serves a recording in production: over the cap or with no key it throws", async () => {
    vi.stubEnv("DEMO_FIXTURES", "1");
    try {
      const prod = freshLocalEnv({ MODEL_API_KEY: "k", APP_ENV: "production" });
      await checkAndSpend(prod, "model_usd", GLOBAL_CAPS.model_usd);
      const { client } = fake(['{"translation":"x"}']);
      await expect(runModel({ env: prod, userId: null, client }, call())).rejects.toMatchObject({ code: "over_budget" });
      const noKey = freshLocalEnv({ MODEL_API_KEY: "", APP_ENV: "production" });
      await expect(runModel({ env: noKey, userId: null }, call())).rejects.toMatchObject({ code: "no_key" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("shows the exact limit message in the UI for over_budget", () => {
    expect(friendlyError({ ok: false, status: 429, error: OVER, code: "over_budget" })).toBe(OVER);
  });

  it("estimates images by a flat per-page cost, not by their base64 length", () => {
    const big = "data:image/png;base64," + "A".repeat(2_000_000);
    expect(estimateInputTokens([{ role: "user", content: [{ type: "image_url", image_url: { url: big } }] }])).toBeLessThan(4000);
  });
});

describe("kill switch MODELS_DISABLED=1", () => {
  const off = (o = {}) => freshLocalEnv({ MODEL_API_KEY: "k", MODELS_DISABLED: "1", ...o });

  it("stops runModel, including a test double and the fixture path", async () => {
    const { client, calls } = fake(['{"translation":"x"}']);
    await expect(runModel({ env: off(), userId: null, client }, call())).rejects.toMatchObject({ code: "models_disabled", status: 503, message: "Model calls are switched off" });
    expect(calls).toHaveLength(0);
  });

  it("stops the metered fixed-cost calls (speech, SAM, search)", async () => {
    await expect(meterFixed(off(), 0.01, async () => ({ value: 1, actualUsd: 0 }))).rejects.toMatchObject({ code: "models_disabled" });
  });

  it("fails an agent cloud-fallback task with the message, calling nothing", async () => {
    const { calls, client, row, env } = await cloudTask(off());
    await advanceTaskWith(env, row, client);
    const view = taskView((await getTask(env, row.id))!);
    expect(view.status).toBe("failed");
    expect((view as { error: string }).error).toBe("Model calls are switched off");
    expect(calls).toHaveLength(0);
  });
});

describe("meterFixed", () => {
  it("reserves, settles to the reported cost, and releases on failure", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    await meterFixed(env, 0.5, async () => ({ value: "ok", actualUsd: 0.01 }));
    expect(await spent(env)).toBeCloseTo(0.01, 6);
    await expect(meterFixed(env, 0.5, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await spent(env)).toBeCloseTo(0.01, 6);
  });

  it("is refused over the cap without running", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    await checkAndSpend(env, "model_usd", GLOBAL_CAPS.model_usd);
    const fn = vi.fn(async () => ({ value: 1, actualUsd: 0 }));
    await expect(meterFixed(env, 0.01, fn)).rejects.toMatchObject({ code: "over_budget" });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("agent cloud fallback", () => {
  it("over the cap the task fails with the limit message and never calls the model", async () => {
    const env0 = freshLocalEnv({ MODEL_API_KEY: "k" });
    await checkAndSpend(env0, "model_usd", GLOBAL_CAPS.model_usd);
    const { calls, client, row, env } = await cloudTask(env0);
    await advanceTaskWith(env, row, client);
    const view = taskView((await getTask(env, row.id))!);
    expect(view).toMatchObject({ status: "failed", error: OVER });
    expect(calls).toHaveLength(0);
  });

  it("bills the call at actual usage", async () => {
    const { calls, client, row, env } = await cloudTask(freshLocalEnv({ MODEL_API_KEY: "k" }), true);
    await advanceTaskWith(env, row, client);
    expect(calls).toHaveLength(1);
    expect(await spent(env)).toBeCloseTo(costUsd("muse-spark-1.3", { tokensIn: 900, tokensOut: 300, cachedTokens: 0 }), 6);
  });
});

async function cloudTask(env: ReturnType<typeof freshLocalEnv>, valid = false) {
  const kase = {
    id: "c", office: "Mazowiecki Voivodeship Office, Warsaw", profile: { name: "Arjun Raman", language: "en" as const },
    events: [], documents: [], deadlines: [],
  };
  const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "ask", input: { question: "When is my appointment?", case: kase, language: "en" } }, { start: false });
  const calls: ChatRequest[] = [];
  const answer = JSON.stringify({ answer: "Your appointment is listed in your case.", citations: [] });
  const client: ChatClient = { async chat(r) { calls.push(r); return { content: valid ? answer : "{}", usage: { tokensIn: 900, tokensOut: 300, cachedTokens: 0 } }; } };
  return { calls, client, env, row: (await getTask(env, taskId))! };
}

async function advanceTaskWith(env: ReturnType<typeof freshLocalEnv>, row: { id: string; created_at: number }, client: ChatClient) {
  const jobs: Array<() => Promise<unknown>> = [];
  await advanceTask(env, row as never, row.created_at + 30_000, { schedule: (w) => void jobs.push(w), client });
  await jobs[0]();
}

