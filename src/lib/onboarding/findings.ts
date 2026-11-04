import { z } from "zod";
import { DOC_KINDS, FACT_KEYS } from "../case/types";
import { warsawDate } from "../case/next-step";
import { computeDeadline } from "../features/deadline";
import { LanguageSchema } from "../schemas";
import type { Extraction } from "./extract";
import type { MessageBody } from "./inbox";

/* A finding is one reviewable item read from one email. The user confirms or drops each before it reaches the case. */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const t = (max: number) => z.string().trim().min(1).max(max);
const o = (max: number) => z.string().trim().max(max);
const fid = z.string().regex(/^[a-z]{1,4}_[A-Za-z0-9_-]{4,60}$/);

export const DOC_FIELDS = ["address", "startDate", "applicationAddress", "requestedBy"] as const;
export const sourceSchema = z.object({ messageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), subject: o(300), from: o(300), receivedAt: z.string().datetime({ offset: true }) });
export const findingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fact"), id: fid, key: z.enum(FACT_KEYS), label: t(60), value: t(300), source: sourceSchema }),
  z.object({ kind: z.literal("appointment"), id: fid, title: t(200), date: day, time: z.string().regex(/^\d{2}:\d{2}$/).nullable(), place: o(160), address: o(300), purpose: o(500), bring: z.array(t(160)).max(12), source: sourceSchema }),
  z.object({ kind: z.literal("deadline"), id: fid, title: t(200), dueDate: day, steps: z.array(t(400)).max(20), rule: o(200), quote: o(400), consequence: o(300), source: sourceSchema }),
  z.object({
    kind: z.literal("document"), id: fid, title: t(200), docKind: z.enum(DOC_KINDS), status: z.enum(["have", "missing", "requested"]),
    /** Details read from the email, e.g. { address, startDate } for a lease or { applicationAddress } for the MOS confirmation. */
    fields: z.partialRecord(z.enum(DOC_FIELDS), o(300)).optional(),
    /** The email attachment that IS this document; saved into the case on commit. */
    file: z.object({ attachmentId: z.string().regex(/^[A-Za-z0-9_=.@/-]{1,1024}$/), name: o(160), mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]) }).nullable().optional(),
    source: sourceSchema,
  }),
  z.object({ kind: z.literal("task"), id: fid, title: t(200), detail: o(2000), source: sourceSchema }),
]);
export type Finding = z.infer<typeof findingSchema>;
export type MailReading = { messageId: string; relevant: boolean; category: string; sender: string; summary: string; findings: Finding[] };

/** Kinds the case holds once (one lease, one insurance…), whichever email mentioned them. */
const SINGLE_KINDS = new Set<string>(["passport", "rental_agreement", "health_insurance", "university_certificate", "photo", "upo"]);
export const docIdFor = (kind: string) => `doc_k_${kind}`;

export const FACT_LABELS: Record<(typeof FACT_KEYS)[number], string> = {
  caseNumber: "Case number", office: "Office", filedAt: "Application filed", upoReceivedAt: "UPO received", mosStatus: "MOS status", inpolStatus: "inPOL status",
};
export const KPA_URL = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19600300168";

/** Stable per email + item so re-reading the same email yields the same ids (idempotent commits and calendar writes). */
function stableId(prefix: string, messageId: string, part: string): string {
  let h = 2166136261;
  for (const c of `${messageId}:${part}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${prefix}_${messageId.slice(0, 24)}${h.toString(36)}`;
}

function deadlineFrom(e: NonNullable<Extraction["deadline"]>, received: string, language: string) {
  const lang = LanguageSchema.catch("en").parse(language);
  if (e.days && e.from) {
    const deliveryDate = warsawDate(received);
    const c = computeDeadline({ rule: { days: e.days, from: e.from, quote: e.quote }, deliveryDate, letterDate: e.letterDate, language: lang });
    if (c) {
      const why = e.from === "delivery" ? [`Delivery taken as the day this email arrived (${deliveryDate}); if the letter was delivered on another day, tell me and I will recount.`] : [];
      return { dueDate: c.date, steps: [...why, ...c.steps].slice(0, 20), rule: `${e.days} days from ${e.from === "delivery" ? "delivery" : "the letter date"} (KPA art. 57)` };
    }
  }
  if (e.statedDate) return { dueDate: e.statedDate, steps: [`The email states the date ${e.statedDate} directly.`], rule: "Date stated in the letter" };
  return null;
}

const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
/** The attachment the model named, or the only document-like attachment when it named none. */
function attachmentFor(msg: MessageBody, name: string | null) {
  const files = msg.attachments.filter((a) => (FILE_TYPES as readonly string[]).includes(a.mime) && a.id && a.size <= 4_000_000);
  const hit = (name && files.find((a) => a.name.toLowerCase() === name.toLowerCase())) || (files.length === 1 ? files[0] : null);
  return hit ? { attachmentId: hit.id, name: hit.name.slice(0, 160), mime: hit.mime as (typeof FILE_TYPES)[number] } : null;
}

export function buildFindings(msg: MessageBody, x: Extraction, language: string): MailReading {
  const source = { messageId: msg.id.slice(0, 64), subject: msg.subject.slice(0, 300), from: msg.from.slice(0, 300), receivedAt: msg.receivedAt };
  const out: Finding[] = [];
  if (x.relevant) {
    for (const key of FACT_KEYS) {
      const value = x.facts[key as keyof typeof x.facts];
      if (value) out.push({ kind: "fact", id: stableId("fct", msg.id, key), key, label: FACT_LABELS[key], value, source });
    }
    const a = x.appointment;
    if (a?.title && a.date) out.push({ kind: "appointment", id: stableId("apt", msg.id, "appointment"), title: a.title, date: a.date, time: a.time, place: a.place, address: a.address, purpose: a.purpose, bring: a.bring.filter(Boolean), source });
    const d = x.deadline;
    const computed = d?.title ? deadlineFrom(d, msg.receivedAt, language) : null;
    if (d && computed) out.push({ kind: "deadline", id: stableId("ddl", msg.id, "deadline"), title: d.title, ...computed, quote: d.quote, consequence: d.consequence, source });
    const docs = x.documents.filter((doc) => doc.title);
    const ad = x.addresses;
    if (ad.application && !docs.some((d) => d.kind === "upo")) docs.push({ title: "MOS filing confirmation", kind: "upo", status: "have", attachment: null });
    docs.forEach((doc, i) => {
      const fields: Record<string, string> = {};
      if (doc.kind === "upo" && ad.application) fields.applicationAddress = ad.application;
      if (doc.kind === "rental_agreement" && doc.status === "have" && ad.current) { fields.address = ad.current; if (ad.currentFrom) fields.startDate = ad.currentFrom; }
      out.push({
        kind: "document", id: SINGLE_KINDS.has(doc.kind) ? docIdFor(doc.kind) : stableId("doc", msg.id, `${i}:${doc.title.toLowerCase()}`),
        title: doc.title, docKind: doc.kind, status: doc.status, ...(Object.keys(fields).length ? { fields } : {}),
        file: doc.status === "have" ? attachmentFor(msg, doc.attachment) : null, source,
      });
    });
    x.tasks.filter((task) => task.title).slice(0, 5).forEach((task, i) => out.push({ kind: "task", id: stableId("tsk", msg.id, `task${i}`), title: task.title, detail: task.detail, source }));
  }
  const parsed = out.flatMap((f) => { const r = findingSchema.safeParse(f); return r.success ? [r.data] : []; });
  return { messageId: msg.id, relevant: x.relevant && parsed.length > 0, category: x.category, sender: x.sender || msg.from, summary: x.summary, findings: parsed };
}
