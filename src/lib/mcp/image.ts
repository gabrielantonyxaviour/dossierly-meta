/* Image intake for read_letter: base64 or https URL -> a validated data URL with its pixel size. */
import { McpToolError, type McpDeps } from "./types";

export const MAX_IMAGE_BYTES = 4_300_000; // keeps the data URL under the 6 MB look-request limit
type Mime = "image/jpeg" | "image/png" | "image/webp";

function sniff(b: Uint8Array): { mime: Mime; w: number; h: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", w: u32(16), h: u32(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { mime: "image/jpeg", h: u16(i + 5), w: u16(i + 7) };
      i += 2 + u16(i + 2);
    }
    return null;
  }
  const tag = (o: number, s: string) => [...s].every((c, k) => b[o + k] === c.charCodeAt(0));
  if (b.length > 30 && tag(0, "RIFF") && tag(8, "WEBP")) {
    const le = (i: number, n: number) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 256 + b[i + k]; return v; };
    if (tag(12, "VP8X")) return { mime: "image/webp", w: le(24, 3) + 1, h: le(27, 3) + 1 };
    if (tag(12, "VP8L")) { const bits = le(21, 4); return { mime: "image/webp", w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }; }
    if (tag(12, "VP8 ")) return { mime: "image/webp", w: le(26, 2) & 0x3fff, h: le(28, 2) & 0x3fff };
  }
  return null;
}

const toBase64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

export interface LoadedImage { dataUrl: string; width: number; height: number; bytes: Uint8Array }

export async function loadImage(src: { imageUrl?: string; imageBase64?: string }, deps: McpDeps): Promise<LoadedImage> {
  if (!!src.imageUrl === !!src.imageBase64) throw new McpToolError("Give exactly one of imageUrl or imageBase64.", "invalid_arguments");
  let bytes: Uint8Array;
  if (src.imageBase64) {
    const raw = src.imageBase64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (raw.length > MAX_IMAGE_BYTES * 1.4) throw new McpToolError("That image is too large (max about 4 MB).", "too_large");
    try { bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)); } catch { throw new McpToolError("imageBase64 is not valid base64.", "invalid_image"); }
  } else {
    const url = new URL(src.imageUrl as string);
    if (url.protocol !== "https:" || url.username || url.password) throw new McpToolError("imageUrl must be a plain https URL.", "invalid_image_url");
    let res: Response;
    try { res = await (deps.fetch ?? fetch)(url.toString(), { redirect: "error", headers: { accept: "image/*" } }); } catch { throw new McpToolError("Could not fetch imageUrl.", "image_fetch_failed"); }
    if (!res.ok) throw new McpToolError(`imageUrl returned HTTP ${res.status}.`, "image_fetch_failed");
    if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new McpToolError("That image is too large (max about 4 MB).", "too_large");
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  if (bytes.length > MAX_IMAGE_BYTES) throw new McpToolError("That image is too large (max about 4 MB).", "too_large");
  const info = sniff(bytes);
  if (!info) throw new McpToolError("Send a JPEG, PNG or WebP image.", "invalid_image");
  if (info.w < 64 || info.h < 64 || info.w > 4000 || info.h > 4000) throw new McpToolError("Image sides must be between 64 and 4000 pixels. Downscale it first.", "invalid_image");
  return { dataUrl: `data:${info.mime};base64,${toBase64(bytes)}`, width: info.w, height: info.h, bytes };
}
