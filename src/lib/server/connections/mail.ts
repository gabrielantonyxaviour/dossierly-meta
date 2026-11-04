import { z } from "zod";
import { ApiError } from "../http";
import { proxy } from "./broker";
import { budget, owned } from "./store";
import { importSchema, searchSchema, type ConnectionsEnv, type AccountRow } from "./types";

const record = z.record(z.string(), z.unknown());
const string = (v: unknown, max = 16000) => typeof v === "string" ? v.slice(0, max) : "";
export function plainText(v: unknown) { return string(v, 100_000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").slice(0, 16_000); }
function decode(s: string) { try { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); } catch { throw new ApiError(502, "The attachment could not be decoded.", "invalid_attachment"); } }
function textBody(v: unknown) { const bytes = Uint8Array.from(decode(string(v, 140_000)), c => c.charCodeAt(0)); return new TextDecoder().decode(bytes).slice(0, 16000); }
export const gmailMessage = z.object({ id: z.string(), snippet: z.string().optional(), payload: z.object({
  headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  mimeType: z.string().optional(), filename: z.string().optional(), body: record.optional(), parts: z.array(z.unknown()).optional(),
}).optional() });
function parts(v: unknown, depth = 0): Record<string, unknown>[] {
  if (!v || typeof v !== "object" || depth > 6) return [];
  const p = v as Record<string, unknown>;
  return [p, ...(Array.isArray(p.parts) ? p.parts.slice(0, 30).flatMap(x => parts(x, depth + 1)) : [])].slice(0, 64);
}
export function header(msg: z.infer<typeof gmailMessage>, name: string) { return string(msg.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value, 500); }
export async function searchMail(env: ConnectionsEnv, accountId: string, input: unknown) {
  const { q, cursor } = searchSchema.parse(input); await budget(env, accountId);
  const row = await owned(env, accountId, "mail");
  if (row.provider === "gmail") {
    const params = new URLSearchParams({ maxResults: "10", q: `newer_than:90d ${q || '(wezwanie OR pobyt OR immigration OR residence OR insurance OR enrollment OR university)'}` });
    if (cursor) params.set("pageToken", cursor);
    const page = z.object({ messages: z.array(z.object({ id: z.string() })).optional(), nextPageToken: z.string().optional() }).parse(await proxy(env, row, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`));
    const messages = [];
    for (const item of (page.messages ?? []).slice(0, 10)) {
      const msg = gmailMessage.parse(await proxy(env, row, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`));
      messages.push({ id: msg.id, from: header(msg, "from"), subject: header(msg, "subject"), date: header(msg, "date"), snippet: plainText(msg.snippet), hasAttachments: false });
    }
    return { messages, nextCursor: page.nextPageToken ?? null, partial: Boolean(page.nextPageToken) };
  }
  const offset = cursor ? z.coerce.number().int().min(0).max(100).parse(cursor) : 0;
  const params = new URLSearchParams({ "$top": "10", "$skip": String(offset), "$select": "id,from,subject,receivedDateTime,bodyPreview,hasAttachments", "$search": `"${(q || 'residence OR immigration OR wezwanie OR university').replace(/["\\]/g, " ")}"` });
  const data = z.object({ value: z.array(record), "@odata.nextLink": z.string().optional() }).parse(await proxy(env, row, `https://graph.microsoft.com/v1.0/me/messages?${params}`));
  const messages = data.value.slice(0, 10).map(m => ({ id: z.string().parse(m.id), from: sender(m.from), subject: string(m.subject, 500), date: string(m.receivedDateTime, 80), snippet: plainText(m.bodyPreview), hasAttachments: m.hasAttachments === true }));
  return { messages, nextCursor: data["@odata.nextLink"] && offset < 100 ? String(offset + 10) : null, partial: Boolean(data["@odata.nextLink"]) };
}
function sender(v: unknown) { const r = record.safeParse(v); if (!r.success) return ""; const e = record.safeParse(r.data.emailAddress); return e.success ? string(e.data.address, 254) : ""; }
function file(name: string, mime: string, data: string, declared: unknown) {
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(mime)) throw new ApiError(415, "Choose a PDF, JPEG, PNG or WebP attachment.", "attachment_type");
  if (data.length > 5_600_000 || (typeof declared === "number" && declared > 4_000_000)) throw new ApiError(413, "Choose an attachment smaller than 4 MB.", "attachment_too_large");
  const bytes = decode(data); if (bytes.length > 4_000_000) throw new ApiError(413, "Choose an attachment smaller than 4 MB.", "attachment_too_large");
  const valid = mime === "application/pdf" ? bytes.startsWith("%PDF-") : mime === "image/jpeg" ? bytes.startsWith("\xff\xd8\xff") : mime === "image/png" ? bytes.startsWith("\x89PNG\r\n\x1a\n") : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  if (!valid) throw new ApiError(415, "That attachment does not match its file type.", "attachment_type");
  return { kind: "attachment" as const, file: { name: name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 160), mime, dataUrl: `data:${mime};base64,${btoa(bytes)}` } };
}
export async function importMail(env: ConnectionsEnv, accountId: string, input: unknown) {
  const { messageId, attachmentId } = importSchema.parse(input); await budget(env, accountId);
  const row = await owned(env, accountId, "mail");
  return row.provider === "gmail" ? importGmail(env, row, messageId, attachmentId) : importOutlook(env, row, messageId, attachmentId);
}
export async function importGmail(env: ConnectionsEnv, row: AccountRow, id: string, attachmentId?: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`;
  const msg = gmailMessage.parse(await proxy(env, row, `${url}?format=full`, "GET", undefined, 6_000_000));
  const all = parts(msg.payload), attachments = all.filter(p => p.filename && p.body && typeof p.body === "object").map(p => {
    const b = p.body as Record<string, unknown>; return { id: string(b.attachmentId, 1024), name: string(p.filename, 160), mime: string(p.mimeType, 100), size: typeof b.size === "number" ? b.size : 0 };
  }).filter(p => p.id).slice(0, 20);
  if (attachmentId) {
    const a = attachments.find(p => p.id === attachmentId); if (!a) throw new ApiError(404, "Attachment not found.", "not_found");
    if (a.size > 4_000_000) throw new ApiError(413, "Choose an attachment smaller than 4 MB.", "attachment_too_large");
    const b = z.object({ data: z.string(), size: z.number().optional() }).parse(await proxy(env, row, `${url}/attachments/${encodeURIComponent(attachmentId)}`, "GET", undefined, 6_000_000));
    return file(a.name, a.mime, b.data, b.size);
  }
  const selected = all.find(p => p.mimeType === "text/plain") ?? all.find(p => p.mimeType === "text/html");
  const body = selected?.body as Record<string, unknown> | undefined;
  return { kind: "message" as const, messageId: msg.id, subject: header(msg, "subject"), from: header(msg, "from"), text: plainText(body?.data ? textBody(body.data) : msg.snippet), attachments };
}
async function importOutlook(env: ConnectionsEnv, row: AccountRow, id: string, attachmentId?: string) {
  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}`;
  if (attachmentId) {
    const a = z.object({ name: z.string(), contentType: z.string(), contentBytes: z.string(), size: z.number().optional() }).parse(await proxy(env, row, `${url}/attachments/${encodeURIComponent(attachmentId)}`, "GET", undefined, 6_000_000));
    return file(a.name, a.contentType, a.contentBytes, a.size);
  }
  const msg = z.object({ id: z.string(), subject: z.string().optional(), from: z.unknown().optional(), body: z.object({ content: z.string() }).optional() }).parse(await proxy(env, row, `${url}?$select=id,subject,from,body`, "GET", undefined, 150_000));
  const aa = z.object({ value: z.array(record) }).parse(await proxy(env, row, `${url}/attachments?$select=id,name,contentType,size&$top=20`));
  const attachments = aa.value.slice(0, 20).map(a => ({ id: z.string().parse(a.id), name: string(a.name, 160), mime: string(a.contentType, 100), size: typeof a.size === "number" ? a.size : 0 }));
  return { kind: "message" as const, messageId: msg.id, subject: msg.subject ?? "", from: sender(msg.from), text: plainText(msg.body?.content), attachments };
}
