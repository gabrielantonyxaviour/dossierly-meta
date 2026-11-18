import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { assertProviderAllowed, providerAllowed } from "@/lib/model/gate";
import { metaChat, metaChatStream, samSegment, webSearch } from "@/lib/model/meta";
import { resolveRole } from "@/lib/model/roles";
import { outlineItems } from "@/lib/look/outline";
import { ModelError, type ChatClient } from "@/lib/model/types";
import { freshLocalEnv } from "@/lib/server/local";

const KEYS = { MODEL_API_KEY: "meta-key", ANTHROPIC_API_KEY: "anthropic-key" };
const msgs = [{ role: "user" as const, content: "hello" }];
const SAVED = process.env.META_USER_CONTENT;

beforeEach(() => {
  delete process.env.META_USER_CONTENT;
});
afterEach(() => {
  if (SAVED === undefined) delete process.env.META_USER_CONTENT;
  else process.env.META_USER_CONTENT = SAVED;
});

function spyFetch() {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    return Response.json({ choices: [{ message: { content: "{}" } }], content: [{ type: "text", text: "{}" }], usage: { prompt_tokens: 1, completion_tokens: 1, input_tokens: 1, output_tokens: 1 } });
  };
  return { calls, fetch };
}
const blocked = (fn: () => unknown) => expect(fn).toThrowError(expect.objectContaining({ code: "provider_blocked", status: 403 }));

describe("content-origin gate", () => {
  it("blocks user content to Meta, before any network request", async () => {
    const f = spyFetch();
    const env = { ...KEYS, MODEL_INTERPRET_USER_PROVIDER: "meta" };
    await expect(metaChat({ model: "muse-spark-1.2", role: "interpret", origin: "user", messages: msgs, maxTokens: 100 }, { env, fetch: f.fetch })).rejects.toMatchObject({ code: "provider_blocked" });
    await expect(metaChatStream({ model: "muse-spark-1.2", role: "interpret", origin: "user", messages: msgs, maxTokens: 100 }, { env, fetch: f.fetch }).next()).rejects.toMatchObject({ code: "provider_blocked" });
    expect(f.calls).toEqual([]);
  });

  it("allows demo and eval content to Meta", async () => {
    for (const origin of ["demo", "eval"] as const) {
      const f = spyFetch();
      const out = await metaChat({ model: "muse-spark-1.2", role: "interpret", origin, messages: msgs, maxTokens: 100 }, { env: KEYS, fetch: f.fetch });
      expect(out.content).toBe("{}");
      expect(f.calls).toEqual(["https://api.meta.ai/v1/chat/completions"]);
    }
  });

  it("allows user content to Claude", async () => {
    const f = spyFetch();
    const out = await metaChat({ model: "claude-haiku-5-5", role: "interpret", origin: "user", messages: msgs, maxTokens: 100 }, { env: KEYS, fetch: f.fetch });
    expect(out.content).toBe("{}");
    expect(f.calls).toEqual(["https://api.anthropic.com/v1/messages"]);
  });

  it("treats a missing or unknown origin as user (fail closed) for Meta", async () => {
    const f = spyFetch();
    const env = { ...KEYS, MODEL_INTERPRET_USER_PROVIDER: "meta" };
    await expect(metaChat({ model: "muse-spark-1.2", role: "interpret", messages: msgs, maxTokens: 100 }, { env, fetch: f.fetch })).rejects.toMatchObject({ code: "provider_blocked" });
    await expect(metaChat({ model: "muse-spark-1.2", role: "interpret", origin: "admin" as never, messages: msgs, maxTokens: 100 }, { env, fetch: f.fetch })).rejects.toMatchObject({ code: "provider_blocked" });
    expect(f.calls).toEqual([]);
    expect(providerAllowed("meta", undefined, {})).toBe(false);
    expect(providerAllowed("meta", "demo", {})).toBe(true);
    expect(providerAllowed("anthropic", undefined, {})).toBe(true);
  });

  it("is lifted by META_USER_CONTENT=allow (env object or process env), and only by exactly that", async () => {
    const env = { ...KEYS, MODEL_INTERPRET_USER_PROVIDER: "meta", META_USER_CONTENT: "allow" };
    const f = spyFetch();
    await metaChat({ model: "muse-spark-1.2", role: "interpret", origin: "user", messages: msgs, maxTokens: 100 }, { env, fetch: f.fetch });
    expect(f.calls).toEqual(["https://api.meta.ai/v1/chat/completions"]);
    process.env.META_USER_CONTENT = "allow";
    expect(providerAllowed("meta", "user", {})).toBe(true);
    for (const v of ["1", "true", "yes", "ALLOW "]) {
      process.env.META_USER_CONTENT = v;
      expect(providerAllowed("meta", "user", {}), v).toBe(v.trim() === "allow");
    }
    expect(() => assertProviderAllowed("meta", "user", { META_USER_CONTENT: "no" })).toThrow(ModelError);
  });

  it("blocks the Meta-only services (SAM, grounded search) for user content, with no request", async () => {
    const f = spyFetch();
    const o = { env: KEYS, fetch: f.fetch };
    await expect(samSegment({ image: "data:image/png;base64,AA", boxes: [[0, 0, 1, 1]], size: { w: 10, h: 10 } }, o)).rejects.toMatchObject({ code: "provider_blocked" });
    await expect(webSearch({ query: "pesel" }, o)).rejects.toMatchObject({ code: "provider_blocked" });
    expect(f.calls).toEqual([]);
    blocked(() => resolveRole("sam", KEYS));
    expect(resolveRole("sam", KEYS, "demo").provider).toBe("meta");
    await samSegment({ image: "data:image/png;base64,AA", boxes: [[0, 0, 1, 1]], size: { w: 10, h: 10 } }, { ...o, origin: "demo" }).catch(() => undefined);
    expect(f.calls[0]).toBe("https://api.meta.ai/v1/responses");
  });

  it("runModel passes the origin through: a user call goes to Claude, a demo call to Meta, the sample user counts as demo", async () => {
    const seen: Array<{ model: string; origin?: string }> = [];
    const client: ChatClient = { async chat(r) { seen.push({ model: r.model, origin: r.origin }); return { content: '{"a":"x"}', usage: { tokensIn: 10, tokensOut: 5, cachedTokens: 0 } }; } };
    const call = { task: "interpret" as const, system: "S", input: "i", schema: z.object({ a: z.string() }), maxTokens: 300, masker: maskerFor({}), replay: () => ({ a: "r" }) };
    const env = freshLocalEnv(KEYS);
    await runModel({ env, userId: "u1", client }, call);
    await runModel({ env, userId: "u1", client, origin: "demo" }, call);
    await runModel({ env, userId: "sample-arjun", client }, call);
    expect(seen).toEqual([
      { model: "claude-haiku-5-5", origin: "user" },
      { model: "muse-spark-1.2", origin: "demo" },
      { model: "muse-spark-1.2", origin: "demo" },
    ]);
  });

  it("runModel refuses a Meta route for user content before calling the client", async () => {
    let called = 0;
    const client: ChatClient = { async chat() { called++; return { content: "{}", usage: { tokensIn: 1, tokensOut: 1, cachedTokens: 0 } }; } };
    const env = freshLocalEnv({ ...KEYS, MODEL_INTERPRET_USER_MODEL: "muse-spark-1.2" } as never);
    const call = { task: "interpret" as const, system: "S", input: "i", schema: z.object({}), maxTokens: 300, masker: maskerFor({}), replay: () => ({}) };
    await expect(runModel({ env, userId: "u1", client }, call)).rejects.toMatchObject({ code: "provider_blocked" });
    expect(called).toBe(0);
  });

  it("Look outlines skip SAM for user images and keep the model boxes, with no request", async () => {
    const f = spyFetch();
    const env = freshLocalEnv(KEYS);
    const out = await outlineItems(env, "u1", "data:image/png;base64,AA", { w: 100, h: 100 }, [{ id: "i1", box: [10, 10, 50, 30] }], { fetch: f.fetch });
    expect(out.source).toBe("fallback");
    expect(out.outlines).toHaveLength(1);
    expect(f.calls).toEqual([]);
  });
});
