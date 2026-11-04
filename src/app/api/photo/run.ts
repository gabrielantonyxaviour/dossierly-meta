/*
 * One photo check: SAM 3.1 finds the head ("head" owns the hair and crown, "face" owns the chin) while Spark checks
 * the ID-photo rules, in parallel. Pure orchestration; the route owns auth, rate limit and error mapping.
 */
import { z } from "zod";
import { SAM_USD_PER_IMAGE } from "@/lib/config";
import { mergeHead, PHOTO_SPEC, planCrop, type Box, type CropPlan } from "@/lib/look/photo-crop";
import { CHECK_IDS, CHECK_LABELS, normaliseChecks, photoCheck, type PhotoCheck } from "@/lib/look/photo-check";
import { samConcept, type SamObject } from "@/lib/look/sam-concept";
import { meterFixed } from "@/lib/model/meter";
import { ModelError, type ChatClient } from "@/lib/model/types";
import type { Env } from "@/lib/server/env";
import { recordLedger } from "@/lib/server/ledger";

export const photoRequestSchema = z.object({
  /** data:image/jpeg|png|webp;base64,... (the client downsizes to <= ~2000 px). */
  image: z.string().max(8_000_000).regex(/^data:image\/(jpeg|png|webp);base64,/),
  width: z.number().int().min(64).max(8000),
  height: z.number().int().min(64).max(8000),
});
export type PhotoRequest = z.infer<typeof photoRequestSchema>;

export type ResponseCheck = Omit<PhotoCheck, "id"> & { id: PhotoCheck["id"] | "face_found" };

export interface PhotoResponse {
  head: Box | null;
  headPath: string | null;
  /** Mask outline of the face (skin only, ends at the chin). */
  facePath: string | null;
  crop: CropPlan | null;
  checks: ResponseCheck[];
  spec: typeof PHOTO_SPEC;
  timings: { samMs: number; sparkMs: number };
}

export interface PhotoDeps {
  env: Env;
  userId: string | null;
  /** Test doubles. */
  client?: ChatClient;
  sam?: typeof samConcept;
}

const area = (o: SamObject) => Math.max(0, o.box[2] - o.box[0]) * Math.max(0, o.box[3] - o.box[1]);
const intersect = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const biggest = (os: SamObject[]) => os.reduce<SamObject | null>((m, o) => (!m || area(o) > area(m) ? o : m), null);

async function samMetered(deps: PhotoDeps, req: PhotoRequest, phrase: string) {
  const sam = deps.sam ?? samConcept;
  const out = await meterFixed(deps.env, SAM_USD_PER_IMAGE, async () => ({
    value: await sam(deps.env, { image: req.image, size: { w: req.width, h: req.height }, phrase }),
    actualUsd: SAM_USD_PER_IMAGE,
  }));
  try {
    await recordLedger(deps.env, { userId: deps.userId, kind: "model", what: "sam-3.1", action: "allowed", bytes: req.image.length, masked: 0, detail: { task: "photo_head", phrase } });
  } catch {
    /* bookkeeping must never fail a user request */
  }
  return out;
}

const FATAL = new Set(["over_budget", "models_disabled", "no_key"]);

export async function runPhotoCheck(deps: PhotoDeps, req: PhotoRequest): Promise<PhotoResponse> {
  const [headR, faceR, sparkR] = await Promise.allSettled([
    samMetered(deps, req, "head"),
    samMetered(deps, req, "face"),
    photoCheck({ env: deps.env, userId: deps.userId, client: deps.client }, { image: req.image }),
  ]);
  for (const r of [headR, faceR, sparkR]) {
    if (r.status === "rejected" && r.reason instanceof ModelError && FATAL.has(r.reason.code)) throw r.reason;
  }
  if (headR.status === "rejected" && faceR.status === "rejected") throw headR.reason;

  const heads = headR.status === "fulfilled" ? headR.value.objects : [];
  const faces = faceR.status === "fulfilled" ? faceR.value.objects : [];
  const samMs = Math.max(headR.status === "fulfilled" ? headR.value.ms : 0, faceR.status === "fulfilled" ? faceR.value.ms : 0);
  const head = biggest(heads);
  // The face that best overlaps the chosen head (or the biggest face when no head was found).
  const face = head
    ? faces.filter((f) => intersect(f.box, head.box) > 0).reduce<SamObject | null>((m, f) => (!m || intersect(f.box, head.box) > intersect(m.box, head.box) ? f : m), null)
    : biggest(faces);
  const merged = mergeHead(head?.box ?? null, face?.box ?? null);

  let checks: ResponseCheck[];
  let sparkMs = 0;
  if (sparkR.status === "fulfilled") {
    checks = sparkR.value.checks;
    sparkMs = sparkR.value.ms;
  } else {
    checks = normaliseChecks([]).map((c) => ({ ...c, note: "We couldn't run the photo checks just now. Try again in a moment." }));
  }

  // A second sizeable head hints at a second person. Spark has the final say on what is in the frame, so when it
  // sees one person we only downgrade to "unsure" instead of overriding it.
  if (heads.filter((h) => head && area(h) >= 0.25 * area(head)).length > 1) {
    checks = checks.map((c) => {
      if (c.id !== "single_person" || c.status === "fail") return c;
      return { ...c, status: "unsure" as const, note: "We may be seeing a second person or face. Make sure it's only you in the photo." };
    });
  }

  if (!merged) {
    checks = [{ id: "face_found", label: "Your face is visible", status: "fail", note: "We couldn't find your head in this photo. Face the camera in good light and keep your whole head in the picture." }, ...checks];
    return { head: null, headPath: null, facePath: null, crop: null, checks, spec: PHOTO_SPEC, timings: { samMs, sparkMs } };
  }
  const crop = planCrop({ image: { w: req.width, h: req.height }, head: merged });
  return { head: merged, headPath: head?.path ?? null, facePath: face?.path ?? null, crop, checks, spec: PHOTO_SPEC, timings: { samMs, sparkMs } };
}

export { CHECK_IDS, CHECK_LABELS };
