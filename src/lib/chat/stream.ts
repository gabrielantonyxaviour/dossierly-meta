import { costUsd } from "@/lib/model/cost";
import { assertModelsEnabled, estimateChatUsd, reserveModelSpend, settleModelSpend } from "@/lib/model/meter";
import { metaChatStream, type FetchLike } from "@/lib/model/meta";
import { resolveRole } from "@/lib/model/roles";
import { ModelError, type ChatMessage, type Usage } from "@/lib/model/types";
import type { Env } from "@/lib/server/env";
import type { CaseSource } from "./prompt";

export const MAX_TOKENS = 4000;
const enc = new TextEncoder();
export const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);

/**
 * Reserves budget, opens the upstream stream and reads its first chunk so provider/budget errors surface as
 * thrown ModelErrors (JSON responses) before any bytes are streamed. Returns the SSE body.
 */
export async function openChatStream(env: Env, messages: ChatMessage[], sources: CaseSource[], signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  assertModelsEnabled(env);
  const model = resolveRole("agent", env).model;
  const reserved = estimateChatUsd(model, messages, MAX_TOKENS);
  await reserveModelSpend(env, reserved);
  let settled = false;
  const settle = async (usage: Usage | null) => {
    if (settled) return;
    settled = true;
    await settleModelSpend(env, reserved, usage ? costUsd(model, usage) : 0);
  };
  const linked: FetchLike = (u, i) => fetch(u, { ...i, signal: i?.signal ? AbortSignal.any([i.signal, signal]) : signal });
  const gen = metaChatStream({ model, role: "agent", messages, maxTokens: MAX_TOKENS }, { env, fetch: linked });
  let first: IteratorResult<Awaited<ReturnType<typeof gen.next>>["value"]>;
  try {
    first = await gen.next();
  } catch (e) {
    await settle(null);
    throw e;
  }
  let usage: Usage | null = null;
  return new ReadableStream<Uint8Array>({
    async start(ctl) {
      try {
        if (sources.length) ctl.enqueue(sse({ type: "sources", items: sources }));
        let step = first;
        while (!step.done) {
          if (signal.aborted) break;
          if (step.value.type === "delta") ctl.enqueue(sse({ type: "delta", text: step.value.text }));
          else usage = step.value.usage;
          step = await gen.next();
        }
        if (!signal.aborted) ctl.enqueue(sse({ type: "done" }));
      } catch (e) {
        if (!signal.aborted) {
          const me = e instanceof ModelError ? e : null;
          ctl.enqueue(sse({ type: "error", error: me?.message ?? "The model service returned an error", code: me?.code ?? "model_error" }));
        }
      } finally {
        await settle(usage);
        try { ctl.close(); } catch { /* already closed by cancel */ }
      }
    },
    cancel() {
      void gen.return(undefined).catch(() => undefined);
    },
  });
}
