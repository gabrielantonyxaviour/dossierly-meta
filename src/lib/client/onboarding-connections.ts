import { call } from "./api";
export type Category = "mail" | "calendar";
export type Provider = "gmail" | "outlook" | "googlecalendar" | "microsoftcalendar";
export type Connection = { provider: Provider; category: Category; label: string; status: "connected" | "reconnect"; scopes: string[]; connectedAt: number };
export type Connections = { cleanupPending?: boolean; cleanupNotice?: string; capabilities: { provider: Provider; category: Category; available: boolean; reason?: string; notice?: string }[]; connections: { mail: Connection | null; calendar: Connection | null } };
export type MailMessage = { id: string; from: string; subject: string; date: string; snippet: string; hasAttachments: boolean };
export type MailImport = { kind: "message"; messageId: string; subject: string; from: string; text: string; attachments: { id: string; name: string; mime: string; size: number }[] } | { kind: "attachment"; file: { name: string; mime: string; dataUrl: string } };
const post = <T>(path: string, body: unknown) => call<T>(`/api/connections/${path}`, { method: "POST", body: JSON.stringify(body) });
export const connectionsApi = {
  get: () => call<Connections>("/api/connections"),
  connect: (category: Category, provider: Provider, returnPath: "/onboarding" | "/app" | "/app/connections") => post<{ redirectUrl: string }>("connect", { category, provider, returnPath }),
  disconnect: (category: Category) => post<{ ok: true; providerRevocationRequired?: boolean }>("disconnect", { category }),
  mail: (q: string, cursor?: string) => call<{ messages: MailMessage[]; nextCursor: string | null; partial: boolean }>(`/api/connections/mail?${new URLSearchParams({ q, ...(cursor ? { cursor } : {}) })}`),
  importMail: (messageId: string, attachmentId?: string) => post<MailImport>("mail/import", { messageId, ...(attachmentId ? { attachmentId } : {}) }),
  calendars: () => call<{ calendars: { id: string; name: string; primary: boolean }[] }>("/api/connections/calendars"),
  event: (body: { calendarId: string; title: string; date: string; description?: string; idempotencyKey: string }) => post<{ event: { id: string; title: string; date: string; url?: string }; replayed: boolean }>("calendar/events", body),
};
