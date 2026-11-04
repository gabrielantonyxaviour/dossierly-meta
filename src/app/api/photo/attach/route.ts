import { z } from "zod";
import { caseClient, CaseClientError } from "@/lib/case/client";
import type { CaseDocument, CaseTask } from "@/lib/case/types";
import { decodeImage } from "@/lib/look/store";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2_621_440;
const Body = z.object({
  image: z.string().startsWith("data:image/jpeg;base64,").max(3_600_000),
  width: z.literal(684),
  height: z.literal(883),
  taskId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  originalBytes: z.number().int().min(0).max(100_000_000).optional(),
  originalSize: z.string().regex(/^\d{1,5}x\d{1,5}$/).optional(),
});
const PHOTO_TASK = /photo|zdj[eę]ci|fotograf/i;

/** The photo task: the one asked for, else the open task about a photo. */
const pickTask = (tasks: CaseTask[], id?: string) =>
  id ? tasks.find((t) => t.id === id) : tasks.find((t) => t.status === "open" && PHOTO_TASK.test(`${t.title} ${t.detail}`));
/** A photo document the case is still waiting for, filled instead of adding a second one. */
const pickDoc = (docs: CaseDocument[]) => docs.find((d) => d.kind === "photo" && d.status !== "have") ?? null;

/** Saves the checked 684×883 MOS photo to the case and closes the photo task. */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const { userId } = await requireUser(req);
    const body = await boundedJson(req, Body, 3_700_000);
    const { bytes, mime } = decodeImage(body.image);
    if (mime !== "image/jpeg" || bytes.length > MAX_BYTES) throw new ApiError(400, "The photo must be a JPEG of at most 2.5 MB", "invalid_photo");

    const c = caseClient(userId);
    const snap = await c.snapshot();
    const task = pickTask(snap.tasks, body.taskId);
    if (body.taskId && !task) throw new ApiError(404, "That task is not in your case", "task_not_found");

    const fileKey = `photos/${userId}/${Date.now().toString(36)}-mos-684x883.jpg`;
    await env.BLOBS.put(fileKey, bytes);
    const extractedFields = {
      size: "684x883", bytes: String(bytes.length), checkedOn: new Date().toISOString().slice(0, 10),
      ...(body.originalSize ? { originalSize: body.originalSize } : {}),
      ...(body.originalBytes ? { originalBytes: String(body.originalBytes) } : {}),
      ...(task ? { forTask: task.id } : {}),
    };
    const title = "MOS photo 684 × 883 (checked)";
    const existing = pickDoc(snap.documents);
    const doc = existing
      ? await c.patch("documents", existing.id, { title, status: "have", fileKey, extractedFields: { ...existing.extractedFields, ...extractedFields } })
      : await c.create("documents", { kind: "photo", title, status: "have", fileKey, pages: 1, source: "upload", extractedFields });
    if (task && task.status !== "done") await c.patch("tasks", task.id, { status: "done" });
    await c.create("events", { type: "document_added", summary: `Checked and cropped the MOS photo to 684 × 883 px${task ? ` for “${task.title}”` : ""}.`, refs: [doc.id, ...(task ? [task.id] : [])] }).catch(() => undefined);
    return Response.json({ documentId: doc.id, taskId: task?.id ?? null, taskTitle: task?.title ?? null, bytes: bytes.length }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof CaseClientError) return Response.json(e.code ? { error: e.message, code: e.code } : { error: e.message }, { status: e.status });
    return errorResponse(e);
  }
}
