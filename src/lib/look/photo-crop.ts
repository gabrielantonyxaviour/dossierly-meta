/*
 * Pure crop geometry for the MOS application photo. We only ever crop and resize: the face, hair and background
 * are never touched. Spec: 684x883 px output, 35:45 proportion, head (crown to chin) 70-80% of the photo height.
 */

/** x1, y1, x2, y2 in source pixels (x2/y2 exclusive). Same shape as LookItem boxes. */
export type Box = [number, number, number, number];

export const PHOTO_SPEC = {
  width: 684,
  height: 883,
  maxBytes: 2_621_440,
  ratio: "35:45",
  maxAgeMonths: 6,
  sourceUrl: "https://www.gov.pl/web/udsc/mos-qa",
} as const;

export const ASPECT = PHOTO_SPEC.width / PHOTO_SPEC.height;
export const TARGET_HEAD_RATIO = 0.75;
export const MIN_HEAD_RATIO = 0.7;
export const MAX_HEAD_RATIO = 0.8;
/** Crown sits about 8% of the photo height below the top edge. */
export const CROWN_MARGIN = 0.08;
/** Never let the crown get closer than this to the top edge of the crop. */
const MIN_CROWN_MARGIN = 0.02;
/** Room under the chin so the neck and the start of the shoulders show. */
const MIN_CHIN_MARGIN = 0.08;
const MIN_SIDE_MARGIN = 0.04;
/** A real head is roughly 0.65-0.85 as wide as it is tall; wider than this and the box probably includes shoulders. */
const MAX_HEAD_ASPECT = 0.95;
const TYPICAL_HEAD_ASPECT = 0.75;

export interface CropPlan {
  crop: { x: number; y: number; w: number; h: number };
  /** Crown-to-chin height over crop height (0.70-0.80 is the target). */
  headRatio: number;
  /** True when the crop is shorter than 883 px, so resizing to the MOS size enlarges it and it may look soft. */
  upscaled: boolean;
  /** False when the head is too close to an edge to give a compliant crop; `crop` is then a best effort. */
  fits: boolean;
  notes: string[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Union of SAM's "head" box (it covers the hair, so it owns the crown) and "face" box (it owns the chin). */
export function mergeHead(head: Box | null, face: Box | null): Box | null {
  if (head && face) {
    return [Math.min(head[0], face[0]), Math.min(head[1], face[1]), Math.max(head[2], face[2]), Math.max(head[3], face[3])];
  }
  return head ?? face;
}

interface Attempt { crop: CropPlan["crop"]; ratio: number; problems: Array<"top" | "bottom" | "side"> }

function attempt(img: { w: number; h: number }, head: Box, headH: number, ratio: number): Attempt | null {
  const ch = headH / ratio;
  const cw = ch * ASPECT;
  if (ch > img.h + 0.5 || cw > img.w + 0.5) return null;
  const cx = (head[0] + head[2]) / 2;
  const y = Math.min(Math.max(head[1] - CROWN_MARGIN * ch, 0), img.h - ch);
  const x = Math.min(Math.max(cx - cw / 2, 0), img.w - cw);
  const crop = { x: Math.round(x), y: Math.round(y), w: Math.round(cw), h: Math.round(ch) };
  const problems: Attempt["problems"] = [];
  if (head[1] - crop.y < MIN_CROWN_MARGIN * ch) problems.push("top");
  if (crop.y + crop.h - (head[1] + headH) < MIN_CHIN_MARGIN * ch) problems.push("bottom");
  const side = MIN_SIDE_MARGIN * cw;
  if (head[0] - crop.x < side || crop.x + crop.w - head[2] < side) problems.push("side");
  return { crop, ratio, problems };
}

export function planCrop(input: { image: { w: number; h: number }; head: Box }): CropPlan {
  const { image: img } = input;
  const notes: string[] = [];
  let head = input.head;
  const rawH = head[3] - head[1];
  const rawW = head[2] - head[0];
  if (rawH <= 0 || rawW <= 0) {
    return { crop: { x: 0, y: 0, w: 0, h: 0 }, headRatio: 0, upscaled: false, fits: false, notes: ["We couldn't find your head in this photo."] };
  }
  // A box much wider than tall usually swallowed the shoulders: trust the crown and the width, estimate the chin.
  let headH = rawH;
  if (rawW / rawH > MAX_HEAD_ASPECT) {
    headH = rawW / TYPICAL_HEAD_ASPECT;
    head = [head[0], head[1], head[2], head[1] + headH];
    notes.push("Your shoulders may be in the outline, so we estimated where your chin is. Check the crop.");
  }

  // Prefer the ideal 75%, then allow up to 80% (a tighter crop) when the full frame is a little too small.
  let best = null as Attempt | null;
  for (const r of [TARGET_HEAD_RATIO, 0.77, MAX_HEAD_RATIO]) {
    const a = attempt(img, head, headH, r);
    if (a && a.problems.length === 0) {
      best = a;
      break;
    }
    if (a && (!best || a.problems.length < best.problems.length)) best = a;
  }

  if (!best) {
    // Even an 80% crop is bigger than the photo: the head fills the whole frame.
    const ch = Math.min(img.h, img.w / ASPECT);
    const cw = ch * ASPECT;
    const crop = { x: Math.round((img.w - cw) / 2), y: 0, w: Math.round(cw), h: Math.round(ch) };
    return {
      crop,
      headRatio: round3(headH / crop.h),
      upscaled: crop.h < PHOTO_SPEC.height,
      fits: false,
      notes: [...notes, "Step back a little: your face is too big in this photo for a passport-style crop."],
    };
  }

  const { crop, problems } = best;
  const fits = problems.length === 0;
  if (!fits) {
    if (problems.includes("top")) notes.push("Step back a little — there isn't enough space above your head.");
    if (problems.includes("bottom")) notes.push("Step back a little — we need to see your neck and the top of your shoulders under your chin.");
    if (problems.includes("side")) notes.push("Move to the middle of the frame — your head is too close to the side of the photo.");
  }
  const upscaled = crop.h < PHOTO_SPEC.height;
  if (upscaled) notes.push("The photo's resolution is a bit low, so the final picture may look soft. A sharper photo works better.");
  return { crop, headRatio: round3(headH / crop.h), upscaled, fits, notes };
}
