import { NextResponse } from "next/server";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Eval and audit numbers, published as JSON under the KV key `limits:latest` by the eval/audit jobs
 * ({ eval?: {...}, audit?: {...}, updatedAt }). Until a job has written it: { pending: true }.
 */
export async function GET() {
  try {
    const raw = await getEnv().CACHE.get("limits:latest");
    if (!raw) return NextResponse.json({ pending: true });
    return NextResponse.json({ pending: false, ...(JSON.parse(raw) as object) });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
