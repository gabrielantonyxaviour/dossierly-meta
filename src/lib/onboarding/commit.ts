import { z } from "zod";
import { caseClient, CaseClientError, type CaseClient } from "../case/client";
import { ApiError } from "../server/http";
import { calendars, createEvent } from "../server/connections/calendar";
import { importGmail } from "../server/connections/mail";
import { owned, rowFor } from "../server/connections/store";
import type { ConnectionsEnv } from "../server/connections/types";
import { sha256Hex } from "../server/util";
import { findingSchema, KPA_URL, type Finding } from "./findings";
import { mergeDocuments } from "./merge";
import { warsawIso } from "./time";

export const commitSchema = z.object({
  findings: z.array(findingSchema).max(80),
  summaries: z.array(z.object({ messageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), summary: z.string().trim().max(600), receivedAt: z.string().datetime({ offset: true }) })).max(20),
  addToCalendar: z.boolean(),
  /** The separate calendar step: only add these dated findings to Google Calendar (they are already in the case). */
  calendarOnly: z.boolean().optional(),
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
  if (input.calendarOnly) {
    const dated = input.findings.filter((f) => f.kind === "deadline" || f.kind === "appointment");
    const calendar = dated.length ? await addToCalendar(env, ids, dated) : [];
    await noteCalendar(c, calendar);
    return { saved: 0, calendar };
  }
  const snap = await c.snapshot();
  const profile = snap.profile;
  const held = new Set(snap.documents.filter((d) => d.status === "have").map((d) => d.id));
  const calls = profile.phone.callsEnabled && profile.phone.verified;
  const facts: Record<string, unknown> = {};
  const byMessage = new Map<string, string[]>();
  const note = (f: Finding) => byMessage.set(f.source.messageId, [...(byMessage.get(f.source.messageId) ?? []), f.id]);
  const deadlineFor = new Map(input.findings.filter((f) => f.kind === "deadline").map((f) => [f.source.messageId, f.id]));
  // Tasks first so appointments can point at them.
  for (const f of input.findings) {
    if (f.kind === "fact") facts[f.key] = { value: f.value, source: { type: "email", ref: f.source.messageId }, confirmedByUser: true };
    if (f.kind === "task") await upsert(c, "tasks", { id: f.id, title: f.title, detail: f.detail, origin: "email", dueDeadlineId: null, status: "open" });
    if (f.kind !== "document") note(f);
  }
  for (const merged of mergeDocuments(input.findings)) {
    // Asked for again but already in the case: it stays "have" (the request is noted on it).
    const f = merged.status === "missing" && held.has(merged.id) ? { ...merged, status: "have" as const, file: null } : merged;
    const fileKey = f.file && f.status === "have" ? await storeAttachment(env, ids, f) : null;
    const extractedFields: Record<string, string> = { fromEmail: f.source.subject.slice(0, 200), ...f.fields, ...(fileKey && f.file ? { file: f.file.name } : {}) };
    await upsert(c, "documents", { id: f.id, kind: f.docKind, title: f.title, status: f.status, source: "email", extractedFields, ...(fileKey ? { fileKey } : {}) });
    note(f);
    // Asked for and not found anywhere in the inbox: a task to get it, due with the summons.
    if (f.status === "missing") await upsert(c, "tasks", { id: `get_${f.id.slice(4)}`.slice(0, 64), title: `Get: ${f.title}`.slice(0, 200), detail: `The office asked for this in “${f.source.subject.slice(0, 160)}” and I could not find it in your email.`, origin: "email", dueDeadlineId: deadlineFor.get(f.source.messageId) ?? null, status: "open" });
  }
  for (const f of input.findings) {
    if (f.kind === "deadline") {
      const asked = f.source.subject.slice(0, 160);
      const asks = mergeDocuments(input.findings).filter((x) => x.fields?.requestedBy === asked || (x.source.messageId === f.source.messageId && x.status !== "have")).map((x) => x.title);
      const letterId = await saveLetter(env, ids, c, f, asks);
      note({ ...f, id: letterId });
      const remind = { at: warsawIso(dayBefore(f.dueDate), "09:00"), channel: calls ? "call" : "in_app", sentAt: null };
      await upsert(c, "deadlines", { id: f.id, title: f.title, dueDate: f.dueDate, computation: { steps: f.steps.length ? f.steps : ["Date read from the email."], rule: f.rule || null, legalRefUrl: f.rule.includes("KPA") ? KPA_URL : null }, triggeredBy: letterId, status: "open", reminders: [remind] });
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
  await noteCalendar(c, calendar);
  await inferCity(c, profile, facts);
  return { saved: input.findings.length, calendar };
}

/** On the timeline, so the agent (welcome call, chat) knows the dates are in the person's calendar. */
async function noteCalendar(c: CaseClient, calendar: CalendarResult[]) {
  const added = calendar.filter((x) => x.status !== "failed");
  if (added.length) await upsert(c, "events", { id: `evt_cal_${(await sha256Hex(added.map((x) => x.findingId).join(","))).slice(0, 20)}`, type: "note", at: new Date().toISOString(), summary: `Added to Google Calendar with reminders: ${added.map((x) => x.title).join("; ")}`.slice(0, 600), refs: added.map((x) => x.findingId).slice(0, 20) });
}

const OFFICE_CITY: [RegExp, string][] = [[/mazowieck/i, "Warsaw"], [/małopolsk|malopolsk/i, "Kraków"], [/dolnośląsk|dolnoslask/i, "Wrocław"], [/pomorsk/i, "Gdańsk"], [/wielkopolsk/i, "Poznań"], [/łódzk|lodzk/i, "Łódź"]];
/** Voice setup skips the city question: the voivodeship office on the letters says which city handles the case. */
async function inferCity(c: CaseClient, profile: { city: string | null }, facts: Record<string, unknown>) {
  const office = (facts.office as { value?: string } | undefined)?.value;
  const city = !profile.city && office ? OFFICE_CITY.find(([re]) => re.test(office))?.[1] : undefined;
  if (city) await c.patchProfile({ city });
}

type Ids = { userId: string; accountId: string };
type Attachment = { id: string; name: string; mime: string; size: number };

/** Copies one attachment of an email into the case's private storage. Best effort: null when anything is missing. */
async function storeFile(env: ConnectionsEnv, ids: Ids, messageId: string, docId: string, pick: (a: Attachment[]) => Attachment | undefined): Promise<string | null> {
  try {
    const row = await owned(env, ids.accountId, "mail");
    if (row.provider !== "gmail") return null;
    // Gmail attachment ids are not stable between reads of a message: find the file again in a fresh read.
    const msg = await importGmail(env, row, messageId);
    if (msg.kind !== "message") return null;
    const match = pick(msg.attachments);
    if (!match) return null;
    const got = await importGmail(env, row, messageId, match.id);
    if (got.kind !== "attachment") return null;
    const b64 = got.file.dataUrl.slice(got.file.dataUrl.indexOf(",") + 1);
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const ext = match.mime === "application/pdf" ? "pdf" : match.mime.split("/")[1];
    const key = `case/${ids.userId}/documents/${docId}.${ext}`;
    await env.BLOBS.put(key, bytes);
    return key;
  } catch {
    return null;
  }
}

/** The email attachment that is this document, by name (ids change between reads). */
const storeAttachment = (env: ConnectionsEnv, ids: Ids, f: Extract<Finding, { kind: "document" }>) =>
  f.file ? storeFile(env, ids, f.source.messageId, f.id, (a) => a.find((x) => x.name === f.file?.name && x.mime === f.file?.mime) ?? a.find((x) => x.id === f.file?.attachmentId)) : Promise.resolve(null);

const LETTER_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
/** The letter's own scan: the email's first PDF (else image) under 4 MB. */
const letterFile = (a: Attachment[]) => {
  const ok = a.filter((x) => LETTER_TYPES.includes(x.mime) && x.size <= 4_000_000);
  return ok.find((x) => x.mime === "application/pdf") ?? ok[0];
};
export const letterIdFor = (messageId: string) => `doc_ltr_${messageId}`.slice(0, 64);
const SUMMONS = /wezwani|summons|braków|brakow|art\. ?64/i;

/** The official letter behind a deadline, saved as a case document with its file; the deadline points at it. */
async function saveLetter(env: ConnectionsEnv, ids: Ids, c: CaseClient, d: Extract<Finding, { kind: "deadline" }>, asks: string[]): Promise<string> {
  const id = letterIdFor(d.source.messageId);
  const summons = SUMMONS.test(`${d.source.subject} ${d.rule} ${d.title}`);
  const fileKey = await storeFile(env, ids, d.source.messageId, id, letterFile);
  const extractedFields: Record<string, string> = {
    fromEmail: d.source.subject.slice(0, 200), received: d.source.receivedAt.slice(0, 10), sender: d.source.from.slice(0, 300),
    ...(asks.length ? { asks: asks.join("; ").slice(0, 1000) } : {}),
  };
  await upsert(c, "documents", { id, kind: "letter", title: summons ? "Summons to complete the application" : `Letter: ${d.title}`.slice(0, 200), status: "have", source: "email", extractedFields, ...(fileKey ? { fileKey } : {}) });
  return id;
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
