import { z } from "zod";

/* The review the strategist produces. Model-facing schema: no length caps (storage clips), all fields required. */

const refs = z.array(z.string());
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ACTORS = ["user", "university", "employer", "office"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reviewSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.object({
    what: z.string().min(1),
    why: z.string(),
    evidence: refs,
    severity: z.enum(SEVERITIES),
    deadlineImpact: z.string(),
    deadlineDate: isoDate.nullable(),
  })),
  plan: z.array(z.object({
    order: z.number().int().min(1),
    action: z.string().min(1),
    date: isoDate.nullable(),
    dependsOn: z.array(z.number().int()),
    actor: z.enum(ACTORS),
    legalBasis: z.string().nullable(),
  })),
  inconsistencies: z.array(z.object({
    what: z.string().min(1),
    detail: z.string(),
    evidence: refs,
    legalConsequence: z.string().nullable(),
    suggestedFix: z.string(),
  })),
  questions: z.array(z.string().min(1)),
});
export type Review = z.infer<typeof reviewSchema>;

/** JSON Schema for response_format. */
export const reviewJsonSchema = z.toJSONSchema(reviewSchema, { io: "input" }) as Record<string, unknown>;

export type Proposal = { kind: "task" | "deadline"; title: string; detail: string; dueDate: string | null; relatedDeadlineId: string | null };

export type Usage = { tokensIn: number; tokensOut: number; cachedTokens: number };

export type StrategistCode =
  | "no_key" | "models_disabled" | "over_budget" | "user_budget" | "timeout" | "provider_unavailable"
  | "rate_limited" | "model_error" | "invalid_output" | "empty_case" | "case_unavailable";

export class StrategistError extends Error {
  constructor(message: string, readonly code: StrategistCode, readonly status = 502) {
    super(message);
    this.name = "StrategistError";
  }
}

export type StopReason = "final" | "round_limit" | "budget" | "time";

export const LIMITS = {
  maxToolRounds: 8,
  maxTokens: 12_000,
  userDailyUsd: 0.5,
  callTimeoutMs: 120_000,
  totalMs: 240_000,
  maxProposals: 6,
  toolResultChars: 6000,
} as const;

/** muse-wonder-1.0 list price, USD per million tokens (preview). */
export const WONDER_PRICE = { in: 4, cached: 1, out: 20 } as const;
export const WONDER_MODEL = "muse-wonder-1.0";

export const costOf = (u: Usage): number =>
  (Math.max(0, u.tokensIn - u.cachedTokens) * WONDER_PRICE.in + u.cachedTokens * WONDER_PRICE.cached + u.tokensOut * WONDER_PRICE.out) / 1_000_000;
