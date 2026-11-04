import { describe, expect, it } from "vitest";
import { CHECK_IDS, normaliseChecks, photoCheck } from "@/lib/look/photo-check";
import { translatePath } from "@/lib/look/sam-concept";
import { runPhotoCheck, photoRequestSchema } from "@/app/api/photo/run";
import { ModelError, type ChatClient, type ChatRequest } from "@/lib/model/types";
import { freshLocalEnv } from "@/lib/server/local";
import { getBudgets } from "@/lib/server/budget";

const IMG = "data:image/jpeg;base64,/9j/AAAA";
const usage = { tokensIn: 2500, tokensOut: 300, cachedTokens: 0 };
const allPass = JSON.stringify({ checks: CHECK_IDS.map((id) => ({ id, status: "pass", note: "ok" })) });
const fakeClient = (reply: string): { client: ChatClient; calls: ChatRequest[] } => {
  const calls: ChatRequest[] = [];
  return { calls, client: { async chat(r) { calls.push(r); return { content: reply, usage }; } } };
};
const obj = (box: [number, number, number, number], path: string | null = "M0 0Z") => ({ id: "0", box, confidence: 0.9, path });
const samFor = (heads: ReturnType<typeof obj>[], faces: ReturnType<typeof obj>[]) =>
  async (_e: unknown, a: { phrase: string }) => ({ objects: a.phrase === "head" ? heads : faces, ms: 10 });
const req = { image: IMG, width: 960, height: 1280 };

describe("photoCheck", () => {
  it("returns the nine checks in order, vision role, low effort, generous token cap, and meters spend", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const { client, calls } = fakeClient(allPass);
    const out = await photoCheck({ env, userId: "u", client }, { image: IMG });
    expect(out.checks.map((c) => c.id)).toEqual([...CHECK_IDS]);
    expect(out.checks[0].label).toMatch(/background/i);
    expect(calls[0]).toMatchObject({ role: "vision", reasoningEffort: "low" });
    expect(calls[0].maxTokens).toBeGreaterThanOrEqual(4000);
    expect((await getBudgets(env)).model_usd.spent).toBeGreaterThan(0);
  });

  it("marks anything the model skipped as unsure, never pass", () => {
    const out = normaliseChecks([{ id: "eyes", status: "pass", note: "Both eyes are open." }]);
    expect(out).toHaveLength(9);
    expect(out.find((c) => c.id === "eyes")?.status).toBe("pass");
    expect(out.find((c) => c.id === "glasses")?.status).toBe("unsure");
  });

  it("fails clearly when the model keeps returning invalid output", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const { client } = fakeClient("not json");
    await expect(photoCheck({ env, userId: "u", client }, { image: IMG })).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("is refused when models are switched off", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k", MODELS_DISABLED: "1" });
    await expect(photoCheck({ env, userId: "u", client: fakeClient(allPass).client }, { image: IMG })).rejects.toMatchObject({ code: "models_disabled" });
  });
});

describe("runPhotoCheck", () => {
  it("merges head (crown) and face (chin), plans the crop and meters SAM", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const out = await runPhotoCheck(
      { env, userId: "u", client: fakeClient(allPass).client, sam: samFor([obj([256, 112, 715, 631], "M1 1Z")], [obj([319, 268, 656, 741], "M2 2Z")]) as never },
      req,
    );
    expect(out.head).toEqual([256, 112, 715, 741]);
    expect(out.headPath).toBe("M1 1Z");
    expect(out.facePath).toBe("M2 2Z");
    expect(out.crop?.fits).toBe(true);
    expect(out.crop?.headRatio).toBeCloseTo(0.75, 1);
    expect(out.spec).toMatchObject({ width: 684, height: 883, maxBytes: 2621440, ratio: "35:45", maxAgeMonths: 6 });
    expect(out.checks).toHaveLength(9);
    expect(out.timings.samMs).toBe(10);
  });

  it("returns head null with an explanatory check when no head is found", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const out = await runPhotoCheck({ env, userId: "u", client: fakeClient(allPass).client, sam: samFor([], []) as never }, req);
    expect(out.head).toBeNull();
    expect(out.crop).toBeNull();
    expect(out.checks[0]).toMatchObject({ id: "face_found", status: "fail" });
  });

  it("downgrades single_person to unsure when SAM finds two sizeable heads but Spark saw one person", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const out = await runPhotoCheck(
      { env, userId: "u", client: fakeClient(allPass).client, sam: samFor([obj([100, 100, 500, 700]), obj([600, 120, 950, 700])], [obj([150, 200, 450, 700])]) as never },
      req,
    );
    expect(out.checks.find((c) => c.id === "single_person")?.status).toBe("unsure");
  });

  it("keeps a Spark fail on single_person", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const reply = JSON.stringify({ checks: CHECK_IDS.map((id) => ({ id, status: id === "single_person" ? "fail" : "pass", note: "x" })) });
    const out = await runPhotoCheck(
      { env, userId: "u", client: fakeClient(reply).client, sam: samFor([obj([100, 100, 500, 700]), obj([600, 120, 950, 700])], [obj([150, 200, 450, 700])]) as never },
      req,
    );
    expect(out.checks.find((c) => c.id === "single_person")?.status).toBe("fail");
  });

  it("still returns the crop, with every check unsure, when Spark fails", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const client: ChatClient = { async chat() { throw new ModelError("busy", "model_error"); } };
    const out = await runPhotoCheck({ env, userId: "u", client, sam: samFor([obj([256, 112, 715, 631])], [obj([319, 268, 656, 741])]) as never }, req);
    expect(out.crop).not.toBeNull();
    expect(out.checks.every((c) => c.status === "unsure")).toBe(true);
  });

  it("throws when both SAM calls fail", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const sam = async () => { throw new ModelError("down", "model_error"); };
    await expect(runPhotoCheck({ env, userId: "u", client: fakeClient(allPass).client, sam: sam as never }, req)).rejects.toMatchObject({ code: "model_error" });
  });

  it("surfaces the daily cap instead of hiding it", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k", MODELS_DISABLED: "1" });
    await expect(runPhotoCheck({ env, userId: "u", client: fakeClient(allPass).client, sam: samFor([], []) as never }, req)).rejects.toMatchObject({ code: "models_disabled" });
  });
});

describe("request schema and path helper", () => {
  it("accepts only jpeg/png/webp data URLs with sane dimensions", () => {
    expect(photoRequestSchema.safeParse(req).success).toBe(true);
    expect(photoRequestSchema.safeParse({ ...req, image: "data:image/gif;base64,AAAA" }).success).toBe(false);
    expect(photoRequestSchema.safeParse({ ...req, image: "https://x/y.jpg" }).success).toBe(false);
    expect(photoRequestSchema.safeParse({ ...req, width: 10 }).success).toBe(false);
    expect(photoRequestSchema.safeParse({ ...req, image: `data:image/png;base64,${"A".repeat(8_000_001)}` }).success).toBe(false);
  });

  it("translates M/L path coordinates by the mask offset", () => {
    expect(translatePath("M0.5 1L2 3.5Z", 10, 20)).toBe("M10.5 21L12 23.5Z");
    expect(translatePath("M1 1Z", 0, 0)).toBe("M1 1Z");
  });
});
