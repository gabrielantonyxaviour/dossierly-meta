import { z } from "zod";
import type { Env } from "../env";

export type ConnectionsEnv = Env & {
  COMPOSIO_API_KEY?: string; COMPOSIO_PROJECT_ID?: string;
  COMPOSIO_GMAIL_AUTH_CONFIG_ID?: string; COMPOSIO_OUTLOOK_AUTH_CONFIG_ID?: string;
  COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID?: string;
  COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID?: string;
  COMPOSIO_GMAIL_DISABLED_REASON?: string;
  COMPOSIO_GMAIL_TEST_USERS?: string;
};
export const categorySchema = z.enum(["mail", "calendar"]);
export const providerSchema = z.enum(["gmail", "outlook", "googlecalendar", "microsoftcalendar"]);
export type Category = z.infer<typeof categorySchema>;
export type Provider = z.infer<typeof providerSchema>;
export const toolkit = (p: Provider) => p === "microsoftcalendar" ? "outlook" : p;
export const validPair = (c: Category, p: Provider) => c === "mail" ? ["gmail", "outlook"].includes(p) : ["googlecalendar", "microsoftcalendar"].includes(p);
export const returnPathSchema = z.enum(["/onboarding", "/app", "/app/letters", "/app/prepare", "/app/meet"]);
export const connectSchema = z.object({ category: categorySchema, provider: providerSchema, returnPath: returnPathSchema.default("/onboarding") }).strict()
  .refine(x => validPair(x.category, x.provider));
export const disconnectSchema = z.object({ category: categorySchema }).strict();
export const opaqueId = z.string().min(1).max(1024).regex(/^[A-Za-z0-9_=.@/-]+$/);
export const importSchema = z.object({ messageId: opaqueId, attachmentId: opaqueId.optional() }).strict();
export const searchSchema = z.object({ q: z.string().trim().max(160).default(""), cursor: z.string().max(2048).optional() }).strict();
export const eventSchema = z.object({ calendarId: z.string().min(1).max(1024), title: z.string().trim().min(1).max(160),
  date: z.iso.date(), description: z.string().max(2000).default(""), idempotencyKey: z.string().uuid(),
  /** Warsaw local start time; absent means an all-day event. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), durationMin: z.number().int().min(15).max(600).optional(),
  location: z.string().trim().max(300).optional(), reminderMinutes: z.array(z.number().int().min(0).max(40320)).max(5).optional() }).strict();
export type AccountRow = { account_id: string; category: Category; provider: Provider; broker_id: string; auth_config_id: string; label: string; scopes: string; connected_at: number };
export type IntentRow = { state_hash: string; account_id: string; session_hash: string; category: Category; provider: Provider; auth_config_id: string; broker_id: string; return_path: string; expires_at: number; consumed_at: number | null };
export function configId(env: ConnectionsEnv, p: Provider) {
  return p === "gmail" ? env.COMPOSIO_GMAIL_AUTH_CONFIG_ID : p === "googlecalendar" ? env.COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID : p === "microsoftcalendar" ? env.COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID : env.COMPOSIO_OUTLOOK_AUTH_CONFIG_ID;
}
export const brokerUser = (id: string) => `dossierly:${id}`;
