import PostalMime from "postal-mime";
import { plainText } from "../server/connections/mail";
import type { MessageBody } from "../onboarding/inbox";
import { bytesToHex } from "../server/util";

/** One forwarded email, parsed: the watcher's MessageBody plus a stable idempotency key and a Gmail-forwarding-confirmation flag. */
export type Parsed = { key: string; body: MessageBody; confirmation: { code: string | null; link: string | null } | null };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE = 3_500_000;
const startsWith = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);
const magicOk = (mime: string, b: Uint8Array) => mime === "image/jpeg" ? startsWith(b, [0xff, 0xd8, 0xff]) : mime === "image/png" ? startsWith(b, [0x89, 0x50, 0x4e, 0x47]) : startsWith(b, [0x52, 0x49, 0x46, 0x46]);
const b64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

export async function messageKey(messageId: string | undefined, raw: ArrayBuffer): Promise<string> {
  const basis = messageId?.trim() ? new TextEncoder().encode(messageId.trim().toLowerCase()) : new Uint8Array(raw);
  return `inb_${bytesToHex(await crypto.subtle.digest("SHA-256", basis as BufferSource)).slice(0, 32)}`;
}

/** Gmail's "Forwarding Confirmation" mail carries a code and a link the user must use; it is not a letter. */
export function detectConfirmation(from: string, subject: string, text: string) {
  if (!/forwarding-noreply@google\.com/i.test(from)) return null;
  const code = /confirmation code:?\s*(\d{6,10})/i.exec(text)?.[1] ?? /\b(\d{9})\b/.exec(subject)?.[1] ?? null;
  const link = /https:\/\/mail\.google\.com\/mail\/[^\s<>")]+/i.exec(text)?.[0] ?? null;
  return { code, link };
}

export async function parseInbound(raw: ArrayBuffer, now: number): Promise<Parsed> {
  const mail = await PostalMime.parse(raw);
  const from = mail.from ? (mail.from.name ? `${mail.from.name} <${mail.from.address ?? ""}>` : (mail.from.address ?? "")) : "";
  const text = (mail.text?.trim() ? mail.text : plainText(mail.html ?? "")).slice(0, 12_000);
  const date = Date.parse(mail.date ?? "");
  const images: string[] = [];
  const attachments: MessageBody["attachments"] = [];
  (mail.attachments ?? []).slice(0, 20).forEach((a, i) => {
    const bytes = new Uint8Array(typeof a.content === "string" ? new TextEncoder().encode(a.content) : a.content);
    const mime = (a.mimeType ?? "").toLowerCase();
    attachments.push({ id: `att${i}`, name: (a.filename ?? `attachment-${i + 1}`).replace(/[\x00-\x1f/\\]/g, "_").slice(0, 160), mime, size: bytes.byteLength });
    if (images.length < 2 && IMAGE_TYPES.includes(mime) && bytes.byteLength <= MAX_IMAGE && magicOk(mime, bytes)) images.push(`data:${mime};base64,${b64(bytes)}`);
  });
  const subject = (mail.subject ?? "").slice(0, 300);
  const key = await messageKey(mail.messageId, raw);
  return {
    key, confirmation: detectConfirmation(from, subject, mail.text ?? ""),
    body: { id: key, from: from.slice(0, 300), subject: subject || "(no subject)", receivedAt: new Date(Number.isFinite(date) && date <= now + 86_400_000 ? date : now).toISOString(), text, images, attachments },
  };
}
