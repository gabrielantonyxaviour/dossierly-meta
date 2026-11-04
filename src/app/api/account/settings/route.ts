import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { requireUserState } from "@/lib/server/session";
import { previewFlow } from "@/lib/dev/preview";

export const dynamic = "force-dynamic";

/** Settings screen facts: the account's verified email and whether outbound calls are enabled (demo allowlist). */
export async function GET(req: Request) {
  try {
    const state = await requireUserState(req);
    const env = getEnv();
    const row = await env.DB.prepare("SELECT email FROM email_identities WHERE user_id = ?").bind(state.accountId).first<{ email: string }>();
    const email = row?.email ?? null;
    const allow = String((env as unknown as Record<string, unknown>).DEMO_CALL_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    return Response.json(
      { email, callsEligible: !!email && allow.includes(email.toLowerCase()), sampleCase: state.activeCase === "sample", previewFlow: previewFlow(env) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
