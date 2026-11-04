/**
 * Agent task contracts. Self-contained on purpose (imports only zod, no local imports, erasable
 * TypeScript only): the M2 bridge imports this very file with Node's type stripping, so the Worker
 * and the bridge validate against one definition.
 */
import { z } from "zod";

export const SAMPLE_USER_ID = "sample-arjun";
export const TASK_KINDS = ["prepare", "ask", "file"] as const;
export const TaskKindSchema = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof TaskKindSchema>;

const str = (max: number) => z.string().trim().min(1).max(max);
const LanguageSchema = z.enum(["en", "uk", "ru", "hi", "ta", "zh", "ja", "vi"]);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The client-owned case, as sent per request (see docs/BUILD.md). Extra fields pass through. */
export const CaseContextSchema = z
  .object({
    id: str(80),
    office: str(160),
    caseNumber: z.string().max(80).optional(),
    context: z.object({ reason: str(80), stage: str(120), city: z.string().max(120).optional() }).optional(),
    profile: z.object({ name: str(120), language: LanguageSchema, addresses: z.array(str(200)).max(5).optional() }).passthrough(),
    events: z
      .array(
        z.object({
          id: str(80),
          date: IsoDate,
          kind: z.enum(["appointment", "letter", "wrap", "note"]),
          title: str(200),
          summary: z.string().max(1500).default(""),
          refs: z.array(str(120)).max(10).optional(),
        }),
      )
      .max(60)
      .default([]),
    documents: z.array(z.object({ name: str(160), have: z.boolean() })).max(40).default([]),
    deadlines: z
      .array(z.object({ id: str(80), date: str(40), what: str(300), sourceEventId: str(80) }))
      .max(30)
      .default([]),
  })
  .passthrough();
export type CaseContext = z.infer<typeof CaseContextSchema>;

/** A retrieved hub passage the agent may cite. The hub pipeline fills these. */
export const PassageSchema = z.object({
  url: z.string().url().max(500),
  title: str(300),
  text: z.string().min(1).max(6000),
});
export type Passage = z.infer<typeof PassageSchema>;

const Extras = {
  passages: z.array(PassageSchema).max(12).default([]),
  /** Optional SKILL.md playbook text for the office/letter type (hub/skills/**). */
  skill: z.string().max(20000).optional(),
};

export const PrepareInputSchema = z.object({
  appointment: z.object({ office: str(160), purpose: str(200), date: IsoDate }),
  case: CaseContextSchema,
  language: LanguageSchema,
  changes: z
    .array(z.object({ title: str(300), summary: z.string().max(1000), url: z.string().url().max(500), detectedAt: str(40) }))
    .max(10)
    .default([]),
  ...Extras,
});
export const AskInputSchema = z.object({
  question: str(1500),
  case: CaseContextSchema,
  language: LanguageSchema,
  ...Extras,
});
export const FileInputSchema = z.object({
  event: z.object({
    id: str(80),
    date: IsoDate,
    kind: z.enum(["appointment", "letter", "wrap", "note"]),
    title: str(200),
    summary: z.string().max(4000).default(""),
    refs: z.array(str(120)).max(10).optional(),
  }),
  case: CaseContextSchema,
  language: LanguageSchema.default("en"),
});
export const InputSchemas = { prepare: PrepareInputSchema, ask: AskInputSchema, file: FileInputSchema } as const;
export type PrepareInput = z.infer<typeof PrepareInputSchema>;
export type AskInput = z.infer<typeof AskInputSchema>;
export type FileInput = z.infer<typeof FileInputSchema>;
export type TaskInput = PrepareInput | AskInput | FileInput;

// ---- results ----------------------------------------------------------------

export const CitationSchema = z.object({ url: z.string().url().max(500), title: str(300), quote: str(600) });
/** Keeps the well-formed entries of a model-written list and drops the rest, so one bad item cannot sink the answer. */
function lenient<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(z.unknown())
    .default([])
    .transform((list) => list.flatMap((v) => { const r = item.safeParse(v); return r.success ? [r.data as z.infer<T>] : []; }).slice(0, max));
}
/** Status words are normalised ("Have", "needed", "unknown"); the server then sets have/missing from the case's documents. */
const StatusSchema = z.preprocess((v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "have" || s === "held" || s === "yes" ? "have" : s === "missing" || s === "needed" || s === "no" ? "missing" : "check";
}, z.enum(["have", "missing", "check"]));
const LooseCitationSchema = z.object({
  url: z.string().url().max(500),
  title: str(300),
  quote: z.string().trim().min(1).transform((q) => q.slice(0, 600)),
});
const ChecklistItemSchema = z.object({ item: str(300), status: StatusSchema, citation: LooseCitationSchema });
const PhraseSchema = z.object({ local: str(300), user: str(400) });
const ChangeSchema = z.object({ title: str(300), summary: z.string().max(1000), url: z.string().url().max(500), detectedAt: str(40) });
export const PrepareResultSchema = z.object({
  checklist: lenient(ChecklistItemSchema, 25).refine((l) => l.length > 0, "the checklist has no well-formed items"),
  phrases: lenient(PhraseSchema, 12),
  changes: lenient(ChangeSchema, 10),
});
export const AskResultSchema = z.object({
  answer: str(3000),
  citations: z.array(CitationSchema).max(6).default([]),
  notice: z.string().max(300).optional(),
});
export const FileResultSchema = z.object({
  filed: z.boolean(),
  summary: str(600),
  memoryUpdated: z.boolean().default(true),
});
export const ResultSchemas = { prepare: PrepareResultSchema, ask: AskResultSchema, file: FileResultSchema } as const;
export type PrepareResult = z.infer<typeof PrepareResultSchema>;
export type AskResult = z.infer<typeof AskResultSchema>;
export type FileResult = z.infer<typeof FileResultSchema>;
export type TaskResult = PrepareResult | AskResult | FileResult;

// ---- wire formats -----------------------------------------------------------

export const TraceStepSchema = z.object({ step: str(200), tool: z.string().max(80).optional(), ms: z.number().min(0).max(3_600_000) });
export type TraceStep = z.infer<typeof TraceStepSchema>;

export const AskRequestSchema = z.object({ question: str(1500), case: CaseContextSchema, language: LanguageSchema });
export const FileRequestSchema = z.object({ event: FileInputSchema.shape.event, case: CaseContextSchema });
