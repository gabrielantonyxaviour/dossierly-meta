import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ROLE_DEFAULTS, TASK_ROLE } from "@/lib/config";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { costUsd } from "@/lib/model/cost";
import { ModelError, type ChatClient, type ChatRequest } from "@/lib/model/types";
import { GLOBAL_CAPS, checkAndSpend } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";

const schema = z.object({ translation: z.string() });
function fake(content: string, usage = { tokensIn: 1000, tokensOut: 100, cachedTokens: 600 }) {
  const calls: ChatRequest[] = [];
  const client: ChatClient = {
    async chat(r) {
      calls.push(r);
      return { content, usage };
    },
  };
  return { client, calls };
}
const base = () => ({
  task: "interpret" as const,
  system: "RULES",
  context: "Applicant Arjun Raman, case WSC-II-P.6151.48213.2026",
  input: "Translate: my PESEL is 44051401359",
  schema,
  maxTokens: 300,
  masker: maskerFor({ name: "Arjun Raman", caseNumber: "WSC-II-P.6151.48213.2026" }),
  replay: () => ({ translation: "REPLAY" }),
});

const SPARK_13 = "muse-spark-1.3";
const SPARK_12 = "muse-spark-1.2";

describe("role table and cost", () => {
  it("maps tasks to roles and roles to the Meta Spark models", () => {
    expect(ROLE_DEFAULTS.interpret).toEqual({ model: SPARK_12, effort: "minimal" });
    expect(ROLE_DEFAULTS.guard).toEqual({ model: SPARK_12, effort: "minimal" });
    for (const r of ["reason", "agent", "vision", "draft"] as const) expect(ROLE_DEFAULTS[r].model).toBe(SPARK_13);
    expect(TASK_ROLE.link).toBe("reason");
    expect(TASK_ROLE.read).toBe("vision");
    expect(TASK_ROLE.interpret_ml).toBe("interpret");
  });
  it("costs from Spark list prices with cached tokens at the cached rate", () => {
    const u = { tokensIn: 1000, tokensOut: 100, cachedTokens: 600 };
    const expected = (400 * 1.25 + 600 * 0.15 + 100 * 4.25) / 1e6;
    expect(costUsd(SPARK_13, u)).toBeCloseTo(expected, 10);
    expect(costUsd(SPARK_12, u)).toBeCloseTo(expected, 10);
  });
});

describe("runModel", () => {
  it("masks before the call, orders the prompt for caching, restores the output, and logs", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test-key" });
    const { client, calls } = fake('{"translation":"Pan [NAME_1], sprawa [CASE_1]"}');
    const out = await runModel({ env, userId: "u1", client }, base());
    const sent = JSON.stringify(calls[0].messages);
    expect(sent).not.toMatch(/Arjun|Raman|44051401359|WSC-II/);
    expect(sent).toMatch(/\[NAME_1\]/);
    const user = calls[0].messages[1].content as string;
    expect(user.indexOf("CASE CONTEXT")).toBeLessThan(user.indexOf("INPUT"));
    expect(calls[0].messages[0]).toEqual({ role: "system", content: "RULES" });
    expect(out.data.translation).toBe("Pan Arjun Raman, sprawa WSC-II-P.6151.48213.2026");
    expect(out.masked).toBe(3);
    expect(out.run).toMatchObject({ model: SPARK_12, tokensIn: 1000, tokensOut: 100, cachedTokens: 600, ranOn: "cloud" });
    expect(out.run.costUsd).toBeGreaterThan(0);
    const led = await env.DB.prepare("SELECT kind, what, masked, bytes FROM ledger WHERE user_id = ?").bind("u1").all<{ kind: string; what: string; masked: number; bytes: number }>();
    expect(led.results).toHaveLength(1);
    expect(led.results[0]).toMatchObject({ kind: "model", what: SPARK_12, masked: 3 });
    expect(led.results[0].bytes).toBeGreaterThan(50);
    const runs = await env.DB.prepare("SELECT feature, ran_on FROM runs WHERE user_id = ?").bind("u1").all();
    expect(runs.results).toEqual([{ feature: "interpret", ran_on: "cloud" }]);
  });

  it("refuses with over_budget once the daily cap is spent, never calling the model or serving a recording", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test-key" });
    expect(await checkAndSpend(env, "model_usd", GLOBAL_CAPS.model_usd)).toBe(true);
    const { client, calls } = fake('{"translation":"LIVE"}');
    await expect(runModel({ env, userId: "u1", client }, base())).rejects.toMatchObject({
      code: "over_budget", status: 429, message: "Daily limit reached. Try again after 08:00 MYT.",
    });
    expect(calls).toHaveLength(0);
  });

  it("fails clearly with no key unless fixture mode is on", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "" });
    await expect(runModel({ env, userId: null }, base())).rejects.toMatchObject({ code: "no_key" });
    vi.stubEnv("DEMO_FIXTURES", "1");
    const out = await runModel({ env, userId: null }, base());
    vi.unstubAllEnvs();
    expect(out.run.ranOn).toBe("replay");
    expect(out.data.translation).toBe("REPLAY");
  });

  it("retries once on invalid JSON and bills both attempts", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test-key" });
    let n = 0;
    const client: ChatClient = {
      async chat() {
        n++;
        return { content: n === 1 ? "not json" : '{"translation":"ok"}', usage: { tokensIn: 100, tokensOut: 10, cachedTokens: 0 } };
      },
    };
    const out = await runModel({ env, userId: null, client }, { ...base(), context: undefined });
    expect(out.data.translation).toBe("ok");
    expect(out.run.tokensIn).toBe(200);
  });
});
