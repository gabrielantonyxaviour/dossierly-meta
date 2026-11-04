/*
 * Writes a confirmed look into the case. Every id derives from the lookId, so committing twice (a retry, or a
 * corrected delivery date) updates the same rows instead of duplicating them.
 */
import { caseClient, CaseClientError, type CaseClient } from "../case/client";
import { FACT_KEYS } from "../case/types";
import { computeKpaDeadline, DeadlineInputError, type DeadlineInput, type DeadlineStart } from "../legal/deadlines";
import type { Env } from "../server/env";
import { ApiError } from "../server/http";
import { loadLook, type LookRecord } from "./store";
import type { CitedDeadline, CommitRequest, CommitResult } from "./types";

const FACT_SET = new Set<string>(FACT_KEYS);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Creates the item; an existing one (409) is patched instead, so re-commits converge. */
async function upsert<K extends "documents" | "deadlines" | "tasks" | "events" | "appointments">(c: CaseClient, kind: K, id: string, input: Record<string, unknown>, patch: Record<string, unknown> | null) {
  try {
    await c.create(kind, { id, ...input });
  } catch (e) {
    if (!(e instanceof CaseClientError) || e.status !== 409) throw e;
    if (patch) await c.patch(kind, id, patch);
  }
}

function applyCorrections(rec: LookRecord, corrections: CommitRequest["corrections"]): { facts: Record<string, string>; dateOnLetter: string | null } {
  const facts: Record<string, string> = { ...rec.read.facts } as Record<string, string>;
  let dateOnLetter = rec.read.letter?.dateOnLetter ?? null;
  for (const [key, value] of Object.entries(corrections ?? {})) {
    if (key === "dateOnLetter") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, "dateOnLetter must be YYYY-MM-DD", "invalid_correction");
      dateOnLetter = value;
    } else if (FACT_SET.has(key)) {
      facts[key] = value;
    } else {
      throw new ApiError(400, `Cannot correct "${key}"`, "invalid_correction");
    }
  }
  return { facts, dateOnLetter };
}

/** Wall-clock time in Warsaw → ISO UTC (handles CET/CEST via the zone's own offset on that day). */
export function warsawToUtc(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const shown = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(guess);
  const [h, m] = shown.split(":").map(Number);
  const [th, tm] = time.split(":").map(Number);
  const diff = (h * 60 + m - (th * 60 + tm) + 1440) % 1440;
  return new Date(guess.getTime() - (diff > 720 ? diff - 1440 : diff) * 60_000).toISOString();
}

function startFor(rec: LookRecord, delivery: CommitRequest["delivery"], dateOnLetter: string | null): DeadlineStart | null {
  const rule = rec.read.letter?.deadlineRule;
  if (rule?.from === "letter_date") return dateOnLetter ? { kind: "letter_date", date: dateOnLetter } : null;
  if (!delivery) return null;
  if (delivery.kind === "notice") return { kind: "notice", firstNoticeDate: delivery.firstNoticeDate };
  return { kind: delivery.kind === "delivered" ? "delivery" : "electronic", date: delivery.date };
}

export async function commitLook(env: Env, userId: string, req: CommitRequest): Promise<CommitResult> {
  const rec = await loadLook(env, userId, req.lookId);
  if (!rec) throw new ApiError(404, "Look not found", "not_found");
  const { read, imageKey } = rec;
  const c = caseClient(userId);
  const { facts, dateOnLetter } = applyCorrections(rec, req.corrections);
  const isLetter = read.kind === "letter" || read.kind === "decision";
  const letter = isLetter ? read.letter : null;
  const result: CommitResult = { deadline: null, factsWritten: [], documentId: null, eventId: null, taskIds: [] };

  // Computing first: a bad delivery date must fail before anything is written.
  let computed: (CitedDeadline & { warnings: string[] }) | null = null;
  const start = letter ? startFor(rec, req.delivery, dateOnLetter) : null;
  if (letter && start && letter.deadlineRule.amount && letter.deadlineRule.unit) {
    const input: DeadlineInput = {
      start,
      period: { amount: letter.deadlineRule.amount, unit: letter.deadlineRule.unit },
      quote: letter.deadlineRule.quote || undefined,
      legalBasis: letter.legalBasis,
    };
    try {
      computed = computeKpaDeadline(input);
    } catch (e) {
      if (e instanceof DeadlineInputError) throw new ApiError(400, e.message, "invalid_delivery");
      throw e;
    }
  }

  const source = { type: isLetter ? "letter" : "screenshot", ref: rec.lookId } as const;
  const patch = Object.fromEntries(Object.entries(facts).filter(([, v]) => v).map(([k, v]) => [k, { value: clip(v, 300), source, confirmedByUser: true }]));
  if (Object.keys(patch).length) {
    await c.patchFacts(patch);
    result.factsWritten = Object.keys(patch);
  }

  const caseNumber = facts.caseNumber ?? read.items.find((i) => i.role === "case_number")?.text ?? null;
  const docKind = isLetter ? "letter" : read.kind === "upo" ? "upo" : null;
  if (docKind) {
    const fields: Record<string, string | null | undefined> = {
      caseNumber, dateOnLetter, office: facts.office, legalBasis: letter?.legalBasis,
      deadlineQuote: letter?.deadlineRule.quote, requested: letter?.asks.join("; "), filedAt: facts.filedAt,
    };
    const extractedFields = Object.fromEntries(Object.entries(fields).flatMap(([k, v]) => (v ? [[k, clip(v, 1000)]] : [])));
    const title = clip(caseNumber ? `${read.title} (${caseNumber})` : read.title, 200);
    const id = `doc_${rec.lookId}`;
    await upsert(c, "documents", id, { kind: docKind, title, status: "have", fileKey: imageKey, pages: 1, extractedFields, source: "scan" }, { title, extractedFields, fileKey: imageKey });
    result.documentId = id;
  }

  if (computed) {
    const n = letter?.asks.length ?? 0;
    const what = n === 1 ? "Send the missing document" : n > 1 ? `Send the ${n} missing documents` : "Reply to the office";
    const title = clip(caseNumber ? `${what} (${caseNumber})` : what, 200);
    const steps = [...computed.steps, ...computed.warnings.map((w) => `Check: ${w}`)].map((s) => clip(s, 400)).slice(0, 20);
    const computation = { steps, rule: clip(computed.rule, 200), legalRefUrl: computed.citations[0]?.url ?? null };
    const id = `ddl_${rec.lookId}`;
    await upsert(c, "deadlines", id, { title, dueDate: computed.dueDate, computation, triggeredBy: result.documentId, status: "open" }, { title, dueDate: computed.dueDate, computation, triggeredBy: result.documentId });
    result.deadline = { id, dueDate: computed.dueDate, startDate: computed.startDate, steps, rule: computed.rule, citations: computed.citations };
  }

  for (const [i, ask] of (letter?.asks ?? []).entries()) {
    const id = `tsk_${rec.lookId}_${i + 1}`;
    const local = letter?.asksLocal[i];
    await upsert(c, "tasks", id, { title: clip(ask, 200), detail: local ? `As written in the letter: ${local}` : "", dueDeadlineId: result.deadline?.id ?? null, origin: "letter", status: "open" }, result.deadline ? { dueDeadlineId: result.deadline.id } : null);
    result.taskIds.push(id);
  }

  const appt = letter?.appointment;
  if (appt) {
    const id = `apt_${rec.lookId}`;
    const at = warsawToUtc(appt.date, appt.time ?? "09:00");
    const [name, ...rest] = (appt.place ?? "Place as given in the letter").split(",");
    const input = { title: clip(appt.purpose ?? read.title, 200), at, location: { name: clip(name, 160) || "Office", address: clip(rest.join(",").trim(), 300) }, purpose: clip(caseNumber ? `${read.title} (${caseNumber})${appt.time ? "" : ". Time not stated in the letter."}` : read.title, 500) };
    await upsert(c, "appointments", id, input, input);
    result.appointmentId = id;
  }

  const bits = [read.title, caseNumber ? `case ${caseNumber}` : null, letter?.asks.length ? `${letter.asks.length} item${letter.asks.length === 1 ? "" : "s"} requested` : null, result.deadline ? `due ${result.deadline.dueDate}` : null];
  const summary = clip(`${isLetter ? "Read a letter" : "Looked at a screen"}: ${bits.filter(Boolean).join(", ")}`, 600);
  const eventId = `evt_${rec.lookId}`;
  const refs = [result.documentId, result.deadline?.id].filter((x): x is string => !!x);
  await upsert(c, "events", eventId, { type: isLetter ? "letter_read" : "note", summary, refs }, { summary, refs });
  result.eventId = eventId;
  return result;
}
