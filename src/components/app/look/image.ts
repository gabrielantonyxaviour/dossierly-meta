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

/** Page 1 of a case document's stored file (the emailed PDF or a scan), from /api/case/documents/:id/file. */
export async function prepareFromDocument(id: string, maxSide = MAX_SIDE): Promise<PreparedImage> {
  const res = await fetch(`/api/case/documents/${encodeURIComponent(id)}/file`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "This document has no stored file to read." : "The document could not be opened.");
  const blob = await res.blob();
  if (blob.type !== "application/pdf") return prepareImage(blob, maxSide);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, (maxSide * 1.5) / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport, background: "#ffffff" }).promise;
    const png = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("The page could not be drawn."))), "image/png"));
    return prepareImage(png, maxSide);
  } finally {
    await doc.destroy();
  }
}
