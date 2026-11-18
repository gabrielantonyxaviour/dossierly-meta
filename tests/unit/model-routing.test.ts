import { beforeEach, describe, expect, it } from "vitest";
import { describeRole, resolveRole } from "@/lib/model/roles";
import { costUsd } from "@/lib/model/cost";

const KEYS = { MODEL_API_KEY: "meta-key", ANTHROPIC_API_KEY: "anthropic-key" };
beforeEach(() => {
  delete process.env.META_USER_CONTENT;
});

describe("routing by role and origin", () => {
  it("sends real users to Claude and demo/eval to Meta by default", () => {
    expect(resolveRole("interpret", KEYS)).toMatchObject({ provider: "anthropic", model: "claude-haiku-5-5", apiKey: "anthropic-key", baseUrl: "https://api.anthropic.com" });
    expect(resolveRole("guard", KEYS).model).toBe("claude-haiku-5-5");
    for (const r of ["vision", "agent", "draft", "reason"] as const) expect(resolveRole(r, KEYS)).toMatchObject({ provider: "anthropic", model: "claude-sonnet-5-5" });
    expect(resolveRole("interpret", KEYS, "demo")).toMatchObject({ provider: "meta", model: "muse-spark-1.2", apiKey: "meta-key" });
    expect(resolveRole("vision", KEYS, "eval")).toMatchObject({ provider: "meta", model: "muse-spark-1.3" });
  });

  it("uses Haiku for watch and hub-summary tasks (a draft-role task) for users", () => {
    expect(resolveRole("draft", KEYS, "user", "watch").model).toBe("claude-haiku-5-5");
    expect(resolveRole("draft", KEYS, "user", "hub_summary").model).toBe("claude-haiku-5-5");
    expect(resolveRole("draft", KEYS, "user", "welcome").model).toBe("claude-sonnet-5-5");
    expect(resolveRole("draft", KEYS, "demo", "watch").model).toBe("muse-spark-1.3");
  });

  it("is switchable by config alone: provider, model, key variable, per origin", () => {
    const env = { ...KEYS, META_USER_CONTENT: "allow", MODEL_VISION_USER_PROVIDER: "meta", MODEL_GUARD_PROVIDER: "anthropic", MODEL_GUARD_MODEL: "claude-opus-5-5", MODEL_GUARD_KEY_ENV: "OTHER_KEY", OTHER_KEY: "k2", MODEL_DRAFT_DEMO_MODEL: "claude-haiku-5-5" };
    expect(resolveRole("vision", env)).toMatchObject({ provider: "meta", model: "muse-spark-1.3", apiKey: "meta-key" });
    expect(resolveRole("vision", env, "demo").provider).toBe("meta");
    expect(resolveRole("guard", env)).toMatchObject({ provider: "anthropic", model: "claude-opus-5-5", apiKey: "k2" });
    expect(resolveRole("guard", env, "demo")).toMatchObject({ provider: "anthropic", model: "claude-opus-5-5" });
    expect(resolveRole("draft", env, "demo")).toMatchObject({ provider: "anthropic", model: "claude-haiku-5-5" });
  });

  it("infers the provider from the model id when only a model is set", () => {
    expect(resolveRole("interpret", { ...KEYS, MODEL_INTERPRET_MODEL: "claude-sonnet-5-5" })).toMatchObject({ provider: "anthropic" });
    expect(resolveRole("interpret", { ...KEYS, MODEL_INTERPRET_MODEL: "muse-spark-1.3", META_USER_CONTENT: "allow" })).toMatchObject({ provider: "meta", apiKey: "meta-key" });
  });

  it("describeRole reports a blocked route without throwing or exposing a key", () => {
    const d = describeRole("asr", KEYS);
    expect(d).toMatchObject({ provider: "meta", blocked: true, hasKey: true, apiKey: "" });
    expect(describeRole("asr", { ...KEYS, META_USER_CONTENT: "allow" }).blocked).toBe(false);
    expect(describeRole("interpret", KEYS)).toMatchObject({ blocked: false, hasKey: true });
    expect(describeRole("interpret", {}).hasKey).toBe(false);
  });

  it("prices Claude models at list price (cache reads at the cached rate)", () => {
    const u = { tokensIn: 10_000, tokensOut: 2_000, cachedTokens: 4_000 };
    expect(costUsd("claude-sonnet-5-5", u)).toBeCloseTo((6000 * 2 + 4000 * 0.2 + 2000 * 10) / 1e6, 10);
    expect(costUsd("claude-haiku-5-5", u)).toBeCloseTo((6000 * 0.1 + 4000 * 0.01 + 2000 * 0.5) / 1e6, 10);
    expect(costUsd("claude-opus-5-5", { tokensIn: 1e6, tokensOut: 1e6, cachedTokens: 0 })).toBeCloseTo(24, 6);
  });
});
