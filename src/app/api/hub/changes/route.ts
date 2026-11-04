import { NextResponse } from "next/server";
import { z } from "zod";
import { mergedChanges } from "@/lib/hub/pipeline";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const Query = z.object({ country: z.literal("pl").default("pl") });

/** Public: detected changes on official Polish immigration pages, newest first. */
export async function GET(request: Request) {
  try {
    const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!q.success) return jsonError(400, "Only country=pl is supported", "invalid_request");
    const env = getEnv();
    const latest = await env.DB.prepare("SELECT MAX(fetched_at) AS checked FROM hub_snapshots WHERE country = ?").bind(q.data.country).first<{ checked: number | null }>();
    return NextResponse.json({ country: q.data.country, changes: await mergedChanges(env, 30), kind: "official_pages", personalApplicationStatus: false, checkedAt: latest?.checked ? new Date(latest.checked).toISOString() : null });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
