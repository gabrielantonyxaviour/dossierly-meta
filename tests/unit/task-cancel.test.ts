import { describe, expect, it } from "vitest";
import { cancelTask, CANCELLED_MESSAGE } from "@/lib/agent/cancel";
import { enqueueAgentTask, getTask, claimForCloud, finishTask } from "@/lib/agent/queue";
import { freshLocalEnv } from "@/lib/server/local";
import { sampleCase } from "@/lib/client/sample";

describe("owned task cancellation", () => {
  it("prevents another account canceling and makes late answers a no-op", async () => {
    const env = freshLocalEnv();
    const { taskId } = await enqueueAgentTask(env, { userId: "u_ananya", kind: "ask", input: { question: "Which source states the date?", case: sampleCase(), language: "en" } }, { start: false });
    await expect(cancelTask(env, taskId, "u_olena")).rejects.toMatchObject({ status: 404 });
    const row = (await getTask(env, taskId))!; await claimForCloud(env, row);
    await cancelTask(env, taskId, "u_ananya");
    expect(await getTask(env, taskId)).toMatchObject({ status: "failed", error: CANCELLED_MESSAGE, input: null, result: null });
    expect(await finishTask(env, taskId, { status: "done", ranOn: "cloud", trace: [], result: { data: { answer: "late" } } })).toBe(false);
  });
  it("cancels queued requests without letting the cloud claim them and remains idempotent", async () => {
    const env = freshLocalEnv();
    const { taskId } = await enqueueAgentTask(env, { userId: "u_ananya", kind: "ask", input: { question: "Explain the source", case: sampleCase(), language: "ja" } }, { start: false });
    await cancelTask(env, taskId, "u_ananya"); await cancelTask(env, taskId, "u_ananya");
    expect(await claimForCloud(env, (await getTask(env, taskId))!)).toBe(false);
  });
});
