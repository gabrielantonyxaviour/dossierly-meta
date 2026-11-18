import { describe, expect, it } from "vitest";
import { anthropicPost, fallbackKey, isBillingError } from "@/lib/model/anthropic";
import type { RoleConfig } from "@/lib/model/roles";

const cfg = { name: "agent", provider: "anthropic", origin: "user", baseUrl: "https://api.anthropic.test", model: "claude-sonnet-5-5", apiKey: "primary", effort: "low" } as unknown as RoleConfig;
const low = () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }), { status: 400 });
const ok = () => new Response(JSON.stringify({ content: [{ type: "text", text: "hi" }] }), { status: 200 });

function recorder(answers: Array<() => Response>) {
  const keys: string[] = [];
  const fetchImpl = async (_u: string, init: RequestInit) => { keys.push((init.headers as Record<string, string>)["x-api-key"]!); return answers.shift()!(); };
  return { keys, fetchImpl };
}

describe("Anthropic key fallback on a billing error", () => {
  it("recognises credit and billing errors only", () => {
    expect(isBillingError(400, "Your credit balance is too low")).toBe(true);
    expect(isBillingError(402, "")).toBe(true);
    expect(isBillingError(400, "max_tokens: field required")).toBe(false);
    expect(isBillingError(429, "credit balance")).toBe(false);
  });
  it("retries once with the fallback key when the primary is out of credit", async () => {
    const r = recorder([low, ok]);
    const res = await anthropicPost(cfg, {}, { env: { ANTHROPIC_API_KEY_FALLBACK: "spare" }, fetch: r.fetchImpl } as never);
    expect(res.status).toBe(200);
    expect(r.keys).toEqual(["primary", "spare"]);
  });
  it("does not use the fallback for other errors, or when none is set", async () => {
    const bad = recorder([() => new Response("{}", { status: 400 })]);
    await expect(anthropicPost(cfg, {}, { env: { ANTHROPIC_API_KEY_FALLBACK: "spare" }, fetch: bad.fetchImpl } as never)).rejects.toMatchObject({ code: "bad_request" });
    expect(bad.keys).toEqual(["primary"]);
    const none = recorder([low]);
    await expect(anthropicPost(cfg, {}, { env: {}, fetch: none.fetchImpl } as never)).rejects.toBeTruthy();
    expect(none.keys).toEqual(["primary"]);
    expect(fallbackKey({ ANTHROPIC_FALLBACK_KEY_ENV: "OTHER", OTHER: " k2 " })).toBe("k2");
  });
});
