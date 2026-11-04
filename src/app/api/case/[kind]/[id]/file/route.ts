import { caseClient } from "@/lib/case/client";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ kind: string; id: string }> };

const MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * The stored file of one of your case documents (an emailed PDF or a scanned image), from private storage.
 * Only keys under your own case or looks are served, so a document can never point at another person's file.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { userId } = await requireUser(req);
    const { kind, id } = await params;
    if (kind !== "documents") throw new ApiError(404, "Only documents have files", "not_found");
    const doc = (await caseClient(userId).snapshot()).documents.find((d) => d.id === id);
    const key = doc?.fileKey;
    if (!key) throw new ApiError(404, "This document has no stored file", "no_file");
    if (!key.startsWith(`case/${userId}/`) && !key.startsWith(`looks/${userId}/`)) throw new ApiError(403, "Not your file", "forbidden");
    const obj = await getEnv().BLOBS.get(key);
    if (!obj) throw new ApiError(404, "The stored file is missing", "file_missing");
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return new Response(await obj.arrayBuffer(), { headers: { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { POST, PUT, PATCH, DELETE } from "@/lib/server/get-only";
