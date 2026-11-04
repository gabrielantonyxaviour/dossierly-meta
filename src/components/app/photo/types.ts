import type { Box } from "@/lib/look/types";

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
  if (!ctx) throw new Error("This browser cannot crop images.");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, MOS_W, MOS_H);
  ctx.drawImage(bmp, c.x * sx, c.y * sy, c.w * sx, c.h * sy, 0, 0, MOS_W, MOS_H);
  bmp.close();
  for (const q of [0.95, 0.9, 0.85, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MOS_MAX_BYTES) return { blob, url: URL.createObjectURL(blob) };
  }
  throw new Error("Could not make the photo small enough.");
}
