import type { CaseDocument, CaseSnapshot, CaseTask } from "@/lib/case/types";

/* Photo items open the photo check (flow/paper's /app/photo-check), carrying the task it should attach to. */
const PHOTO = /photo|zdj[eę]ci|fotograf/i;

export const isPhotoTask = (t: CaseTask) => PHOTO.test(t.title);
export const isMissingPhoto = (d: CaseDocument) => d.kind === "photo" && d.status !== "have";

/** The open photo task to attach a checked photo to, if the case has one. */
export function openPhotoTask(c: CaseSnapshot): CaseTask | undefined {
  return c.tasks.find((t) => t.status === "open" && isPhotoTask(t)) ?? c.tasks.find((t) => t.status === "open" && PHOTO.test(t.detail));
}

export function photoCheckHref(taskId?: string | null): string {
  return taskId ? `/app/photo-check?task=${encodeURIComponent(taskId)}` : "/app/photo-check";
}
