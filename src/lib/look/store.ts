/* Persistence of looks in R2 (env.BLOBS): looks/{userId}/{lookId}.json plus the image next to it. */
import type { Env } from "../server/env";
import { ApiError } from "../server/http";
import type { LookKind, LookOutline, LookRead, LookRequest } from "./types";

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
const EXT: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface LookRecord {
  lookId: string;
  userId: string;
  createdAt: string;
  size: { w: number; h: number };
  mime: ImageMime;
  /** R2 key of the image; also what the case document's fileKey points at. */
  imageKey: string;
  hint?: LookKind;
  question?: string;
  read: LookRead;
  /** Added once the outlines are done; lets a past look be drawn again without another SAM call. */
  outlines?: LookOutline[];
}

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SAFE_USER = /^[A-Za-z0-9_-]{1,64}$/;

/** "lk_" + 20 random alphanumerics. */
export function newLookId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `lk_${Array.from(bytes, (b) => ALNUM[b % ALNUM.length]).join("")}`;
}

const jsonKey = (userId: string, lookId: string) => {
  if (!SAFE_USER.test(userId)) throw new ApiError(400, "Invalid user", "invalid_user");
  return `looks/${userId}/${lookId}.json`;
};

/** Splits a validated `data:image/...;base64,` URL into bytes and mime. Throws 400 when the payload is not base64. */
export function decodeImage(dataUrl: string): { bytes: Uint8Array; mime: ImageMime } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new ApiError(400, "Send a JPEG, PNG or WebP image", "invalid_image");
  try {
    const bin = atob(m[2]);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    if (bytes.length < 64) throw new Error("too small");
    return { bytes, mime: m[1] as ImageMime };
  } catch {
    throw new ApiError(400, "That image could not be decoded", "invalid_image");
  }
}

export async function saveLook(env: Env, args: { userId: string; req: LookRequest; read: LookRead; bytes: Uint8Array; mime: ImageMime }): Promise<LookRecord> {
  const { userId, read } = args;
  const key = jsonKey(userId, read.lookId);
  const imageKey = key.replace(/\.json$/, `.${EXT[args.mime]}`);
  const record: LookRecord = {
    lookId: read.lookId,
    userId,
    createdAt: new Date().toISOString(),
    size: { w: args.req.width, h: args.req.height },
    mime: args.mime,
    imageKey,
    ...(args.req.hint ? { hint: args.req.hint } : {}),
    ...(args.req.question ? { question: args.req.question } : {}),
    read,
  };
  await env.BLOBS.put(imageKey, args.bytes);
  await env.BLOBS.put(key, JSON.stringify(record));
  return record;
}

/** Rewrites the JSON record only (the image is already stored). */
export async function updateLook(env: Env, rec: LookRecord): Promise<void> {
  await env.BLOBS.put(jsonKey(rec.userId, rec.lookId), JSON.stringify(rec));
}

/** The user's own look, or null (a look that belongs to someone else is indistinguishable from a missing one). */
export async function loadLook(env: Env, userId: string, lookId: string): Promise<LookRecord | null> {
  if (!/^lk_[A-Za-z0-9]{8,40}$/.test(lookId)) return null;
  const obj = await env.BLOBS.get(jsonKey(userId, lookId));
  if (!obj) return null;
  try {
    const rec = JSON.parse(new TextDecoder().decode(await obj.arrayBuffer())) as LookRecord;
    return rec.userId === userId && rec.lookId === lookId ? rec : null;
  } catch {
    return null;
  }
}

export async function loadLookImage(env: Env, rec: LookRecord): Promise<Uint8Array | null> {
  const obj = await env.BLOBS.get(rec.imageKey);
  return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
}
