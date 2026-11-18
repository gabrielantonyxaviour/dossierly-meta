import { z } from "zod";
import { proxy } from "../server/connections/broker";
import { importOutlook } from "../server/connections/mail";
import { budget, owned } from "../server/connections/store";
import { ApiError } from "../server/http";
import type { AccountRow, ConnectionsEnv } from "../server/connections/types";
import { OFFICIAL_QUERY, type MessageBody } from "../onboarding/inbox";
import { MAX_LIST } from "./list";

/* Outlook / Microsoft 365 mail through Composio's `outlook` toolkit (managed auth, scopes Mail.Read + User.Read),
   read with Microsoft Graph requests through Composio's proxy. Read-only: only GET requests are made. */

const GRAPH = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** The Gmail OFFICIAL_QUERY terms as plain words: Graph cannot combine $search with a date filter, so relevance is matched locally. */
const TERMS = OFFICIAL_QUERY.split(" OR ").map((t) => t.replace(/"/g, "").trim().toLowerCase()).filter(Boolean);
export const looksOfficial = (subject: string, preview: string) => {
  const hay = `${subject} ${preview}`.toLowerCase();
  return TERMS.some((t) => hay.includes(t));
};

const listSchema = z.object({ value: z.array(z.object({ id: z.string(), subject: z.string().nullable().optional(), bodyPreview: z.string().nullable().optional(), isDraft: z.boolean().optional() })) });

/** Ids of official-looking inbox mail received after the baseline, newest first. */
export async function listOutlookIds(env: ConnectionsEnv, row: AccountRow, since: number): Promise<string[]> {
  const q = new URLSearchParams({ $top: "40", $orderby: "receivedDateTime desc", $select: "id,subject,bodyPreview,isDraft", $filter: `receivedDateTime ge ${new Date(since).toISOString().replace(/\.\d{3}Z$/, "Z")}` });
  const page = listSchema.parse(await proxy(env, row, `${GRAPH}?${q.toString().replace(/\+/g, "%20")}`));
  return page.value.filter((m) => !m.isDraft && looksOfficial(m.subject ?? "", m.bodyPreview ?? "")).slice(0, MAX_LIST).map((m) => m.id);
}

const metaSchema = z.object({ receivedDateTime: z.string().optional() });

/** Pure: Graph message + imported text + inline images into the watcher's MessageBody. */
export function normaliseOutlook(id: string, receivedDateTime: string | undefined, msg: { messageId?: string; subject: string; from: string; text: string; attachments: MessageBody["attachments"] }, images: string[]): MessageBody {
  const t = Date.parse(receivedDateTime ?? "");
  return {
    id: msg.messageId ?? id, from: msg.from, subject: msg.subject || "(no subject)", receivedAt: Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString(),
    text: msg.text.slice(0, 12_000), images, attachments: msg.attachments.map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size })),
  };
}

/** Full text of one Outlook message plus up to two image attachments, same shape as the Gmail reader. */
export async function readOutlookMessage(env: ConnectionsEnv, accountId: string, messageId: string): Promise<MessageBody> {
  await budget(env, accountId);
  const row = await owned(env, accountId, "mail");
  if (row.provider !== "outlook") throw new ApiError(409, "Connect Outlook to continue.", "connection_required");
  const meta = metaSchema.parse(await proxy(env, row, `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=receivedDateTime`));
  const msg = await importOutlook(env, row, messageId);
  if (msg.kind !== "message") throw new ApiError(502, "That email could not be read.", "provider_response");
  const images: string[] = [];
  for (const a of msg.attachments.filter((x) => IMAGE_TYPES.includes(x.mime) && x.size <= 3_500_000).slice(0, 2)) {
    try {
      const file = await importOutlook(env, row, messageId, a.id);
      if (file.kind === "attachment") images.push(file.file.dataUrl);
    } catch {
      /* an unreadable attachment leaves the body text to work with */
    }
  }
  return normaliseOutlook(messageId, meta.receivedDateTime, msg, images);
}
