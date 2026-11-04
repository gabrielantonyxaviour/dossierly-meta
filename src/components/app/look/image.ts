/** Client-side image preparation: EXIF-correct orientation, downscale, re-encode as JPEG. */

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

const MAX_SIDE = 2000;

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* fall through: some browsers reject the options bag */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downscales so the long side is at most 2000 px. Keeps the image's own proportions. */
export async function prepareImage(blob: Blob, maxSide = MAX_SIDE): Promise<PreparedImage> {
  const src = await decode(blob);
  const w0 = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h0 = "naturalHeight" in src ? src.naturalHeight : src.height;
  if (!w0 || !h0) throw new Error("That file is not an image we can open.");
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const width = Math.max(64, Math.round(w0 * scale));
  const height = Math.max(64, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare images.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0, width, height);
  if ("close" in src) src.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return { dataUrl, width, height, bytes: Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75) };
}

export async function prepareFromUrl(url: string, maxSide = MAX_SIDE): Promise<PreparedImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the sample image.");
  return prepareImage(await res.blob(), maxSide);
}
