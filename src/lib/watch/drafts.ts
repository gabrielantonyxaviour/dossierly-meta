import { z } from "zod";
import type { CaseSnapshot } from "../case/types";
import { caseContext } from "../case/context";
import { maskerFor } from "../mask";
import { runModel } from "../model";
import type { MessageBody } from "../onboarding/inbox";
import { retryTransient } from "../onboarding/retry";
import type { Env } from "../server/env";
import { DRAFT_TITLES, type Draft } from "./letter";

const str = (max: number) => z.string().trim().max(max);
const body = z.string().trim().min(20).transform((s) => (s.length > 1000 ? `${s.slice(0, 999).trimEnd()}…` : s));
const piece = z.object({ to: str(300), subject: str(200), body, language: z.enum(["pl", "en"]).catch("pl") }).nullable().catch(null);
export const draftSchema = z.object({ letterTitle: str(120).catch(""), reply: piece, institution: piece });

const SYSTEM = `You prepare ready-to-send drafts for a non-EU newcomer in Poland after an official email arrived. Use ONLY facts from the CASE and the EMAIL; never invent a name, number, date, address or document.
Return up to two drafts:
1. "reply": a short formal reply to the office that sent the email, in Polish: a cover letter that encloses the document or information the email asks for, cites the case number from the CASE facts (omit the reference if no case number is known), and is signed with the person's full name. 4 to 7 sentences, at most 800 characters.
2. "institution": only when the email asks for a document that an institution issues (for example a certificate of enrolment from the person's university -> the dean's office, "Dziekanat"): a short request to that institution asking for exactly that document and saying what it is needed for and by when. Write it in Polish for a Polish university, otherwise in English. At most 800 characters. null when nothing like that is requested.
"to" is the addressee as a short line (office or department and institution). "subject" is the subject line. No markdown, no placeholders in brackets, no invented sender address.
"letterTitle": a short plain-English title of what the email asks, like "Request for a certificate of enrolment".
Return only JSON: {"letterTitle":"","reply":null|{"to":"","subject":"","body":"","language":"pl"},"institution":null|{"to":"","subject":"","body":"","language":"pl"}}`;

export type DraftOut = { letterTitle: string; drafts: Draft[] };

/** One extra Spark call: a Polish reply to the office and, when an institution must issue something, a request to it. */
export async function writeDrafts(env: Env, userId: string, msg: MessageBody, snap: CaseSnapshot, asks: string): Promise<DraftOut> {
  const input = [`EMAIL`, `From: ${msg.from}`, `Subject: ${msg.subject}`, `Asks (already extracted): ${asks || "see the text"}`, "", msg.text.slice(0, 5000) || "(empty body)"].join("\n");
  const out = await retryTransient(() => runModel(
    { env, userId },
    {
      task: "welcome", system: SYSTEM, context: caseContext(snap), input, schema: draftSchema, maxTokens: 3500, effort: "low",
      masker: maskerFor({ name: snap.profile.fullName ?? undefined, caseNumber: snap.facts.caseNumber?.value }),
      replay: () => { throw new Error("no replay for letter drafts"); },
    },
  ));
  const drafts: Draft[] = [];
  const { reply, institution } = out.data;
  if (reply) drafts.push({ kind: "reply", title: DRAFT_TITLES.reply, ...reply });
  if (institution) drafts.push({ kind: "institution", title: DRAFT_TITLES.institution, ...institution });
  return { letterTitle: out.data.letterTitle, drafts };
}
