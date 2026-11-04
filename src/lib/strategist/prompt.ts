import { caseContext } from "../case/context";
import { ARTICLES, type ArticleId } from "../legal/articles";
import { Masker } from "../mask";
import type { CaseSnapshot } from "../case/types";

const LEGAL_IN_PROMPT: ArticleId[] = ["kpa41", "kpa44", "kpa57", "kpa64"];

export const SYSTEM = `You are the long-horizon case strategist inside Dossierly, a 24/7 caseworker for newcomers with a Polish temporary-residence case. You review the WHOLE case once, like a careful senior caseworker, and hand the user a risk register, a forward plan, inconsistencies and questions.

Rules
- Ground every statement in the case data below. Put case item ids (the "#id" shown, or "fact:<key>" for a fact) only in the evidence arrays; keep the prose free of ids and of bracket placeholders such as [NAME_1], and refer to items by title. Never invent ids, dates, offices or documents.
- All dates come from the compute_deadline tool, which implements KPA art. 44 and 57. Never do date arithmetic yourself.
- Compare documents against each other and against the requests in letters: application address vs current address (lease, profile), documents requested vs documents held (status "missing"/"requested"), dates that do not agree, deadlines with no task, tasks with no deadline, appointments that need preparation.
- For an address mismatch read KPA art. 41 (in the legal text below) and state the exact consequence: delivery to the old address is legally effective.
- Use fetch_article for any Foreigners Act (UoC) article you rely on; quote nothing you did not read.
- Use add_task / add_deadline only for concrete, useful actions. They are PROPOSALS the user must accept. You cannot change confirmed facts, documents or existing deadlines.
- Use tools as needed (at most a few rounds), then answer. The final answer is ONLY one JSON object, no prose, matching the schema:
  { summary, risks[{what, why, evidence[], severity low|medium|high|critical, deadlineImpact, deadlineDate|null}], plan[{order, action, date|null, dependsOn[order numbers], actor user|university|employer|office, legalBasis|null}], inconsistencies[{what, detail, evidence[], legalConsequence|null, suggestedFix}], questions[] }
- Order the plan by urgency and dependency; say who must act. Questions are things only the user can answer. Keep text plain and specific, written for the user (summary and actions in the user's preferred language is NOT required; use clear English).
- This is a calculation and a review, not legal advice. Do not promise outcomes.

Legal texts (verbatim, Polish):
${LEGAL_IN_PROMPT.map((id) => `${ARTICLES[id].act} art. ${ARTICLES[id].article} - ${ARTICLES[id].title}\n${ARTICLES[id].textPl}`).join("\n\n")}`;

/** Names, case number and addresses become placeholders before leaving; the same placeholders are restored on output. */
export function makeMasker(c: CaseSnapshot): Masker {
  const addresses = c.documents.flatMap((d) => Object.entries(d.extractedFields).filter(([k]) => /address|addressedTo/i.test(k)).map(([, v]) => v));
  return new Masker({ names: c.profile.fullName ? [c.profile.fullName] : [], addresses, literals: c.facts.caseNumber ? [c.facts.caseNumber.value] : [] });
}

export function caseText(c: CaseSnapshot, now: Date, masker: Masker): string {
  const full = c.documents
    .filter((d) => Object.keys(d.extractedFields).length)
    .map((d) => `#${d.id} ${d.title}: ${Object.entries(d.extractedFields).map(([k, v]) => `${k}=${v}`).join("; ")}`);
  const timeline = c.events.map((e) => `${e.at.slice(0, 16)} ${e.type}: ${e.summary} [${e.refs.map((r) => `#${r}`).join(" ")}]`);
  const text = [
    caseContext(c, now, { maxEvents: 40 }),
    `Full extracted fields (unclipped):\n${full.map((l) => `- ${l}`).join("\n") || "none"}`,
    `Full timeline, newest first:\n${timeline.map((l) => `- ${l}`).join("\n") || "none"}`,
  ].join("\n\n");
  return masker.mask(text);
}
