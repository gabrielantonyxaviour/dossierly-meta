import { z } from "zod";
import { DOC_KINDS } from "@/lib/case/types";

export const visitRequestSchema = z
  .object({
    appointmentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
    purpose: z.string().trim().min(1).max(200).optional(),
    save: z.boolean().optional(),
  })
  .strict();
export type VisitRequest = z.infer<typeof visitRequestSchema>;

/** What the structuring call must return. sourceIdx is the 1-based number of a citation in the prompt. */
export const structuredSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60),
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().max(500).default(""),
        sourceIdx: z.number().int().nullable().default(null),
        matchKind: z.enum(DOC_KINDS).nullable().default(null),
      }),
    )
    .max(20),
  office: z
    .object({
      name: z.string().trim().max(200),
      address: z.string().trim().max(300).default(""),
      note: z.string().trim().max(400).default(""),
      sourceIdx: z.number().int().nullable().default(null),
    })
    .nullable()
    .default(null),
  warnings: z.array(z.string().trim().max(300)).max(8).default([]),
});
export type Structured = z.infer<typeof structuredSchema>;

export const STRUCTURED_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" }, title: { type: "string" }, detail: { type: "string" },
          sourceIdx: { type: ["integer", "null"] },
          matchKind: { type: ["string", "null"], enum: [...DOC_KINDS, null] },
        },
        required: ["id", "title", "detail", "sourceIdx", "matchKind"],
      },
    },
    office: {
      type: ["object", "null"],
      properties: { name: { type: "string" }, address: { type: "string" }, note: { type: "string" }, sourceIdx: { type: ["integer", "null"] } },
      required: ["name", "address", "note", "sourceIdx"],
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["items", "office", "warnings"],
};

export type ItemStatus = "have" | "missing" | "unknown";
export interface PlanItem {
  id: string; title: string; detail: string; status: ItemStatus; caseDocId: string | null;
  source: { url: string; title: string } | null;
}
export interface VisitPlan {
  appointment: { id: string; title: string; at: string; location: string } | null;
  purpose: string;
  items: PlanItem[];
  office: { name: string; address: string; note: string; source: { url: string; title: string } | null } | null;
  warnings: string[];
  citations: { url: string; title: string; official: boolean }[];
  searches: number;
  ms: number;
  savedTaskIds?: string[];
}

export type VisitEvent =
  | { type: "stage"; stage: "searching" | "comparing" }
  | { type: "plan"; plan: VisitPlan }
  | { type: "error"; error: string; code: string; retryable: boolean };
