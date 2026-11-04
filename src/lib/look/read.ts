import { z } from "zod";
import { FACT_KEYS } from "../case/types";
import { maskerFor } from "../mask";
import { runModel } from "../model";
import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import { matchLines, unionBox, type GroundedLine } from "./match";
import { LINES_SYSTEM, READ_JSON_SCHEMA, READ_SYSTEM } from "./read-prompt";
import { ITEM_ROLES, LOOK_KINDS, type Box, type ItemRole, type LookItem, type LookKind, type LookRead, type LookRequest } from "./types";

const nstr = z.string().nullish().transform((v) => (v == null ? null : v));
const rawBox = z.object({ x_min: z.number(), y_min: z.number(), x_max: z.number(), y_max: z.number() });

const RawItem = z.object({
  id: z.string().optional(),
  role: z.string().optional(),
  label: z.string().optional(),
  text: z.string().optional(),
  meaning: z.string().optional(),
  value: nstr.optional(),
});
/** The grounding call: every line of text with its box on the 0-1000 grid. */
export const RawLines = z.object({ lines: z.array(z.object({ n: z.number().optional(), text: z.string().optional(), bbox: rawBox })) });
export type RawLines = z.infer<typeof RawLines>;

/** What Spark returns; lenient on purpose, normalised in `toLookRead`. */
export const RawRead = z.object({
  kind: z.string().optional(),
  readable: z.boolean().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  actions: z.array(z.string()).optional(),
  items: z.array(RawItem).optional(),
  facts: z.record(z.string(), z.unknown()).nullish(),
  letter: z
    .object({
      dateOnLetter: nstr.optional(),
      asks: z.array(z.string()).optional(),
      asksLocal: z.array(z.string()).optional(),
      deadlineRule: z
        .object({ amount: z.number().nullish(), unit: nstr.optional(), from: nstr.optional(), quote: z.string().optional() })
        .optional(),
      legalBasis: nstr.optional(),
    })
    .nullish(),
  uncertain: z.array(z.string()).optional(),
});
export type RawRead = z.infer<typeof RawRead>;

const MAX_ITEMS = 8;
const MAX_FIELD_ITEMS = 12; // a MOS screen has many fields; every other kind keeps to 8
const clamp1000 = (n: number) => Math.max(0, Math.min(1000, Math.round(n)));
const isKind = (s: unknown): s is LookKind => (LOOK_KINDS as readonly string[]).includes(s as string);
const isRole = (s: unknown): s is ItemRole => (ITEM_ROLES as readonly string[]).includes(s as string);
const isoDate = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) && !Number.isNaN(Date.parse(`${s.trim()}T00:00:00Z`)) ? s.trim() : null);

/** 0-1000 grid to source pixels; null when the box is degenerate (under ~0.5% on a side). */
export function gridBoxToPx(b: { x_min: number; y_min: number; x_max: number; y_max: number }, size: { w: number; h: number }): Box | null {
  let [x1, y1, x2, y2] = [clamp1000(b.x_min), clamp1000(b.y_min), clamp1000(b.x_max), clamp1000(b.y_max)];
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];
  if (x2 - x1 < 5 || y2 - y1 < 5) return null;
  const px = (v: number, n: number) => Math.round((v / 1000) * n);
  return [px(x1, size.w), px(y1, size.h), Math.min(size.w, px(x2, size.w)), Math.min(size.h, px(y2, size.h))];
}

const OUT_CAP = 600;
// Spark occasionally slips a stray CJK glyph into English prose; the output languages here are English and Polish.
const CJK = /[\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]/g;
const clip = (s: string | undefined, n = OUT_CAP) => (s ?? "").replace(CJK, "").trim().slice(0, n);

/** Lines from the grounding call, in reading order, as source-pixel boxes. Degenerate boxes are dropped. */
export function groundedLines(raw: RawLines | null, size: { w: number; h: number }): GroundedLine[] {
  const out: GroundedLine[] = [];
  for (const [i, l] of (raw?.lines ?? []).entries()) {
    const box = gridBoxToPx(l.bbox, size);
    if (box) out.push({ n: l.n ?? i + 1, text: (l.text ?? "").replace(CJK, "").trim(), box });
  }
  return out.sort((x, y) => x.n - y.n);
}

/** Box for an item: the grounded lines carrying its text; a form field also takes the empty input line after its label. */
function boxFor(role: ItemRole, text: string, lines: GroundedLine[]): Box | null {
  const run = matchLines(text, lines);
  if (!run) return null;
  const used = [...run];
  if (role === "field") {
    // The input sits just under its label, overlapping it horizontally; its text is empty or a placeholder.
    const label = unionBox(run.map((r) => r.box));
    const h = label[3] - label[1];
    const input = lines
      .filter((l) => !run.includes(l) && l.box[1] >= label[3] - 4 && l.box[1] <= label[3] + Math.max(2.5 * h, 12))
      .filter((l) => Math.min(l.box[2], label[2]) - Math.max(l.box[0], label[0]) >= 0.5 * (label[2] - label[0]))
      .sort((a, b) => a.box[1] - b.box[1])[0];
    if (input) used.push(input);
  }
  return unionBox(used.map((u) => u.box));
}

/** Dates read from a document come as 18.09.2026 [14:07]; the case stores a bare ISO day. */
function isoDay(v: string): string {
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\b/.exec(v.trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v.trim();
}

/** Normalise Spark's reply into the Look contract: clamp and scale boxes, drop bad items, keep only known keys. */
export function toLookRead(raw: RawRead, lines: GroundedLine[], hint?: LookKind): Omit<LookRead, "lookId"> {
  const kind: LookKind = isKind(raw.kind) ? raw.kind : hint ?? "other";
  const readable = raw.readable !== false;
  const idMap = new Map<string, string>();
  const items: LookItem[] = [];
  for (const it of readable ? raw.items ?? [] : []) {
    if (items.length >= (kind === "mos_screen" ? MAX_FIELD_ITEMS : MAX_ITEMS)) continue;
    const role = isRole(it.role) ? it.role : "other";
    const text = clip(it.text);
    const box = text ? boxFor(role, text, lines) : null;
    if (!box) continue;
    const id = `i${items.length + 1}`;
    if (it.id) idMap.set(it.id, id);
    const item: LookItem = { id, role, label: clip(it.label, 60) || "Item", text, meaning: clip(it.meaning, 400), box };
    if (kind === "mos_screen" || it.value) item.value = it.value && it.value.trim() ? it.value.trim().slice(0, 300) : null;
    items.push(item);
  }
  const facts: LookRead["facts"] = {};
  for (const k of FACT_KEYS) {
    const v = raw.facts?.[k];
    if (typeof v === "string" && v.trim()) facts[k] = (k === "filedAt" || k === "upoReceivedAt" ? isoDay(v) : v.trim()).slice(0, 300);
  }
  const l = raw.letter;
  const dr = l?.deadlineRule;
  const unit = dr?.unit === "days" || dr?.unit === "weeks" || dr?.unit === "months" ? dr.unit : null;
  const amount = typeof dr?.amount === "number" && dr.amount > 0 && dr.amount < 1000 ? Math.round(dr.amount) : null;
  const letter: LookRead["letter"] =
    (kind === "letter" || kind === "decision") && l
      ? {
          dateOnLetter: isoDate(l.dateOnLetter),
          asks: (l.asks ?? []).map((s) => clip(s, 300)).filter(Boolean).slice(0, 12),
          asksLocal: (l.asksLocal ?? []).map((s) => clip(s, 300)).filter(Boolean).slice(0, 12),
          deadlineRule: {
            amount: amount && unit ? amount : null,
            unit: amount && unit ? unit : null,
            from: dr?.from === "delivery" || dr?.from === "letter_date" ? dr.from : null,
            quote: clip(dr?.quote, 500),
          },
          legalBasis: l.legalBasis?.trim().slice(0, 120) || null,
        }
      : null;
  // Item ids are renumbered when items are dropped: remap the ones that survived, discard the ones that did not.
  const uncertain = [...new Set((raw.uncertain ?? []).map((u) => u.trim()).filter((u) => u && (idMap.has(u) || !/^i\d+$/.test(u))).map((u) => idMap.get(u) ?? u))].slice(0, 20);
  return {
    kind,
    title: clip(raw.title, 140) || (readable ? "Document" : "Could not read this image"),
    summary: clip(raw.summary, 800),
    actions: (raw.actions ?? []).map((a) => clip(a, 240)).filter(Boolean).slice(0, 5),
    items,
    facts,
    letter,
    uncertain,
    readable,
  };
}

const unreadableFixture = (): RawRead => ({
  kind: "other",
  readable: false,
  title: "Could not read this image",
  summary: "The model service is not connected, so this image could not be read. Try again in a moment.",
});

const noLines = (): RawLines => ({ lines: [] });

/**
 * Two Spark 1.3 vision calls in parallel on the same image: a grounding call (every line of text with its box on
 * the 0-1000 grid, the only formulation that localises well, see match.ts) and a reading call (classify, explain,
 * pick the important items by verbatim text). Items take their boxes from the lines that carry their text; items
 * that cannot be placed are dropped rather than drawn in the wrong place. Metering and run records come from
 * runModel (task "read"). A failed grounding call degrades to a read without items; a failed reading call throws.
 */
export async function readLook(
  env: Env,
  userId: string | null,
  req: LookRequest,
  caseCtx: string,
  opts: { fullName?: string | null; effort?: "low" | "medium" | "high"; groundEffort?: "low" | "medium" | "high"; client?: ChatClient } = {},
): Promise<Omit<LookRead, "lookId">> {
  const size = { w: req.width, h: req.height };
  const masker = () => maskerFor({ name: opts.fullName ?? undefined });
  // The masked case context would hide the name as one token; a form needs given name and surname apart.
  const parts = (opts.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const ctx = parts.length > 1 ? `${caseCtx}\nName parts for form fields: given name ${parts[0]}, surname ${parts.slice(1).join(" ")}` : caseCtx;
  const grounding = runModel(
    { env, userId, client: opts.client },
    {
      task: "read",
      system: LINES_SYSTEM,
      input: "Transcribe every line with its box.",
      images: [req.image],
      schema: RawLines,
      maxTokens: 9000,
      effort: opts.groundEffort ?? "medium",
      masker: masker(),
      replay: noLines,
    },
  ).then((o) => groundedLines(o.data, size), () => [] as GroundedLine[]);
  const input = [
    `Image size: ${req.width}x${req.height} pixels.`,
    req.hint ? `The user says this is: ${req.hint}.` : "",
    req.question ? `The user asks: ${req.question}` : "",
    "Read the image, classify it, and fill the schema.",
  ].filter(Boolean).join("\n");
  const reading = runModel(
    { env, userId, client: opts.client },
    {
      task: "read",
      system: READ_SYSTEM,
      context: ctx,
      input,
      images: [req.image],
      schema: RawRead,
      maxTokens: 6000,
      effort: opts.effort ?? "low",
      masker: masker(),
      replay: unreadableFixture,
      json: READ_JSON_SCHEMA,
    },
  );
  const [lines, out] = await Promise.all([grounding, reading]);
  return toLookRead(out.data, lines, req.hint);
}
