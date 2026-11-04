import { describe, expect, it, vi } from "vitest";
import { metaChat, metaChatStream } from "@/lib/model/meta";
import { RELAY_TARGET_HEADER, relayable } from "@/lib/model/relay";

const okJson = () => new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }), { status: 200 });
const sse = () => new Response("data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"}}]}\n\ndata: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });

function relayNs(answer: () => Response) {
  const calls: Array<{ hint?: string; target: string | null; auth: string | null; body: string }> = [];
  const ns = {
    idFromName: (n: string) => n,
    get: (_id: unknown, o?: { locationHint?: string }) => ({
      fetch: async (_u: string, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        calls.push({ hint: o?.locationHint, target: h.get(RELAY_TARGET_HEADER), auth: h.get("authorization"), body: String(init?.body) });
        return answer();
      },
    }),
  };
  return { ns, calls };
}
const req = { model: "muse-spark-1.2", role: "interpret" as const, messages: [{ role: "user" as const, content: "hi" }], maxTokens: 100 };

describe("Meta 404 falls back to the western-Europe relay", () => {
  it("re-sends a 404'd call once through MODEL_RELAY (weur) with the same body and key", async () => {
    const { ns, calls } = relayNs(okJson);
    const edge = vi.fn(async () => new Response("not found", { status: 404 }));
    const out = await metaChat(req, { env: { MODEL_API_KEY: "k", MODEL_RELAY: ns }, fetch: edge });
    expect(out.content).toBe("hi");
    expect(edge).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ hint: "weur", target: "https://api.meta.ai/v1/chat/completions", auth: "Bearer k" });
    expect(JSON.parse(calls[0].body).model).toBe("muse-spark-1.2");
  });
  it("streams through the relay", async () => {
    const { ns } = relayNs(sse);
    const chunks: string[] = [];
    for await (const c of metaChatStream(req, { env: { MODEL_API_KEY: "k", MODEL_RELAY: ns }, fetch: async () => new Response("", { status: 404 }) })) if (c.type === "delta") chunks.push(c.text);
    expect(chunks).toEqual(["Hi"]);
  });
  it("does not relay other errors, and reports a relayed 404 as briefly unavailable", async () => {
    const { ns, calls } = relayNs(() => new Response("", { status: 404 }));
    await expect(metaChat(req, { env: { MODEL_API_KEY: "k", MODEL_RELAY: ns }, fetch: async () => new Response("", { status: 400 }) })).rejects.toThrow("rejected the request");
    expect(calls).toHaveLength(0);
    await expect(metaChat(req, { env: { MODEL_API_KEY: "k", MODEL_RELAY: ns }, fetch: async () => new Response("", { status: 404 }) })).rejects.toThrow("briefly unavailable");
    expect(calls).toHaveLength(1);
  });
  it("without the binding, a 404 fails as before", async () => {
    await expect(metaChat(req, { env: { MODEL_API_KEY: "k" }, fetch: async () => new Response("", { status: 404 }) })).rejects.toThrow("briefly unavailable");
  });
  it("only relays the Meta API host", () => {
    expect(relayable("https://api.meta.ai/v1/chat/completions")).toBe(true);
    expect(relayable("https://example.com/v1/chat/completions")).toBe(false);
  });
  it("MODEL_RELAY_MODE=always sends the first attempt through the relay", async () => {
    const { ns, calls } = relayNs(okJson);
    const edge = vi.fn(async () => okJson());
    await metaChat(req, { env: { MODEL_API_KEY: "k", MODEL_RELAY: ns, MODEL_RELAY_MODE: "always" }, fetch: edge });
    expect(edge).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});
