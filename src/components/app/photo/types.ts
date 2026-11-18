import type { Box } from "@/lib/look/types";
import { tNow } from "@/lib/i18n/current";
import type { T } from "@/lib/i18n/translate";

export interface CropPlan {
  crop: { x: number; y: number; w: number; h: number };
  headRatio: number;
  upscaled: boolean;
  fits: boolean;
  notes: string[];
}

export interface PhotoCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "unsure";
  note: string;
}

export interface PhotoResult {
  head: Box | null;
  headPath: string | null;
  facePath?: string | null;
  crop: CropPlan | null;
  checks: PhotoCheck[];
  spec: { width: number; height: number; maxBytes: number; ratio: string; maxAgeMonths: number; sourceUrl: string };
  timings: { samMs: number; sparkMs: number };
}

export const MOS_W = 684;
export const MOS_H = 883;
export const MOS_MAX_BYTES = 2_621_440;

/** Crops the ORIGINAL image (full resolution) to the plan, scaled from the sent image, and encodes ≤ 2.5 MB. */
export async function renderMosPhoto(original: Blob, sent: { width: number; height: number }, plan: CropPlan): Promise<{ blob: Blob; url: string }> {
  const bmp = await createImageBitmap(original, { imageOrientation: "from-image" });
  const sx = bmp.width / sent.width;
  const sy = bmp.height / sent.height;
  const c = plan.crop;
  const canvas = document.createElement("canvas");
  canvas.width = MOS_W;
  canvas.height = MOS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(tNow("photo")("errCrop"));
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, MOS_W, MOS_H);
  ctx.drawImage(bmp, c.x * sx, c.y * sy, c.w * sx, c.h * sy, 0, 0, MOS_W, MOS_H);
  bmp.close();
  for (const q of [0.95, 0.9, 0.85, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MOS_MAX_BYTES) return { blob, url: URL.createObjectURL(blob) };
  }
  throw new Error(tNow("photo")("errTooBig"));
}

const CHECK_KEYS = ["face_found", "background", "frontal", "expression", "eyes", "lighting", "head_covering", "glasses", "sharpness", "single_person"];
/** The rule label in the reader's language; unknown ids keep the server's English. */
export const checkLabel = (t: T, c: PhotoCheck) => (CHECK_KEYS.includes(c.id) ? t(`check_${c.id}`) : c.label);

/* Fixed sentences the server writes in English (crop advice and fallback notes). Model-written notes stay as sent. */
const FIXED_NOTES: Record<string, string> = {
  "We couldn't find your head in this photo.": "noteNoHead",
  "Your shoulders may be in the outline, so we estimated where your chin is. Check the crop.": "noteShoulders",
  "Step back a little: your face is too big in this photo for a passport-style crop.": "noteTooBig",
  "Step back a little — there isn't enough space above your head.": "noteTop",
  "Step back a little — we need to see your neck and the top of your shoulders under your chin.": "noteBottom",
  "Move to the middle of the frame — your head is too close to the side of the photo.": "noteSide",
  "The photo's resolution is a bit low, so the final picture may look soft. A sharper photo works better.": "noteLowRes",
  "We couldn't run the photo checks just now. Try again in a moment.": "noteNoChecks",
  "We may be seeing a second person or face. Make sure it's only you in the photo.": "noteSecondFace",
  "We couldn't find your head in this photo. Face the camera in good light and keep your whole head in the picture.": "noteFaceNotFound",
  "We couldn't judge this one from the photo.": "noteUnsure",
};
export const noteText = (t: T, note: string) => (FIXED_NOTES[note] ? t(FIXED_NOTES[note]) : note);
