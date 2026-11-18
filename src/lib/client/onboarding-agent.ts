import { z } from "zod";
import { call, pollTask, type ApiResult } from "./api";
import type { AgentTask, Case, Language } from "./types";
import { tNow } from "@/lib/i18n/current";
export type AskAnswer = { answer: string; citations: { title: string; url: string; quote: string }[]; notice?: string };
export const AskAnswerSchema = z.object({ answer: z.string().min(1).max(12000), citations: z.array(z.object({ title: z.string().max(300), url: z.string().url().max(500), quote: z.string().max(600) })).max(6), notice: z.string().max(500).optional() });
export const askAgent = (question: string, caseContext: Case, language: Language) => call<{ taskId: string }>("/api/agent/ask", { method: "POST", body: JSON.stringify({ question, case: caseContext, language }) });
export const stopAgent = (id: string) => call<{ stopped: true }>(`/api/agent/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
const snapshot = z.object({ id: z.string(), status: z.enum(["queued", "running", "done", "failed"]) }).passthrough();

/** Consumes actual task snapshots. A broken stream falls back to the existing task endpoint. */
export function observeAgentTask(id: string, receive: (task: AgentTask<AskAnswer>) => void, signal: AbortSignal): Promise<ApiResult<AgentTask<AskAnswer>>> {
  return new Promise((resolve) => {
    let settled = false; let polling = false; let stream: EventSource | null = null;
    const done = (value: ApiResult<AgentTask<AskAnswer>>) => { if (settled) return; settled = true; stream?.close(); signal.removeEventListener("abort", abort); resolve(value); };
    const abort = () => done({ ok: false, status: 0, code: "aborted", error: tNow("onboarding")("stoppedListening") });
    const fallback = () => { if (settled || polling) return; polling = true; stream?.close(); stream = null; void pollTask<AskAnswer>(id, receive, signal).then(done); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) return abort();
    if (typeof EventSource === "undefined") return fallback();
    stream = new EventSource(`/api/agent/tasks/${encodeURIComponent(id)}/events`);
    stream.addEventListener("task", (event) => {
      if (settled || signal.aborted) return;
      try {
        const parsed = snapshot.safeParse(JSON.parse((event as MessageEvent).data));
        if (!parsed.success || parsed.data.id !== id) return fallback();
        const task = parsed.data as unknown as AgentTask<AskAnswer>;
        receive(task); if (task.status === "done" || task.status === "failed") done({ ok: true, data: task });
      } catch { fallback(); }
    });
    stream.addEventListener("failure", fallback);
    stream.onerror = fallback;
  });
}
