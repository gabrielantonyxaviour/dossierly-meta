/*
 * Deadline engine for Polish administrative letters (KPA = Kodeks postępowania administracyjnego).
 * Pure and deterministic: the model reads the sentence in the letter, this code does the arithmetic.
 * Rules implemented, with the verbatim text in ./articles.ts:
 *  - art. 44 §1, §4: a letter that was not collected counts as delivered when the 14-day storage period ends;
 *  - art. 57 §1-§3: the day of the event is not counted; weeks and months end on the matching weekday / date;
 *  - art. 57 §4: a deadline ending on a Saturday, Sunday or public holiday moves to the next day that is none;
 *  - art. 57 §5 pt 2: posting at the designated postal operator's office on the last day is on time.
 * The result is a calculation, not legal advice.
 */
import type { CitedDeadline } from "../look/types";
import { ARTICLES, articleLabel, quote, type ArticleId } from "./articles";
import { DeadlineInputError, addDays, addMonths, formatDay, formatShort, parseIsoDate } from "./calendar";
import { holidayName, isDayOff, isSaturday } from "./holidays";

export { DeadlineInputError } from "./calendar";

export type DeadlineStart =
  | { kind: "delivery" | "electronic" | "letter_date"; date: string }
  | { kind: "notice"; firstNoticeDate: string };

export interface DeadlineInput {
  start: DeadlineStart;
  period: { amount: number; unit: "days" | "weeks" | "months" };
  /** Verbatim sentence from the letter that set the period (shown as a step, never used in the arithmetic). */
  quote?: string;
  /** Legal basis printed on the letter, e.g. "art. 64 § 2 KPA". */
  legalBasis?: string | null;
}

export type ComputedDeadline = CitedDeadline & { warnings: string[] };

const NOTICE_STORAGE_DAYS = 14;
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

function dayOffReason(iso: string): string {
  const name = holidayName(iso);
  if (name && name.en !== "Sunday") return `${name.en}, a public holiday`;
  return isSaturday(iso) ? "a Saturday" : "a Sunday";
}

/** First day on or after `iso` that is not a Saturday, Sunday or public holiday, plus the skipped days. */
function rollForward(iso: string): { date: string; skipped: string[] } {
  const skipped: string[] = [];
  let cur = iso;
  while (isSaturday(cur) || isDayOff(cur)) {
    skipped.push(cur);
    cur = addDays(cur, 1);
  }
  return { date: cur, skipped };
}

function validatePeriod(period: DeadlineInput["period"]): void {
  if (!Number.isInteger(period.amount) || period.amount < 1 || period.amount > 1000) {
    throw new DeadlineInputError("invalid_period", `Period must be a whole number from 1 to 1000, got ${String(period.amount)}`);
  }
  if (!["days", "weeks", "months"].includes(period.unit)) {
    throw new DeadlineInputError("invalid_period", `Unsupported unit: ${String(period.unit)}`);
  }
}

function legalBasisWarnings(input: DeadlineInput): string[] {
  const basis = input.legalBasis ?? "";
  const { amount, unit } = input.period;
  const days = unit === "days" ? amount : unit === "weeks" ? amount * 7 : amount * 28;
  const out: string[] = [];
  if (/art\.?\s*64\b/i.test(basis) && days < 7) {
    out.push(
      "KPA art. 64 §2 says a summons to fix formal defects must give at least 7 days. This letter gives fewer, so check the number of days with the office before you rely on it.",
    );
  }
  if (/106f/i.test(basis) && days < 14) {
    out.push("Foreigners Act art. 106f says a summons to submit documents must give at least 14 days. This letter gives fewer, so check it with the office.");
  }
  return out;
}

export function computeKpaDeadline(input: DeadlineInput): ComputedDeadline {
  validatePeriod(input.period);
  const { start, period } = input;
  const steps: string[] = [];
  const citeIds: Array<[ArticleId, string]> = [];
  const ruleParts: string[] = [];
  const warnings = legalBasisWarnings(input);

  let startDate: string;
  if (start.kind === "notice") {
    parseIsoDate(start.firstNoticeDate);
    const noticeDay = start.firstNoticeDate;
    startDate = addDays(noticeDay, NOTICE_STORAGE_DAYS);
    steps.push(
      `The post office first left a notice on ${formatDay(noticeDay)}. It keeps the letter for ${NOTICE_STORAGE_DAYS} days, counting from the day after (KPA art. 44 §1).`,
      `Those ${NOTICE_STORAGE_DAYS} days end on ${formatDay(startDate)}. If you do not collect the letter, it counts as delivered at the end of that day (KPA art. 44 §4).`,
      `If you collect the letter earlier, the day you collect it is the delivery day instead, and your deadline starts from then.`,
      `${formatDay(startDate)} is the delivery day. That day is not counted (KPA art. 57 §1).`,
    );
    ruleParts.push("KPA art. 44 §4, art. 57 §1");
    citeIds.push(["kpa44", "4"], ["kpa44", "1"]);
  } else {
    parseIsoDate(start.date);
    startDate = start.date;
    const what =
      start.kind === "delivery"
        ? `You received the letter on ${formatDay(startDate)}.`
        : start.kind === "electronic"
          ? `The electronic message was delivered on ${formatDay(startDate)}.`
          : `The letter is dated ${formatDay(startDate)} and the deadline is counted from that date.`;
    steps.push(`${what} That day is not counted (KPA art. 57 §1).`);
    ruleParts.push("KPA art. 57 §1");
    if (start.kind === "letter_date") {
      warnings.push("Most KPA deadlines run from the day you receive the letter, not from the date printed on it. We counted from the letter date because that is what was asked. Check which one your letter means.");
    }
  }

  let nominal: string;
  const label = plural(period.amount, period.unit.slice(0, -1));
  const quoted = input.quote?.trim() ? ` The letter says: “${input.quote.trim().replace(/[.;,]+$/, "")}”.` : "";
  if (period.unit === "days") {
    nominal = addDays(startDate, period.amount);
    steps.push(`The period is ${label}.${quoted} Day ${period.amount} is ${formatDay(nominal)}.`);
    citeIds.push(["kpa57", "1"]);
  } else if (period.unit === "weeks") {
    nominal = addDays(startDate, period.amount * 7);
    steps.push(`The period is ${label}.${quoted} It ends on the same weekday, ${formatDay(nominal)} (KPA art. 57 §2).`);
    ruleParts.push("§2");
    citeIds.push(["kpa57", "2"]);
  } else {
    const r = addMonths(startDate, period.amount);
    nominal = r.date;
    steps.push(
      r.clamped
        ? `The period is ${label}.${quoted} That month has no day ${Number(startDate.slice(8))}, so the period ends on its last day, ${formatDay(nominal)} (KPA art. 57 §3).`
        : `The period is ${label}.${quoted} It ends on the same date number, ${formatDay(nominal)} (KPA art. 57 §3).`,
    );
    ruleParts.push("§3");
    citeIds.push(["kpa57", "3"]);
  }

  const { date: dueDate, skipped } = rollForward(nominal);
  ruleParts.push("§4");
  citeIds.push(["kpa57", "4"]);
  if (skipped.length === 0) {
    steps.push("That is not a Saturday, Sunday or public holiday, so it stays.");
  } else {
    const first = `${formatDay(nominal)} is ${dayOffReason(nominal)}`;
    const rest = skipped.slice(1).map((d) => `${formatShort(d)} (${dayOffReason(d).replace(", a public holiday", "")})`);
    const chain = rest.length > 0 ? `. The next days are also off: ${rest.join(", ")}` : "";
    steps.push(`${first}${chain}. The deadline moves to the next day that is not a Saturday, Sunday or public holiday: ${formatDay(dueDate)} (KPA art. 57 §4).`);
  }

  steps.push(
    `The last day is ${formatDay(dueDate)}. Posting your reply at a Polish post office (Poczta Polska) on or before that day counts as on time, so keep the stamped receipt (KPA art. 57 §5).`,
  );
  citeIds.push(["kpa57", "5"]);
  if (start.kind === "electronic") {
    steps.push("For electronic delivery the date normally counts from when the message was received in e-Doręczenia, as the system shows it. Check the date in your inbox; it can differ from the date on the letter.");
  }
  if (/art\.?\s*64\b/i.test(input.legalBasis ?? "")) citeIds.push(["kpa64", "2"]);

  const seen = new Set<string>();
  const citations = citeIds
    .filter(([id, p]) => !seen.has(`${id}:${p}`) && seen.add(`${id}:${p}`))
    .map(([id, p]) => ({ label: articleLabel(id, p), url: ARTICLES[id].isapUrl ?? ARTICLES[id].sourceUrl, quote: quote(id, p) }));

  return { dueDate, startDate, steps, rule: ruleParts.join(", "), citations, warnings };
}
