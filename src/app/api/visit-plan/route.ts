import { CaseClientError, caseClient } from "@/lib/case/client";
import { ModelError, meterFixed } from "@/lib/model";
import { checkAndSpend } from "@/lib/server/budget";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { buildVisitPlan } from "@/lib/visit/plan";
import { visitRequestSchema, type VisitEvent } from "@/lib/visit/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RETRYABLE = new Set(["rate_limited", "provider_unavailable", "model_unavailable", "model_error", "invalid_output"]);
const RESERVE_USD = 0.3;

function toEvent(e: unknown): VisitEvent {
  if (e instanceof ModelError) return { type: "error", error: e.message, code: e.code, retryable: RETRYABLE.has(e.code) };
  if (e instanceof CaseClientError) return { type: "error", error: e.message, code: e.code ?? "case_error", retryable: false };
  return { type: "error", error: "Something went wrong on our side", code: "internal", retryable: true };
}

export async function POST(req: Request) {
  let userId: string;
  let body;
  try {
    ({ userId } = await requireUser(req));
    body = await readJson(req, visitRequestSchema);
    if (!(await checkAndSpend(getEnv(), "search_calls", 1, { userId }))) {
      throw new ApiError(429, "Daily search limit reached. Try again tomorrow.", "search_limit");
    }
  } catch (e) {
    return errorResponse(e);
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: VisitEvent) => controller.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
      try {
        const plan = await meterFixed(getEnv(), RESERVE_USD, async () => {
          const r = await buildVisitPlan(caseClient(userId), body, { emit });
          return { value: r.plan, actualUsd: r.usd };
        });
        emit({ type: "plan", plan });
      } catch (e) {
        emit(toEvent(e));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
