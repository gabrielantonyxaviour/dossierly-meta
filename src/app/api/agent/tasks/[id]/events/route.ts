import { getTask, taskView } from "@/lib/agent/queue";
import { advanceTask } from "@/lib/agent/service";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUserState } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Streams actual task snapshots and the final validated answer, never simulated token chunks. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const env = getEnv(); const { accountId } = await requireUserState(req); const { id } = await ctx.params;
    const first = await getTask(env, id);
    if (!first || first.user_id !== accountId) throw new ApiError(404, "Task not found", "not_found");
    if (!(await rateLimit(env, accountId, "task_events", 30, 60)).ok) throw new ApiError(429, "Wait before reconnecting", "rate_limited");
    const encoder = new TextEncoder(); let stopped = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, value: unknown) => { if (!stopped) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`)); };
        const started = Date.now(); let previous = "";
        try {
          while (!stopped && !req.signal.aborted && Date.now() - started < 50_000) {
            const row = await getTask(env, id);
            if (!row || row.user_id !== accountId) break;
            const view = taskView(await advanceTask(env, row)); const serialized = JSON.stringify(view);
            if (serialized !== previous) { send("task", view); previous = serialized; }
            if (view.status === "done" || view.status === "failed") { send("complete", { status: view.status }); break; }
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        } catch { send("failure", { error: "Connection interrupted. Reconnect to check your request.", code: "stream_unavailable" }); }
        finally { if (!stopped) { stopped = true; controller.close(); } }
      },
      cancel() { stopped = true; },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", "x-accel-buffering": "no" } });
  } catch (error) { return errorResponse(error); }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
