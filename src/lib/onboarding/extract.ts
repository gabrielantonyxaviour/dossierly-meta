import { z } from "zod";
import { DOC_KINDS } from "../case/types";
import { warsawDate } from "../case/next-step";
import { maskerFor } from "../mask";
import { runModel } from "../model";
import type { Env } from "../server/env";
import type { MessageBody } from "./inbox";
import { buildFindings, type MailReading } from "./findings";
import { retryTransient } from "./retry";

const n = <T extends z.ZodTypeAny>(s: T) => s.nullable().catch(null);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const str = (max: number) => z.string().trim().max(max);

/** What Spark must return for one email. Lenient: bad sub-fields become null instead of failing the email. */
export const extractionSchema = z.object({
  relevant: z.boolean(),
  category: z.enum(["summons", "appointment", "application_confirmation", "decision", "university", "insurance", "registration", "other"]).catch("other"),
  sender: str(160).catch(""),
  summary: str(400).catch(""),
  facts: z.object({
    caseNumber: n(str(120)), office: n(str(200)), filedAt: n(day), mosStatus: n(str(200)), inpolStatus: n(str(200)),
  }).catch({ caseNumber: null, office: null, filedAt: null, mosStatus: null, inpolStatus: null }),
  appointment: n(z.object({
    title: str(160), date: day, time: n(z.string().regex(/^\d{2}:\d{2}$/)), place: str(160).catch(""), address: str(300).catch(""),
    purpose: str(400).catch(""), bring: z.array(str(160)).max(12).catch([]),
  })),
  deadline: n(z.object({
    title: str(160), days: n(z.number().int().min(1).max(365)), from: n(z.enum(["delivery", "letter_date"])),
    letterDate: n(day), statedDate: n(day), quote: str(400).catch(""), consequence: str(300).catch(""),
  })),
  addresses: z.object({ application: n(str(300)), current: n(str(300)), currentFrom: n(day) }).catch({ application: null, current: null, currentFrom: null }),
  documents: z.array(z.object({
    title: str(160), kind: z.enum(DOC_KINDS).catch("other"), status: z.enum(["have", "missing", "requested"]).catch("requested"), attachment: n(str(160)),
  })).max(12).catch([]),
  tasks: z.array(z.object({ title: str(160), detail: str(400).catch("") })).max(8).catch([]),
});
export type Extraction = z.infer<typeof extractionSchema>;

const SYSTEM = `You read one email from the inbox of a non-EU newcomer living in Poland with a temporary residence permit (or applying for one).
Decide if it matters for their residence case or official life in Poland (voivodeship office / UdSC / MOS application portal / e-Doręczenia notices / summons (wezwanie) / appointment for fingerprints or card collection / decision / university enrolment or certificate / health insurance / address registration). Newsletters, marketing, receipts and personal mail are NOT relevant.
Extract only what the email (and any attached image) explicitly states. Never guess or invent a date, number, address or requirement.
Rules:
- Dates as YYYY-MM-DD, times as HH:MM (24h, Warsaw local time). Polish months: stycznia=01 lutego=02 marca=03 kwietnia=04 maja=05 czerwca=06 lipca=07 sierpnia=08 września=09 października=10 listopada=11 grudnia=12.
- caseNumber: the case reference/signature ("znak sprawy") copied character by character from THIS email; every letter and digit matters. Never write a number that is not in the email (also not in summary). office: the issuing office name.
- appointment: a scheduled visit at an office (date, time, place, address, what to bring). title = one or two plain English words naming what happens ("Fingerprints", "Card collection", "Interview"); purpose and bring items in plain English. null if none.
- deadline: something the person must do by a deadline. days = the number of days the text states ("w terminie 14 dni" = 14) and from = "delivery" when counted from receiving/delivery of the letter ("od dnia doręczenia"), "letter_date" when counted from the letter's date. statedDate only when an explicit calendar date is given instead. quote = the exact deadline sentence in the original language. consequence = what happens if missed, as stated, in short plain English (e.g. "Your application will be left unexamined"). title in short English: "Reply to the summons" for a wezwanie to complete documents, otherwise what to do in 2–5 words. null if none. Only something the PERSON must do counts: a date by which the OFFICE will decide (an art. 36 KPA delay notice, "nowy termin załatwienia sprawy") is NOT a deadline; put it in facts.inpolStatus as "Decision expected by YYYY-MM-DD". A decision letter: put the outcome in facts.inpolStatus (e.g. "Positive decision issued YYYY-MM-DD"); its appeal period ("odwołanie ... w terminie 14 dni") is a deadline only if the decision is negative.
- Emails marked "(PRZYKŁAD)" are fictional samples; read them exactly like real ones.
- documents: each distinct document the email requests or confirms, ONCE, with a short English title ("Health insurance proof", "University certificate", "Stamp duty payment proof (340 zł)"), status "requested" when asked for, "have" when it confirms receipt.
- addresses: application = the address the person gave IN THEIR RESIDENCE APPLICATION, only when a MOS filing confirmation / UPO / office letter states it (a dorm counts). current = the address of a flat in a lease or landlord email; currentFrom = the date the lease starts. Copy addresses exactly as written. null when not stated.
- A landlord email with a lease (umowa najmu), or an insurance confirmation (NFZ, a policy), IS relevant: it is proof the office asks for. List it as a document with status "have" and, in attachment, the exact file name of the attached PDF or image that is that document (null if none).
- A MOS filing confirmation is relevant: facts (caseNumber, office, filedAt) plus a document kind "upo" titled "MOS filing confirmation", status "have".
- Offers from paid agencies or law firms are NOT relevant.
- A summons asking for documents: list EACH requested document with status "requested" and its real kind (lease = rental_agreement, insurance = health_insurance, photo = photo). Title them plainly: "Lease", "Health insurance for the whole stay", "New photo meeting the requirements".
- tasks: at most 3 concrete actions that are NOT already covered by a listed document or the appointment (e.g. "Pay the 100 zł residence card fee"). Short imperative English titles. Usually 0–2.
- summary: one plain-English sentence a friend would say ("The Mazowiecki office wants your health insurance and rental agreement within 14 days.").
Return only JSON: {"relevant":bool,"category":"summons|appointment|application_confirmation|decision|university|insurance|registration|other","sender":"","summary":"","facts":{"caseNumber":null,"office":null,"filedAt":null,"mosStatus":null,"inpolStatus":null},"appointment":null|{"title":"","date":"","time":null,"place":"","address":"","purpose":"","bring":[]},"deadline":null|{"title":"","days":null,"from":null,"letterDate":null,"statedDate":null,"quote":"","consequence":""},"addresses":{"application":null,"current":null,"currentFrom":null},"documents":[{"title":"","kind":"${DOC_KINDS.join("|")}","status":"requested","attachment":null}],"tasks":[{"title":"","detail":""}]}`;

export async function readMail(env: Env, userId: string, msg: MessageBody, ctx: { fullName: string | null; language: string }): Promise<MailReading> {
  const input = [
    `Received: ${msg.receivedAt} (Warsaw day ${warsawDate(msg.receivedAt)})`,
    `From: ${msg.from}`,
    `Subject: ${msg.subject}`,
    msg.attachments.length ? `Attachments: ${msg.attachments.map((a) => `${a.name} (${a.mime})`).join(", ")}` : "Attachments: none",
    "",
    msg.text || "(empty body)",
  ].join("\n");
  const out = await retryTransient(() => runModel(
    { env, userId },
    {
      task: "mail_scan",
      system: SYSTEM,
      input,
      images: msg.images.length ? msg.images : undefined,
      schema: extractionSchema,
      maxTokens: msg.images.length ? 6000 : 4000,
      effort: "low",
      masker: maskerFor({ name: ctx.fullName ?? undefined }),
      replay: () => { throw new Error("no replay for mail_scan"); },
    },
  ));
  return buildFindings(msg, out.data, ctx.language);
}
