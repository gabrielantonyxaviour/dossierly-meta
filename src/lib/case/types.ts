import { z } from "zod";

/* Entities of the server-side case. No zod defaults: patch schemas must not inject values. */

const iso = z.string().datetime({ offset: true });
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Invalid date");
const text = (max = 500) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const STAGES = ["just_arrived", "preparing_application", "filed", "waiting_decision", "decision_received"] as const;
export const PERMIT_TYPES = ["temporary_residence_study", "temporary_residence_work", "other"] as const;

export const profileSchema = z.object({
  fullName: text(120).nullable(),
  preferredLanguage: text(16),
  country: z.literal("PL"),
  city: text(80).nullable(),
  permitType: z.enum(PERMIT_TYPES).nullable(),
  stage: z.enum(STAGES),
  organisation: text(160).nullable(), // university or employer
  arrivalDate: isoDate.nullable(),
  phone: z.object({ number: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(), verified: z.boolean(), callsEnabled: z.boolean() }),
  timezone: text(64),
});
export const profilePatchSchema = profileSchema.partial({ fullName: true, preferredLanguage: true, country: true, city: true, permitType: true, stage: true, organisation: true, arrivalDate: true, timezone: true }).extend({ phone: profileSchema.shape.phone.partial().optional() }).partial().strict();

export const FACT_KEYS = ["caseNumber", "office", "filedAt", "upoReceivedAt", "mosStatus", "inpolStatus"] as const;
export const factSchema = z.object({
  value: text(300),
  source: z.object({ type: z.enum(["email", "letter", "screenshot", "user", "call"]), ref: z.string().max(200).nullable() }),
  confirmedByUser: z.boolean(),
});
const factsShape = Object.fromEntries(FACT_KEYS.map((k) => [k, factSchema.optional()])) as Record<(typeof FACT_KEYS)[number], z.ZodOptional<typeof factSchema>>;
export const factsSchema = z.object(factsShape);
/** null clears a fact. */
export const factsPatchSchema = z
  .object(Object.fromEntries(FACT_KEYS.map((k) => [k, factSchema.nullable().optional()])) as Record<(typeof FACT_KEYS)[number], z.ZodOptional<z.ZodNullable<typeof factSchema>>>)
  .strict();

export const DOC_KINDS = ["passport", "rental_agreement", "health_insurance", "university_certificate", "photo", "upo", "letter", "other"] as const;
export const documentSchema = z.object({
  id,
  kind: z.enum(DOC_KINDS),
  title: text(200),
  status: z.enum(["have", "missing", "requested"]),
  fileKey: z.string().max(300).nullable(),
  pages: z.number().int().min(0).max(500).nullable(),
  extractedFields: z.record(z.string().max(60), z.string().max(1000)),
  source: z.enum(["upload", "email", "scan", "user", "agent"]),
  createdAt: iso,
});

export const deadlineSchema = z.object({
  id,
  title: text(200),
  dueDate: isoDate, // Europe/Warsaw calendar day
  computation: z.object({ steps: z.array(text(400)).max(20), rule: z.string().max(200).nullable(), legalRefUrl: z.string().url().max(400).nullable() }),
  triggeredBy: id.nullable(),
  status: z.enum(["open", "done", "missed"]),
  reminders: z.array(z.object({ at: iso, channel: z.enum(["in_app", "email", "push", "call"]), sentAt: iso.nullable() })).max(20),
  createdAt: iso,
});

export const taskSchema = z.object({
  id,
  title: text(200),
  detail: z.string().max(2000),
  dueDeadlineId: id.nullable(),
  origin: z.enum(["counter", "letter", "email", "agent", "user"]),
  status: z.enum(["open", "done", "dismissed"]),
  createdAt: iso,
});

export const EVENT_TYPES = ["email_received", "letter_read", "call", "counter_session", "deadline_created", "document_added", "note"] as const;
export const eventSchema = z.object({
  id,
  at: iso,
  type: z.enum(EVENT_TYPES),
  summary: text(600),
  refs: z.array(id).max(20),
  createdAt: iso,
});

export const appointmentSchema = z.object({
  id,
  title: text(200),
  at: iso,
  location: z.object({ name: text(160), address: z.string().max(300) }),
  purpose: z.string().max(500),
  prepTaskIds: z.array(id).max(20),
  createdAt: iso,
});

export const COLLECTIONS = ["documents", "deadlines", "tasks", "events", "appointments"] as const;
export type Collection = (typeof COLLECTIONS)[number];
export const collectionSchema = z.enum(COLLECTIONS);

export type Profile = z.infer<typeof profileSchema>;
export type Facts = z.infer<typeof factsSchema>;
export type CaseDocument = z.infer<typeof documentSchema>;
export type Deadline = z.infer<typeof deadlineSchema>;
export type CaseTask = z.infer<typeof taskSchema>;
export type CaseEvent = z.infer<typeof eventSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;

export type CaseItemMap = { documents: CaseDocument; deadlines: Deadline; tasks: CaseTask; events: CaseEvent; appointments: Appointment };

export type CaseSnapshot = {
  profile: Profile;
  facts: Facts;
  documents: CaseDocument[];
  deadlines: Deadline[];
  tasks: CaseTask[];
  events: CaseEvent[];
  appointments: Appointment[];
};

/** Full item schemas keyed by collection (validates the stored/merged item). */
export const itemSchemas = { documents: documentSchema, deadlines: deadlineSchema, tasks: taskSchema, events: eventSchema, appointments: appointmentSchema } as const;

/** Fields the server fills when the caller omits them on create. */
const createOptional = {
  documents: { id: true, status: true, fileKey: true, pages: true, extractedFields: true, source: true },
  deadlines: { id: true, computation: true, triggeredBy: true, status: true, reminders: true },
  tasks: { id: true, detail: true, dueDeadlineId: true, origin: true, status: true },
  events: { id: true, at: true, refs: true },
  appointments: { id: true, location: true, purpose: true, prepTaskIds: true },
} as const;

export const createSchemas = {
  documents: documentSchema.omit({ createdAt: true }).partial(createOptional.documents).strict(),
  deadlines: deadlineSchema.omit({ createdAt: true }).partial(createOptional.deadlines).strict(),
  tasks: taskSchema.omit({ createdAt: true }).partial(createOptional.tasks).strict(),
  events: eventSchema.omit({ createdAt: true }).partial(createOptional.events).strict(),
  appointments: appointmentSchema.omit({ createdAt: true }).partial(createOptional.appointments).strict(),
} as const;

export const patchSchemas = {
  documents: documentSchema.omit({ id: true, createdAt: true }).partial().strict(),
  deadlines: deadlineSchema.omit({ id: true, createdAt: true }).partial().strict(),
  tasks: taskSchema.omit({ id: true, createdAt: true }).partial().strict(),
  events: eventSchema.omit({ id: true, createdAt: true }).partial().strict(),
  appointments: appointmentSchema.omit({ id: true, createdAt: true }).partial().strict(),
} as const;

export function defaultProfile(): Profile {
  return {
    fullName: null,
    preferredLanguage: "en",
    country: "PL",
    city: null,
    permitType: null,
    stage: "just_arrived",
    organisation: null,
    arrivalDate: null,
    phone: { number: null, verified: false, callsEnabled: false },
    timezone: "Europe/Warsaw",
  };
}
