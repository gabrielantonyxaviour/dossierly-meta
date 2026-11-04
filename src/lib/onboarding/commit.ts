import { z } from "zod";
import { caseClient, CaseClientError, type CaseClient } from "../case/client";
import { ApiError } from "../server/http";
import { calendars, createEvent } from "../server/connections/calendar";
import { owned, rowFor } from "../server/connections/store";
import type { ConnectionsEnv } from "../server/connections/types";
import { sha256Hex } from "../server/util";
import { findingSchema, KPA_URL, type Finding } from "./findings";
import { warsawIso } from "./time";

export const commitSchema = z.object({
  findings: z.array(findingSchema).max(80),
  summaries: z.array(z.object({ messageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), summary: z.string().trim().max(600), receivedAt: z.string().datetime({ offset: true }) })).max(20),
  addToCalendar: z.boolean(),
}).strict();

export type CalendarResult = { findingId: string; title: string; status: "added" | "already" | "failed"; url?: string; error?: string };

/** Create, or update when the item already exists from an earlier save of the same email (idempotent). */
async function upsert(c: CaseClient, kind: "documents" | "deadlines" | "tasks" | "events" | "appointments", item: Record<string, unknown>) {
  try {
    return await c.create(kind, item);
  } catch (e) {
    if (!(e instanceof CaseClientError) || e.status !== 409) throw e;
    const { id, ...patch } = item;
    return c.patch(kind, String(id), patch);
  }
}

/** Deterministic RFC-4122-shaped key so the same finding never creates a second calendar event. */
export async function calendarKey(userId: string, findingId: string): Promise<string> {
  const h = await sha256Hex(`dossierly-onboarding:${userId}:${findingId}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const lines = (...xs: (string | false | undefined | null)[]) => xs.filter(Boolean).join("\n");
const dayBefore = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().slice(0, 10); };

export async function commitFindings(env: ConnectionsEnv, ids: { userId: string; accountId: string }, input: z.infer<typeof commitSchema>) {
  const c = caseClient(ids.userId);
  const profile = (await c.snapshot()).profile;
  const calls = profile.phone.callsEnabled && profile.phone.verified;
  const facts: Record<string, unknown> = {};
  const byMessage = new Map<string, string[]>();
  const note = (f: Finding) => byMessage.set(f.source.messageId, [...(byMessage.get(f.source.messageId) ?? []), f.id]);
  const deadlineFor = new Map(input.findings.filter((f) => f.kind === "deadline").map((f) => [f.source.messageId, f.id]));
  // Tasks first so appointments can point at them.
  for (const f of input.findings) {
    if (f.kind === "fact") facts[f.key] = { value: f.value, source: { type: "email", ref: f.source.messageId }, confirmedByUser: true };
    if (f.kind === "task") await upsert(c, "tasks", { id: f.id, title: f.title, detail: f.detail, origin: "email", dueDeadlineId: null, status: "open" });
    if (f.kind === "document") await upsert(c, "documents", { id: f.id, kind: f.docKind, title: f.title, status: f.status, source: "email", extractedFields: { fromEmail: f.source.subject.slice(0, 200) } });
    note(f);
  }
  for (const f of input.findings) {
    if (f.kind === "deadline") {
      const remind = { at: warsawIso(dayBefore(f.dueDate), "09:00"), channel: calls ? "call" : "in_app", sentAt: null };
      await upsert(c, "deadlines", { id: f.id, title: f.title, dueDate: f.dueDate, computation: { steps: f.steps.length ? f.steps : ["Date read from the email."], rule: f.rule || null, legalRefUrl: f.rule.includes("KPA") ? KPA_URL : null }, triggeredBy: null, status: "open", reminders: [remind] });
    }
    if (f.kind === "appointment") {
      let prep: string[] = [];
      if (f.bring.length) {
        const task = await upsert(c, "tasks", { id: `prp_${f.id.slice(4)}`.slice(0, 64), title: `Prepare for ${f.title}`.slice(0, 200), detail: `Bring: ${f.bring.join("; ")}`.slice(0, 2000), origin: "email", dueDeadlineId: null, status: "open" });
        prep = [task.id];
      }
      await upsert(c, "appointments", { id: f.id, title: f.title, at: warsawIso(f.date, f.time ?? "09:00"), location: { name: f.place || "Office", address: f.address }, purpose: f.purpose, prepTaskIds: prep });
    }
  }
  // Link email tasks to the deadline from the same email so they sort by its date.
  for (const f of input.findings) if (f.kind === "task" && deadlineFor.has(f.source.messageId)) await c.patch("tasks", f.id, { dueDeadlineId: deadlineFor.get(f.source.messageId) });
  if (Object.keys(facts).length) await c.patchFacts(facts);
  for (const s of input.summaries) {
    const refs = (byMessage.get(s.messageId) ?? []).slice(0, 20);
    if (!s.summary) continue;
    await upsert(c, "events", { id: `evt_${s.messageId}`.slice(0, 64), type: "email_received", at: s.receivedAt, summary: s.summary, refs });
  }
  const calendar = input.addToCalendar ? await addToCalendar(env, ids, input.findings) : [];
  return { saved: input.findings.length, calendar };
}

async function addToCalendar(env: ConnectionsEnv, ids: { userId: string; accountId: string }, findings: Finding[]): Promise<CalendarResult[]> {
  const dated = findings.filter((f) => f.kind === "appointment" || f.kind === "deadline");
  if (!dated.length) return [];
  if (!(await rowFor(env, ids.accountId, "calendar"))) throw new ApiError(409, "Connect Google Calendar to add these dates.", "connection_required");
  const row = await owned(env, ids.accountId, "calendar");
  const list = await calendars(env, row);
  const target = list.find((x) => x.primary) ?? list[0];
  if (!target) throw new ApiError(409, "No writable calendar was found in this account.", "calendar_not_found");
  const out: CalendarResult[] = [];
  for (const f of dated) {
    const idempotencyKey = await calendarKey(ids.userId, f.id);
    const input = f.kind === "appointment"
      ? { calendarId: target.id, title: `${f.title}${f.place ? ` · ${f.place}` : ""}`.slice(0, 160), date: f.date, ...(f.time ? { time: f.time, durationMin: 60 } : {}), location: [f.place, f.address].filter(Boolean).join(", ").slice(0, 300) || undefined,
          description: lines(f.purpose, f.bring.length > 0 && `Bring: ${f.bring.join(", ")}`, `From your email “${f.source.subject}”. Added by Dossierly.`).slice(0, 2000), idempotencyKey, reminderMinutes: f.time ? [1440, 120] : [1440] }
      : { calendarId: target.id, title: `Deadline: ${f.title}`.slice(0, 160), date: f.dueDate, idempotencyKey, reminderMinutes: [2 * 1440 + 15 * 60, 15 * 60],
          description: lines(f.quote && `“${f.quote}”`, f.consequence && `If missed: ${f.consequence}`, ...f.steps, `From your email “${f.source.subject}”. Added by Dossierly. This is a calculation, not legal advice.`).slice(0, 2000) };
    try {
      const r = await createEvent(env, ids.accountId, input);
      out.push({ findingId: f.id, title: input.title, status: r.replayed ? "already" : "added", ...(r.event.url ? { url: r.event.url } : {}) });
    } catch (e) {
      out.push({ findingId: f.id, title: input.title, status: "failed", error: e instanceof ApiError ? e.message : "Could not add this event." });
    }
  }
  return out;
}
