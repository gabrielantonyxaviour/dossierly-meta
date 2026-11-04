import { describe, expect, it } from "vitest";
import { z } from "zod";
import { callJson, extractJson } from "@/lib/model/json";
import { ModelError, type ChatClient, type ChatRequest } from "@/lib/model/types";

const schema = z.object({ translation: z.string().min(1) });
const req: ChatRequest = { model: "m", messages: [{ role: "user", content: "hi" }], maxTokens: 100 };

function scripted(replies: string[]) {
  const seen: ChatRequest[] = [];
  const client: ChatClient = {
    async chat(r) {
      seen.push(r);
      return { content: replies[Math.min(seen.length - 1, replies.length - 1)], usage: { tokensIn: 10, tokensOut: 5, cachedTokens: 4 } };
    },
  };
  return { client, seen };
}

describe("extractJson", () => {
  it("reads fenced JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("drops reasoning blocks, including an unterminated one", () => {
    expect(extractJson('<think>maybe {"x":2}</think>{"a":1}')).toEqual({ a: 1 });
    expect(() => extractJson('<think>still thinking {"a":1}')).toThrow();
  });
  it("takes the outermost object from chatter", () => {
    expect(extractJson('Sure! {"a":{"b":2}} Hope that helps')).toEqual({ a: { b: 2 } });
  });
  it("throws when there is no object", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("callJson", () => {
  it("returns validated output and usage on the first try", async () => {
    const { client } = scripted(['{"translation":"Dzień dobry"}']);
    const r = await callJson(client, req, schema);
    expect(r.data).toEqual({ translation: "Dzień dobry" });
    expect(r.attempts).toBe(1);
    expect(r.usage).toEqual({ tokensIn: 10, tokensOut: 5, cachedTokens: 4 });
  });
  it("retries once with the validation error, and sums usage across both attempts", async () => {
    const { client, seen } = scripted(['{"translation":""}', '{"translation":"Tak"}']);
    const r = await callJson(client, req, schema);
    expect(r.data.translation).toBe("Tak");
    expect(r.attempts).toBe(2);
    expect(r.usage.tokensIn).toBe(20);
    const retry = seen[1].messages;
    expect(retry.at(-1)?.content).toMatch(/translation/);
  });
  it("fails clearly after two invalid replies", async () => {
    const { client, seen } = scripted(["nope", "still nope"]);
    await expect(callJson(client, req, schema)).rejects.toMatchObject({ code: "invalid_output" });
    expect(seen).toHaveLength(2);
    await expect(callJson(client, req, schema)).rejects.toBeInstanceOf(ModelError);
  });
});
