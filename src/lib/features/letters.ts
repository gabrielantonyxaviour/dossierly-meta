import { maskerFor } from "../mask";
import { runModel, sumRuns, type Ctx, type Run } from "../model";
import { ModelError } from "../model/types";
import { z } from "zod";
import { LetterSchema, type Case, type Letter, type LettersLinkRequest, type LettersReadRequest } from "../schemas";
import { lowConfidenceFields } from "./confidence";
import { computeDeadline } from "./deadline";
import { letterFixture, linkFixture } from "./fixtures";
import { LinkOut } from "./outputs";
import { DATA_RULE, JSON_ONLY, NO_ADVICE, langName } from "./prompts";

export const LETTER_SCHEMA_TEXT = `{"transcript": string (the page text transcribed verbatim in Polish, line breaks as spaces; write this FIRST and base every other field on it), "readable": boolean, "title": string (the letter's subject in the reader's language), "kind": "wezwanie_braki_formalne"|"decision"|"card_collection"|"fingerprint_appointment"|"proceedings_extension"|"other", "office": string|null (as printed), "caseNumber": string|null (exactly as printed), "dateOnLetter": "YYYY-MM-DD"|null, "asks": string[] (what the letter asks the person to do or provide, in the reader's language), "asksLocal": string[] (the same asks quoted in the letter's own Polish words, same order), "deadlineRule": {"days": integer|null, "from": "delivery"|"letter_date"|null, "quote": string (the exact Polish sentence that sets the deadline, "" if none)}, "fields": [{"label": string (Polish label exactly as printed), "meaning": string, "howToFill": string}], "uncertain": string[] (names of the fields above you are not sure you read correctly, for example "dateOnLetter", "deadlineRule.days", "caseNumber"; [] when you are sure of all)}`;

const ReadOut = LetterSchema.omit({ lowConfidence: true }).extend({ uncertain: z.array(z.string().max(80)).max(20).optional() });

function mergeLetters(parts: Letter[]): Letter {
  const first = parts.find((p) => p.readable) ?? parts[0];
  const uniq = <T,>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];
  return {
    ...first,
    readable: parts.some((p) => p.readable),
    title: parts.map((p) => p.title).find(Boolean) ?? "",
    office: parts.map((p) => p.office).find(Boolean) ?? null,
    caseNumber: parts.map((p) => p.caseNumber).find(Boolean) ?? null,
    dateOnLetter: parts.map((p) => p.dateOnLetter).find(Boolean) ?? null,
    kind: parts.map((p) => p.kind).find((k) => k !== "other") ?? "other",
    transcript: parts.map((p) => p.transcript).filter(Boolean).join("\n"),
    asks: uniq(parts.flatMap((p) => p.asks), (a) => a.toLowerCase()),
    asksLocal: uniq(parts.flatMap((p) => p.asksLocal), (a) => a.toLowerCase()),
    deadlineRule: parts.map((p) => p.deadlineRule).find((d) => d.days !== null) ?? first.deadlineRule,
    fields: uniq(parts.flatMap((p) => p.fields), (f) => f.label.toLowerCase()),
    lowConfidence: [...new Set(parts.flatMap((p) => p.lowConfidence))],
  };
}

/** One image per model call (vision role); pages are merged in code. */
export async function readLetter(ctx: Ctx, r: LettersReadRequest) {
  const lang = langName(r.language);
  const system = `You read photographed Polish official letters for a foreigner and explain them in ${lang}. Be accurate; copy numbers, dates and case numbers exactly as printed; if something is illegible say so rather than guessing. ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: ${LETTER_SCHEMA_TEXT}
Write every value except "transcript", "asksLocal", "office", "caseNumber", field "label" and deadlineRule.quote in ${lang}. If the image is not a letter or is unreadable, set "readable" false and "title" to a short explanation.`;
  const pages = await Promise.all(
    r.pages.map((page) =>
      runModel(ctx, {
        task: "read",
        system,
        input: "Read this letter page and fill the schema.",
        images: [page],
        schema: ReadOut,
        maxTokens: 6000,
        effort: "low",
        masker: maskerFor(),
        replay: () => letterFixture(r, r.language),
      }),
    ),
  );
  const letters = pages.map(({ data: { uncertain, ...letter }, run }) => ({ ...letter, lowConfidence: run.ranOn === "replay" ? [] : lowConfidenceFields(uncertain) }));
  const run = sumRuns(pages.map((p) => p.run));
  return { letter: mergeLetters(letters), run, runs: pages.map((p) => p.run) };
}

function caseContext(c: Case): string {
  const events = c.events.map((e) => `${e.id} | ${e.date} | ${e.kind} | ${e.title}: ${e.summary}`).join("\n") || "(none)";
  const docs = c.documents.map((d) => `${d.have ? "HAVE" : "MISSING"}: ${d.name}`).join("\n") || "(none)";
  const deadlines = c.deadlines.map((d) => `${d.date}: ${d.what}`).join("\n") || "(none)";
  return `Office: ${c.office}\nCase number: ${c.caseNumber ?? "unknown"}\nApplicant: ${c.profile.name}\nSituation (user-confirmed): ${JSON.stringify(c.context ?? {})}\nEVENTS (id | date | kind | title: summary)\n${events}\nDOCUMENTS\n${docs}\nKNOWN DEADLINES\n${deadlines}`;
}

export async function linkLetter(ctx: Ctx, r: LettersLinkRequest) {
  const lang = langName(r.language);
  const system = `You are the case reasoner of a personal caseworker for a foreigner in Poland. Relate a new letter to the person's whole case. ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: {"relatedEventIds": string[] (only ids from EVENTS), "explanation": string (3 to 5 plain sentences in ${lang}: what this letter is in the context of the case and why it arrived), "stillOpen": string[] (in ${lang}: what the letter asks for that the DOCUMENTS list shows is still missing or not yet done), "draftLocal": string (a short formal Polish cover letter replying to the office: reference the case number, list only the enclosures marked HAVE that the letter asks for, no legal arguments, no promises, end with the applicant's name), "draftUser": string (the same cover letter in ${lang})}
Never invent facts, documents or dates. Write "______" where information is missing. Do not state the deadline date: it is computed separately.`;
  const masker = maskerFor({ name: r.case.profile.name, addresses: r.case.profile.addresses, caseNumber: r.case.caseNumber });
  const input = `NEW LETTER (delivered ${r.deliveryDate}):\n${JSON.stringify(r.letter)}`;
  const base = { context: caseContext(r.case), input, schema: LinkOut, masker, replay: () => linkFixture(r) };
  let runs: Run[];
  let data;
  let fallbackModel: string | undefined;
  try {
    const out = await runModel(ctx, { ...base, task: "link", system, maxTokens: 8000, effort: "high" });
    data = out.data;
    runs = [out.run];
  } catch (err) {
    if (err instanceof ModelError && ["no_key", "over_budget", "models_disabled"].includes(err.code)) throw err;
    // The reasoning call failed or was invalid twice: the draft role answers over the same masked case and the run says so.
    const out = await runModel(ctx, { ...base, task: "link_fallback", system, maxTokens: 5000 });
    data = out.data;
    runs = [out.run];
    fallbackModel = out.run.model;
  }
  const known = new Set(r.case.events.map((e) => e.id));
  const deadline = computeDeadline({ rule: r.letter.deadlineRule, deliveryDate: r.deliveryDate, letterDate: r.letter.dateOnLetter, language: r.language });
  return {
    link: {
      relatedEventIds: data.relatedEventIds.filter((id) => known.has(id)),
      explanation: data.explanation,
      stillOpen: data.stillOpen,
    },
    deadline,
    draftLocal: data.draftLocal,
    draftUser: data.draftUser,
    run: sumRuns(runs),
    runs,
    ...(fallbackModel ? { fallbackModel, fallbackLabel: "Answered by the faster model because deeper reasoning was unavailable" } : {}),
  };
}

