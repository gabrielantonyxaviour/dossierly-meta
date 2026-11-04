import { z } from "zod";
import { caseClient } from "../case/client";
import { nextStep } from "../case/next-step";
import type { CaseSnapshot } from "../case/types";
import { detectIdentifiers } from "../mask/patterns";
import type { ToolDef } from "./types";

const NO_ADVICE = "Guidance only, not legal advice. Dossierly never submits anything to a government system.";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Blanks phone numbers inside free text (extracted fields can echo letterhead numbers). */
function scrub(s: string): string {
  let out = s;
  for (const sp of detectIdentifiers(s).filter((x) => x.type === "PHONE").sort((a, b) => b.start - a.start)) out = `${out.slice(0, sp.start)}[phone removed]${out.slice(sp.end)}`;
  return out;
}

/** The agent-safe view of a case: no file keys or bytes, no phone numbers. */
export function publicCase(c: CaseSnapshot, now: Date) {
  const step = nextStep(c, now);
  return {
    profile: {
      fullName: c.profile.fullName, preferredLanguage: c.profile.preferredLanguage, city: c.profile.city,
      permitType: c.profile.permitType, stage: c.profile.stage, organisation: c.profile.organisation, arrivalDate: c.profile.arrivalDate, timezone: c.profile.timezone,
    },
    facts: Object.fromEntries(Object.entries(c.facts).map(([k, f]) => [k, { value: scrub(f.value), source: f.source, confirmedByUser: f.confirmedByUser }])),
    openDeadlines: c.deadlines.filter((d) => d.status === "open").map((d) => ({
      id: d.id, title: d.title, dueDate: d.dueDate, rule: d.computation.rule, computationSteps: d.computation.steps, citation: d.computation.legalRefUrl,
    })),
    appointments: c.appointments.map((a) => ({ id: a.id, title: a.title, at: a.at, location: a.location, purpose: a.purpose })),
    openTasks: c.tasks.filter((t) => t.status === "open").map((t) => ({ id: t.id, title: t.title, detail: scrub(t.detail), dueDeadlineId: t.dueDeadlineId, origin: t.origin })),
    documents: c.documents.map((d) => ({
      id: d.id, kind: d.kind, title: d.title, status: d.status, pages: d.pages, source: d.source, hasFile: d.fileKey !== null,
      extractedFields: Object.fromEntries(Object.entries(d.extractedFields).map(([k, v]) => [k, scrub(v)])),
    })),
    nextStep: step,
    note: NO_ADVICE,
  };
}

const getCase: ToolDef = {
  name: "get_case",
  title: "Get case snapshot",
  description: "Compact snapshot of the user's Polish residence case: profile, facts with their sources, open deadlines (with computation steps and citation), appointments, open tasks and document metadata. Never returns file contents or phone numbers.",
  scope: "read",
  input: z.object({}).strict(),
  async run(_a, ctx) {
    return publicCase(await caseClient(ctx.principal.caseUserId).snapshot(), ctx.deps.now?.() ?? new Date());
  },
};

const next: ToolDef = {
  name: "next_step",
  title: "Next step",
  description: "The single most urgent open item in the case (overdue deadlines first, then dated items, tasks, missing documents), with days left and why.",
  scope: "read",
  input: z.object({}).strict(),
  async run(_a, ctx) {
    const step = nextStep(await caseClient(ctx.principal.caseUserId).snapshot(), ctx.deps.now?.() ?? new Date());
    return { nextStep: step, note: NO_ADVICE };
  },
};

const addTask: ToolDef = {
  name: "add_task",
  title: "Add task",
  description: "Add a to-do to the user's case. Writes to the case; requires an act-scope token.",
  scope: "act",
  input: z.object({
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().max(2000).optional(),
    dueDeadlineId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  }),
  async run(a: { title: string; detail?: string; dueDeadlineId?: string }, ctx) {
    const task = await caseClient(ctx.principal.caseUserId).create("tasks", {
      title: a.title, detail: a.detail ?? "", dueDeadlineId: a.dueDeadlineId ?? null, origin: "agent", status: "open",
    });
    return { task: { id: task.id, title: task.title, detail: task.detail, dueDeadlineId: task.dueDeadlineId, status: task.status } };
  },
};

const addDeadline: ToolDef = {
  name: "add_deadline",
  title: "Add deadline",
  description: "Add a deadline to the user's case. Prefer passing the steps and rule from compute_deadline so the case shows how the date was reached. Requires an act-scope token.",
  scope: "act",
  input: z.object({
    title: z.string().trim().min(1).max(200),
    dueDate: isoDate,
    steps: z.array(z.string().trim().min(1).max(400)).max(20).optional(),
    rule: z.string().trim().max(200).optional(),
    citationUrl: z.string().url().max(400).optional(),
  }),
  async run(a: { title: string; dueDate: string; steps?: string[]; rule?: string; citationUrl?: string }, ctx) {
    const d = await caseClient(ctx.principal.caseUserId).create("deadlines", {
      title: a.title, dueDate: a.dueDate, status: "open",
      computation: { steps: a.steps ?? [], rule: a.rule ?? null, legalRefUrl: a.citationUrl ?? null },
    });
    return { deadline: { id: d.id, title: d.title, dueDate: d.dueDate, status: d.status } };
  },
};

export const caseTools: ToolDef[] = [getCase, next, addTask, addDeadline];
