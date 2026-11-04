import { ASR_MODEL, asrOnline } from "@/lib/server/asr";
import { getBudgets } from "@/lib/server/budget";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { hasModelKey, resolveRole } from "@/lib/model/roles";

export const dynamic = "force-dynamic";

const ROLE_NOTES = [
  { role: "interpret" as const, note: "turns, translation" },
  { role: "guard" as const, note: "safety guard" },
  { role: "agent" as const, note: "agent, prepare, ask" },
  { role: "vision" as const, note: "letter reading, grounding" },
  { role: "reason" as const, note: "whole-case reasoning" },
];

export async function GET() {
  try {
    const env = getEnv();
    const ready = hasModelKey(env);
    const models = [...new Map(ROLE_NOTES.map((r) => [resolveRole(r.role, env).model, r])).values()].map((r) => ({
      id: resolveRole(r.role, env).model,
      role: ROLE_NOTES.filter((n) => resolveRole(n.role, env).model === resolveRole(r.role, env).model).map((n) => n.note).join(", "),
      ready,
    }));
    return Response.json({
      models,
      // The sandbox bridge is retired; the field stays so older clients keep rendering.
      bridge: { online: false, lastSeen: null, sandboxes: 0 },
      budgets: await getBudgets(env),
      asr: { online: asrOnline(env), model: ASR_MODEL },
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
