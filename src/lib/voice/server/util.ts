import { warsawToday } from "../../case/next-step";
import type { CaseSnapshot } from "../../case/types";
import { isWorkingDay } from "../../features/deadline";

const PL_CHARS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
const PL_WORDS = new Set("proszę prosze pan pani pana panu się sie nie tak jest czy dla oraz jak też juz już dzień dobry dziękuję dziekuje mam ma był była będzie bedzie trzeba dni termin wniosek umowa umowę umowy najmu zaświadczenie ubezpieczenie paszport karta pobytu uczelni odciski jeszcze kiedy gdzie który która to że ze na do od po przy przez".split(" "));
const EN_WORDS = new Set("the a an i you is are was were have has do does did my your it this that what when where which can could will would please yes no not and or with for from to of in on at by about already sent need".split(" "));

/** Cheap, instant guess whether a transcript is Polish (counter turn attribution). */
export function looksPolish(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (!words.length) return false;
  let pl = (text.match(PL_CHARS) ?? []).length * 1.5;
  let en = 0;
  for (const w of words) {
    if (PL_WORDS.has(w)) pl++;
    if (EN_WORDS.has(w)) en++;
  }
  // Non-Latin scripts (Hindi, Tamil, Arabic...) are the user.
  if (/(?!\p{Script=Latin})\p{L}/u.test(text)) return false;
  return pl > en;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** "within N days" from today (Europe/Warsaw), KPA art. 57: day 0 not counted; Saturday/Sunday/holiday moves to next working day. */
export function dueInDays(days: number, now = new Date()): { date: string; steps: string[] } {
  const today = warsawToday(now);
  const base = new Date(`${today}T00:00:00Z`);
  const last = new Date(base.getTime() + days * 86_400_000);
  let final = last;
  const steps = [`Said at the counter on ${today}: ${days} days.`, `Today is not counted; day ${days} is ${iso(last)}.`];
  if (!isWorkingDay(last)) {
    while (!isWorkingDay(final)) final = new Date(final.getTime() + 86_400_000);
    steps.push(`${iso(last)} is not a working day, so it moves to ${iso(final)} (KPA art. 57 §4).`);
  }
  return { date: iso(final), steps };
}

const BASE_KEYWORDS = [
  "wezwanie", "uzupełnienie braków", "zaświadczenie", "umowa najmu", "aneks", "ubezpieczenie zdrowotne", "NFZ", "paszport",
  "karta pobytu", "pobyt czasowy", "odciski palców", "UPO", "MOS", "e-Doręczenia", "PESEL", "Wydział Spraw Cudzoziemców",
  "urząd wojewódzki", "zameldowanie", "opłata skarbowa", "decyzja", "legitymacja studencka",
];

/** Words that prime Muse Voice Transcribe: Polish office terms plus this case's own names and numbers. */
export function caseKeywords(c: CaseSnapshot | null): string[] {
  const out = new Set(BASE_KEYWORDS);
  if (c) {
    if (c.facts.caseNumber) out.add(c.facts.caseNumber.value);
    if (c.facts.office) out.add(c.facts.office.value);
    if (c.profile.organisation) out.add(c.profile.organisation);
    if (c.profile.fullName) out.add(c.profile.fullName);
    for (const d of c.documents.slice(0, 10)) out.add(d.title.slice(0, 60));
  }
  // Muse Voice Transcribe rejects keywords longer than 30 characters: keep short ones, split long names into parts.
  const fit = [...out].flatMap((k) => (k.length <= 30 ? [k] : k.split(/[,()]|\s+-\s+/).map((p) => p.trim()).filter((p) => p.length >= 3 && p.length <= 30)));
  return [...new Set(fit)].slice(0, 40);
}

export const firstName = (c: CaseSnapshot | null) => c?.profile.fullName?.split(/\s+/)[0] ?? null;

export const shortId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
