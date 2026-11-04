import { describe, expect, it, vi } from "vitest";
import { ModelError } from "@/lib/model/types";

const calls = { n: 0, failFirst: 1, err: () => new ModelError("This model is briefly unavailable", "model_unavailable", 503) };
vi.mock("@/lib/model/meta", () => ({
  metaChatStream: () =>
    (async function* () {
      calls.n++;
      if (calls.n <= calls.failFirst) throw calls.err();
      yield { type: "delta", text: "SAY: Until Wednesday the eighteenth." };
    })(),
  metaChat: vi.fn(),
}));

import { streamLines } from "@/lib/voice/server/llm";

const args = { role: "interpret" as const, system: "s", messages: [], speak: ["SAY"] };

describe("streamLines retries provider hiccups", () => {
  it("retries a 404 that comes before any token, then speaks", async () => {
    calls.n = 0;
    calls.failFirst = 2;
    const said: string[] = [];
    const r = await streamLines({ MODEL_API_KEY: "k" }, args, { onSentence: (_k, s) => said.push(s) });
    expect(calls.n).toBe(3);
    expect(said).toEqual(["Until Wednesday the eighteenth."]);
    expect(r.fields.SAY).toBe("Until Wednesday the eighteenth.");
  });
  it("does not retry a rejected key", async () => {
    calls.n = 0;
    calls.failFirst = 1;
    const prev = calls.err;
    calls.err = () => new ModelError("The model service rejected the API key", "provider_unavailable");
    await expect(streamLines({ MODEL_API_KEY: "k" }, args, {})).rejects.toThrow("rejected the API key");
    expect(calls.n).toBe(1);
    calls.err = prev;
  });
});
