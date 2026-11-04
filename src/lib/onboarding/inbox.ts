import { z } from "zod";
import { ApiError } from "../server/http";
import { proxy } from "../server/connections/broker";
import { importGmail } from "../server/connections/mail";
import { budget, owned } from "../server/connections/store";
import type { ConnectionsEnv } from "../server/connections/types";

/**
 * Bounded, read-only inbox import for onboarding: one Gmail search for official-looking mail from the last
 * 120 days, at most MAX_MESSAGES results. Nothing is sent, labelled, moved or deleted in the mailbox.
 */
export const MAX_MESSAGES = 12;
const OFFICIAL_QUERY = [
  "wezwanie", '"karta pobytu"', '"pobyt czasowy"', '"zezwolenie na pobyt"', '"urząd wojewódzki"', "UdSC", "MOS",
  '"e-Doręczenia"', "cudzoziemców", "cudzoziemcow", '"residence permit"', '"residence card"', "immigration", "wiza",
  "uczelnia", "university", '"health insurance"', "ubezpieczenie", "PESEL", "zameldowanie", "inPOL", "wizyta",
].join(" OR ");

export type InboxMessage = { id: string; from: string; subject: string; receivedAt: string; snippet: string; attachments: number };
export type MessageBody = { id: string; from: string; subject: string; receivedAt: string; text: string; images: string[]; attachments: { name: string; mime: string }[] };

const metaSchema = z.object({
  id: z.string(),
  internalDate: z.string().optional(),
  snippet: z.string().optional(),
  payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(), parts: z.array(z.unknown()).optional() }).optional(),
});
const head = (m: z.infer<typeof metaSchema>, name: string) => (m.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "").slice(0, 300);
const when = (internalDate?: string) => {
  const n = Number(internalDate);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : new Date().toISOString();
};
const unescape = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function gmailRow(env: ConnectionsEnv, accountId: string) {
  const row = await owned(env, accountId, "mail");
  if (row.provider !== "gmail") throw new ApiError(409, "Inbox reading during setup supports Gmail. Connect Gmail to continue.", "gmail_required");
  return row;
}

export async function listOfficialMail(env: ConnectionsEnv, accountId: string): Promise<{ messages: InboxMessage[]; account: string }> {
  await budget(env, accountId);
  const row = await gmailRow(env, accountId);
  const q = new URLSearchParams({ maxResults: String(MAX_MESSAGES), q: `newer_than:120d -in:chats -category:promotions -category:social (${OFFICIAL_QUERY})` });
  const page = z.object({ messages: z.array(z.object({ id: z.string() })).optional() })
    .parse(await proxy(env, row, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`));
  const ids = (page.messages ?? []).slice(0, MAX_MESSAGES).map((m) => m.id);
  const messages = await Promise.all(ids.map(async (id) => {
    const m = metaSchema.parse(await proxy(env, row, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`));
    return { id: m.id, from: head(m, "from"), subject: head(m, "subject") || "(no subject)", receivedAt: when(m.internalDate), snippet: unescape(m.snippet ?? "").slice(0, 240), attachments: 0 };
  }));
  messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return { messages, account: row.label };
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Full text of one message plus up to two image attachments (as data URLs) for the vision model. */
export async function readMessage(env: ConnectionsEnv, accountId: string, messageId: string): Promise<MessageBody> {
  await budget(env, accountId);
  const row = await gmailRow(env, accountId);
  const meta = metaSchema.parse(await proxy(env, row, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=minimal`));
  const msg = await importGmail(env, row, messageId);
  if (msg.kind !== "message") throw new ApiError(502, "That email could not be read.", "provider_response");
  const images: string[] = [];
  for (const a of msg.attachments.filter((x) => IMAGE_TYPES.includes(x.mime) && x.size <= 3_500_000).slice(0, 2)) {
    try {
      const file = await importGmail(env, row, messageId, a.id);
      if (file.kind === "attachment") images.push(file.file.dataUrl);
    } catch {
      /* an unreadable attachment leaves the body text to work with */
    }
  }
  return {
    id: msg.messageId, from: msg.from, subject: msg.subject || "(no subject)", receivedAt: when(meta.internalDate),
    text: msg.text.slice(0, 12_000), images, attachments: msg.attachments.map((a) => ({ name: a.name, mime: a.mime })),
  };
}
