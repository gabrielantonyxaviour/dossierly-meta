import { z } from "zod";

export const ATTACHMENT_KINDS = ["deadline", "document", "event", "task", "appointment"] as const;

export const ChatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be from the user"),
  attachments: z.array(z.object({ kind: z.enum(ATTACHMENT_KINDS), id: z.string().min(1).max(64) })).max(5).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatAttachment = NonNullable<ChatRequest["attachments"]>[number];
