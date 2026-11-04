import { z } from "zod";

/*
 * Contract between the Look UI and /api/look. One look = one image the user showed us.
 * Coordinates are always SOURCE IMAGE PIXELS of the image the client sent (not 0-1000).
 */

export const LOOK_KINDS = ["letter", "decision", "mos_screen", "upo", "inpol_status", "kiosk", "other"] as const;
export type LookKind = (typeof LOOK_KINDS)[number];

export const ITEM_ROLES = ["deadline", "case_number", "date", "documents", "office", "field", "button", "status", "amount", "other"] as const;
export type ItemRole = (typeof ITEM_ROLES)[number];

/** Request body for POST /api/look (JSON). */
export const lookRequestSchema = z.object({
  /** data:image/jpeg|png|webp;base64,... downscaled by the client to <= 2000px long side. */
  image: z.string().max(6_000_000).regex(/^data:image\/(jpeg|png|webp);base64,/),
  width: z.number().int().min(64).max(4000),
  height: z.number().int().min(64).max(4000),
  /** Optional: what the user says it is ("I'm on the MOS form"). */
  hint: z.enum(LOOK_KINDS).optional(),
  /** Optional free-text question ("which button do I press for fingerprints?"). */
  question: z.string().trim().max(300).optional(),
  /** True when the image is one of our public/sample test letters. */
  sample: z.boolean().optional(),
});
export type LookRequest = z.infer<typeof lookRequestSchema>;

export type Box = [number, number, number, number]; // x1, y1, x2, y2 in source pixels

export interface LookItem {
  id: string; // "i1", "i2", ...
  role: ItemRole;
  /** Short label in the user's language: "Your deadline", "Case number". */
  label: string;
  /** Verbatim text inside the box, as printed. */
  text: string;
  /** Plain-language meaning, one sentence. */
  meaning: string;
  box: Box;
  /** For MOS fields: the value from the user's case to type there; null when the case lacks it. */
  value?: string | null;
}

export interface LookRead {
  lookId: string;
  kind: LookKind;
  /** "Summons to complete missing documents" */
  title: string;
  /** 2-3 sentences in plain language: what this is and why it matters. */
  summary: string;
  /** What the user should do next, ordered, imperative, max 5. */
  actions: string[];
  items: LookItem[];
  /** Facts read from the image that belong in the case store (FACT_KEYS subset). */
  facts: Partial<Record<"caseNumber" | "office" | "filedAt" | "upoReceivedAt" | "mosStatus" | "inpolStatus", string>>;
  /** Letters/decisions only. */
  letter: null | {
    dateOnLetter: string | null; // YYYY-MM-DD
    asks: string[]; // in user's language
    asksLocal: string[]; // verbatim Polish
    deadlineRule: { amount: number | null; unit: "days" | "weeks" | "months" | null; from: "delivery" | "letter_date" | null; quote: string };
    /** Legal basis printed on the letter, e.g. "art. 64 § 2 KPA". */
    legalBasis: string | null;
  };
  /** Fields the model was unsure it read correctly (item ids or fact keys). */
  uncertain: string[];
  /** The model's own words when the image is unreadable or not an official document. */
  readable: boolean;
}

export interface LookOutline {
  id: string; // LookItem id
  box: Box; // SAM-refined box
  /** SVG path data in source pixel coordinates (closed contour(s) of the SAM mask). */
  path: string | null;
}

export interface CitedDeadline {
  dueDate: string; // YYYY-MM-DD, Europe/Warsaw
  startDate: string; // the date counting starts from (delivery / deemed delivery / letter date)
  steps: string[];
  rule: string; // "KPA art. 57 §1, §4"
  citations: Array<{ label: string; url: string; quote: string }>;
}

/** NDJSON events streamed by POST /api/look, one JSON object per line. */
export type LookEvent =
  | { type: "stage"; stage: "reading" | "outlining" | "done" }
  | { type: "read"; read: LookRead; ms: number }
  | { type: "outline"; outline: LookOutline }
  | { type: "outlines_done"; ms: number; count: number }
  | { type: "error"; error: string; code?: string; retryable: boolean };

/** POST /api/look/commit: the user confirmed what we read; write it to the case. */
export const commitRequestSchema = z.object({
  lookId: z.string().regex(/^lk_[A-Za-z0-9]{8,40}$/),
  /** How the letter reached the user (letters only). */
  delivery: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("delivered"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      z.object({ kind: z.literal("notice"), firstNoticeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      z.object({ kind: z.literal("electronic"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    ])
    .optional(),
  /** User corrections to facts we read (fact key -> corrected value). */
  corrections: z.record(z.string().max(40), z.string().trim().min(1).max(300)).optional(),
});
export type CommitRequest = z.infer<typeof commitRequestSchema>;

export interface CommitResult {
  deadline: (CitedDeadline & { id: string }) | null;
  factsWritten: string[];
  documentId: string | null;
  eventId: string | null;
  taskIds: string[];
}
