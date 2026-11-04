import { z } from "zod";
import type { Masker } from "../mask";
import { ARTICLES } from "../legal/articles";
import { computeKpaDeadline } from "../legal/deadlines";
import type { CaseSnapshot, Collection } from "../case/types";
import { LIMITS, type Proposal } from "./types";
import type { ToolDef } from "./transport";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const COLLS = ["documents", "deadlines", "tasks", "events", "appointments"] as const;

const getItemArgs = z.object({ collection: z.enum(COLLS), id: z.string().min(1).max(64) });
const deadlineArgs = z.object({
  start_kind: z.enum(["delivery", "electronic", "letter_date", "notice"]),
  date: isoDate,
  amount: z.number().int().min(1).max(1000),
  unit: z.enum(["days", "weeks", "months"]),
  legal_basis: z.string().max(100).nullish(),
});
const articleArgs = z.object({ act: z.enum(["KPA", "UoC"]), article: z.string().min(1).max(10) });
const taskArgs = z.object({ title: z.string().min(1).max(160), detail: z.string().max(1500), related_deadline_id: z.string().max(64).nullish() });
const addDeadlineArgs = z.object({ title: z.string().min(1).max(160), due_date: isoDate, rationale: z.string().max(1500) });

const fn = (name: string, description: string, parameters: Record<string, unknown>): ToolDef => ({ type: "function", function: { name, description, parameters } });

export const TOOL_DEFS: ToolDef[] = [
  fn("get_case_item", "Read one full case item (documents incl. all extracted fields, deadlines, tasks, events, appointments) by collection and id.", {
    type: "object", properties: { collection: { type: "string", enum: [...COLLS] }, id: { type: "string" } }, required: ["collection", "id"],
  }),
  fn("compute_deadline", "Deterministic KPA deadline engine (art. 44, 57, Polish holidays). Use it for every date; never do date arithmetic yourself.", {
    type: "object",
    properties: {
      start_kind: { type: "string", enum: ["delivery", "electronic", "letter_date", "notice"], description: "notice = first post-office notice (awizo) date" },
      date: { type: "string", description: "YYYY-MM-DD" },
      amount: { type: "integer" }, unit: { type: "string", enum: ["days", "weeks", "months"] },
      legal_basis: { type: ["string", "null"], description: "e.g. art. 64 § 2 KPA" },
    },
    required: ["start_kind", "date", "amount", "unit"],
  }),
  fn("fetch_article", "Verbatim Polish legal text we hold: KPA arts 41, 44, 57, 64; Ustawa o cudzoziemcach (UoC) arts 106f, 108.", {
    type: "object", properties: { act: { type: "string", enum: ["KPA", "UoC"] }, article: { type: "string" } }, required: ["act", "article"],
  }),
  fn("add_task", "Propose a task for the user. It is stored as a proposal the user must accept; it never changes confirmed facts.", {
    type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, related_deadline_id: { type: ["string", "null"] } }, required: ["title", "detail"],
  }),
  fn("add_deadline", "Propose a new deadline (use compute_deadline first). Stored as a proposal the user must accept.", {
    type: "object", properties: { title: { type: "string" }, due_date: { type: "string", description: "YYYY-MM-DD" }, rationale: { type: "string" } }, required: ["title", "due_date", "rationale"],
  }),
];

export interface ToolCtx {
  snapshot: CaseSnapshot;
  masker: Masker;
  proposals: Proposal[];
}

const cut = (s: string) => (s.length > LIMITS.toolResultChars ? `${s.slice(0, LIMITS.toolResultChars)}…[truncated]` : s);
const bad = (m: string) => JSON.stringify({ error: m });

/** Runs one tool call and returns the string the model sees. Never throws; arguments are validated. */
export function runTool(name: string, rawArgs: string, ctx: ToolCtx): string {
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return bad("arguments were not valid JSON");
  }
  try {
    switch (name) {
      case "get_case_item": return getItem(getItemArgs.parse(args), ctx);
      case "compute_deadline": return compute(deadlineArgs.parse(args));
      case "fetch_article": return article(articleArgs.parse(args));
      case "add_task": return addTask(taskArgs.parse(args), ctx);
      case "add_deadline": return addDeadline(addDeadlineArgs.parse(args), ctx);
      default: return bad(`unknown tool ${name}`);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return bad(`invalid arguments: ${e.issues[0]?.path.join(".") || "args"} ${e.issues[0]?.message ?? ""}`.trim());
    return bad(e instanceof Error ? e.message.slice(0, 200) : "tool failed");
  }
}

function getItem(a: z.infer<typeof getItemArgs>, ctx: ToolCtx): string {
  const rows = ctx.snapshot[a.collection as Collection] as Array<{ id: string }>;
  const item = rows.find((r) => r.id === a.id);
  if (!item) return bad(`no ${a.collection} item with id ${a.id}`);
  const rest = { ...(item as Record<string, unknown>) };
  delete rest.fileKey;
  return cut(ctx.masker.mask(JSON.stringify(rest)));
}

function compute(a: z.infer<typeof deadlineArgs>): string {
  const start = a.start_kind === "notice" ? { kind: "notice" as const, firstNoticeDate: a.date } : { kind: a.start_kind, date: a.date };
  const r = computeKpaDeadline({ start, period: { amount: a.amount, unit: a.unit }, legalBasis: a.legal_basis ?? null });
  return cut(JSON.stringify({ dueDate: r.dueDate, startDate: r.startDate, rule: r.rule, steps: r.steps, warnings: r.warnings }));
}

function article(a: z.infer<typeof articleArgs>): string {
  const hit = Object.values(ARTICLES).find((x) => x.act === a.act && x.article.toLowerCase() === a.article.trim().toLowerCase().replace(/^art\.?\s*/, ""));
  if (!hit) return JSON.stringify({ error: "article not held", available: Object.values(ARTICLES).map((x) => `${x.act} ${x.article}`) });
  return cut(JSON.stringify({ act: hit.act, article: hit.article, title: hit.title, textPl: hit.textPl, source: hit.sourceUrl, note: hit.sourceNote }));
}

function propose(p: Proposal, ctx: ToolCtx): string {
  if (ctx.proposals.length >= LIMITS.maxProposals) return bad(`at most ${LIMITS.maxProposals} proposals per review`);
  if (ctx.proposals.some((x) => x.title.toLowerCase() === p.title.toLowerCase())) return bad("a proposal with this title already exists");
  const related = p.relatedDeadlineId && ctx.snapshot.deadlines.some((d) => d.id === p.relatedDeadlineId) ? p.relatedDeadlineId : null;
  ctx.proposals.push({ ...p, relatedDeadlineId: related });
  return JSON.stringify({ ok: true, status: "proposed", note: "Stored as a proposal for the user to accept; nothing confirmed was changed." });
}

const addTask = (a: z.infer<typeof taskArgs>, ctx: ToolCtx) =>
  propose({ kind: "task", title: ctx.masker.restoreDeep(a.title), detail: ctx.masker.restoreDeep(a.detail), dueDate: null, relatedDeadlineId: a.related_deadline_id ?? null }, ctx);
const addDeadline = (a: z.infer<typeof addDeadlineArgs>, ctx: ToolCtx) =>
  propose({ kind: "deadline", title: ctx.masker.restoreDeep(a.title), detail: ctx.masker.restoreDeep(a.rationale), dueDate: a.due_date, relatedDeadlineId: null }, ctx);
