import { z } from "zod";
import { caseClient } from "../case/client";
import { caseContext } from "../case/context";
import { interpret } from "../features/interpret";
import { computeKpaDeadline } from "../legal/deadlines";
import { commitLook } from "../look/commit";
import { outlineItems } from "../look/outline";
import { readLook } from "../look/read";
import { decodeImage, newLookId, saveLook } from "../look/store";
import type { LookRead } from "../look/types";
import { LANGUAGES, type Language } from "../schemas";
import { loadImage } from "./image";
import { McpToolError, type ToolDef } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const readLetter: ToolDef = {
  name: "read_letter",
  title: "Read a letter or screen",
  description:
    "Read a photo of an official letter, decision, UPO or MOS/INPOL screen. Muse Spark grounds every important item with a bounding box, SAM 3.1 refines the boxes into outlines, and the fields are extracted (case number, office, what the letter asks, the deadline sentence). Optionally computes the KPA due date, and with save_to_case writes document, facts, deadline and tasks into the case (act scope). Nothing is submitted anywhere.",
  scope: "read",
  usesModel: true,
  input: z.object({
    imageUrl: z.string().url().max(2000).optional().describe("https URL of a JPEG/PNG/WebP, max ~4 MB."),
    imageBase64: z.string().max(7_000_000).optional().describe("Base64 (or data URL) of a JPEG/PNG/WebP, max ~4 MB."),
    hint: z.enum(["letter", "decision", "mos_screen", "upo", "inpol_status", "kiosk", "other"]).optional(),
    question: z.string().trim().max(300).optional(),
    deliveredOn: isoDate.optional().describe("The day the letter was delivered; lets the tool compute the due date."),
    save_to_case: z.boolean().default(false).describe("Write what was read into the case. Needs an act-scope token."),
  }),
  async run(a: { imageUrl?: string; imageBase64?: string; hint?: LookRead["kind"]; question?: string; deliveredOn?: string; save_to_case: boolean }, ctx) {
    if (a.save_to_case && ctx.principal.scope !== "act") throw new McpToolError("save_to_case needs an act-scope token.", "insufficient_scope");
    const img = await loadImage(a, ctx.deps);
    const { accountId, caseUserId } = ctx.principal;
    const snapshot = await caseClient(caseUserId).snapshot();
    const req = { image: img.dataUrl, width: img.width, height: img.height, hint: a.hint, question: a.question };
    const base = await readLook(ctx.env, accountId, req, caseContext(snapshot), { fullName: snapshot.profile.fullName, client: ctx.deps.client });
    const read: LookRead = { lookId: newLookId(), ...base };
    const out = await outlineItems(ctx.env, accountId, img.dataUrl, { w: img.width, h: img.height }, read.items, { fetch: ctx.deps.fetch });
    const outline = new Map(out.outlines.map((o) => [o.id, o]));

    const rule = read.letter?.deadlineRule;
    let deadline: unknown = null;
    if (a.deliveredOn && rule?.amount && rule.unit) {
      const start = rule.from === "letter_date" && read.letter?.dateOnLetter ? { kind: "letter_date" as const, date: read.letter.dateOnLetter } : { kind: "delivery" as const, date: a.deliveredOn };
      try {
        deadline = computeKpaDeadline({ start, period: { amount: rule.amount, unit: rule.unit }, quote: rule.quote || undefined, legalBasis: read.letter?.legalBasis });
      } catch {
        deadline = null;
      }
    }

    let saved: unknown = null;
    if (a.save_to_case) {
      const { bytes, mime } = decodeImage(img.dataUrl);
      await saveLook(ctx.env, { userId: caseUserId, req: { ...req, image: img.dataUrl }, read, bytes, mime });
      saved = await commitLook(ctx.env, caseUserId, { lookId: read.lookId, delivery: a.deliveredOn ? { kind: "delivered", date: a.deliveredOn } : undefined });
    }
    return {
      lookId: read.lookId, kind: read.kind, readable: read.readable, title: read.title, summary: read.summary, actions: read.actions,
      imageSize: { width: img.width, height: img.height },
      items: read.items.map((i) => ({ id: i.id, role: i.role, label: i.label, text: i.text, meaning: i.meaning, value: i.value ?? null, box: i.box, outline: outline.get(i.id) ?? null })),
      outlineSource: out.source,
      facts: read.facts, letter: read.letter, uncertain: read.uncertain,
      computedDeadline: deadline, saved,
      note: "Boxes are [x1,y1,x2,y2] in source image pixels. Guidance only, not legal advice; confirm dates with the office.",
    };
  },
};

const PAIR_LANGS = ["pl", ...LANGUAGES] as const;
const interpretTool: ToolDef = {
  name: "interpret",
  title: "Interpret",
  description:
    "Faithful translation between Polish and one of en, uk, ru, hi, ta, zh, ja, vi, by Muse Spark 1.2 with office-term glossaries and a guard that refuses to turn interpretation into legal advice. The user's name from the case is masked before it reaches the model. One side must be 'pl'.",
  scope: "read",
  usesModel: true,
  input: z.object({
    text: z.string().trim().min(1).max(1500),
    from: z.enum(PAIR_LANGS),
    to: z.enum(PAIR_LANGS),
  }),
  async run(a: { text: string; from: (typeof PAIR_LANGS)[number]; to: (typeof PAIR_LANGS)[number] }, ctx) {
    if ((a.from === "pl") === (a.to === "pl")) throw new McpToolError("Exactly one of from/to must be 'pl' (Polish). Other pairs are not supported yet.", "unsupported_pair");
    const language = (a.from === "pl" ? a.to : a.from) as Language;
    const snapshot = await caseClient(ctx.principal.caseUserId).snapshot();
    const r = await interpret(
      { env: ctx.env, userId: ctx.principal.accountId, client: ctx.deps.client },
      { speaker: a.from === "pl" ? "official" : "user", text: a.text, language, recent: [], profile: { name: snapshot.profile.fullName ?? undefined, addresses: [] } },
    );
    return { translation: r.translation, from: a.from, to: a.to, adviceNotice: r.adviceNotice, maskedItems: r.masked };
  },
};

export const aiTools: ToolDef[] = [readLetter, interpretTool];
