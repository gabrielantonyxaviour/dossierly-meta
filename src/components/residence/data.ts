/*
 * Tap-through preview data: one household's residence case told through time (Gabriel approved the 8-stage flow,
 * 18 Nov 2026). Persona and case numbers are generated; dates and legal rules follow the research in
 * ~/Documents/poland/dossierly/research (Ustawa o cudzoziemcach, KPA, UdSC/WSC pages).
 */
import type { IconName } from "@/components/Icon";

export type StageId = "start" | "prepare" | "file" | "waiting" | "letter" | "visit" | "decision" | "after";

export const STAGES: { id: StageId; n: number; name: string; short: string; when: string }[] = [
  { id: "start", n: 0, name: "Start", short: "Start", when: "Wed 18 Nov 2026" },
  { id: "prepare", n: 1, name: "Prepare", short: "Prepare", when: "Thu 19 Nov 2026" },
  { id: "file", n: 2, name: "File in MOS", short: "File", when: "Tue 8 Dec 2026" },
  { id: "waiting", n: 3, name: "Waiting", short: "Waiting", when: "Mon 1 Feb 2027" },
  { id: "letter", n: 4, name: "Letter arrives", short: "Letter", when: "Tue 16 Feb 2027" },
  { id: "visit", n: 5, name: "Fingerprint visit", short: "Visit", when: "Thu 18 Mar 2027" },
  { id: "decision", n: 6, name: "Decision", short: "Decision", when: "Fri 12 Nov 2027" },
  { id: "after", n: 7, name: "Card and after", short: "After", when: "Mon 6 Dec 2027" },
];

export const PERSON = {
  name: "Priya Nair",
  first: "Priya",
  ground: "Work (single permit)",
  employer: "Northwind Data Sp. z o.o.",
  office: "Mazowiecki Urząd Wojewódzki · Wydział Spraw Cudzoziemców",
  officeShort: "Mazowiecki UW, Warsaw",
  address: "ul. Marszałkowska 3/5, Warszawa",
  caseNo: "WSC-II-P.6151.48213.2026",
  cardUntil: "Thu 14 Jan 2027",
  fileBy: "Thu 14 Jan 2027",
  startBy: "Thu 19 Nov 2026",
  filed: "Tue 8 Dec 2026",
};

export const HOUSEHOLD = [
  { name: "Priya Nair", role: "You · work permit", fee: "440 + 100 zł", note: "Files her own application in MOS" },
  { name: "Arun Menon", role: "Spouse · family permit (art. 159)", fee: "340 + 100 zł", note: "Files his own application in MOS" },
  { name: "Meera Nair", role: "Daughter, 6 · family permit", fee: "340 + 50 zł", note: "A parent files for her" },
];

export type Step = { state: "done" | "now" | "next" | "you"; title: string; sub?: string; tag?: { tone: "ok" | "warn" | "deadline" | "official" | "info"; text: string }; icon?: IconName };

/** The case path shown on Waiting and After: where the whole case stands. */
export const PATH: { id: StageId; title: string; date: string; detail?: string }[] = [
  { id: "prepare", title: "Documents ready", date: "4 Dec 2026", detail: "11 of 11 items, both fees paid" },
  { id: "file", title: "Filed in MOS", date: "8 Dec 2026", detail: "UPO receipt saved · case " + PERSON.caseNo },
  { id: "waiting", title: "Certificate of legal stay", date: "21 Dec 2026", detail: "You may stay and work while the case runs" },
  { id: "letter", title: "Wezwanie answered", date: "22 Feb 2027", detail: "Employer certificate and lease sent by e-Doręczenia" },
  { id: "visit", title: "Fingerprints given", date: "18 Mar 2027", detail: "Passport shown, signature taken" },
  { id: "decision", title: "Decision", date: "expected Jun 2027 – Jun 2028", detail: "Mazowieckie average in 2026: 394 days" },
  { id: "after", title: "Card collected", date: "after the decision", detail: "One visit, about 3–4 weeks after the decision" },
];

/** The same path as seen while waiting (1 Feb 2027): what is done, and what usually comes next. */
export const WAIT_PATH: { id: string; title: string; date: string; detail?: string }[] = [
  { id: "prepare", title: "Documents ready", date: "4 Dec 2026", detail: "11 of 11 items, both fees paid" },
  { id: "file", title: "Filed in MOS", date: "8 Dec 2026", detail: "UPO receipt saved" },
  { id: "cert", title: "Certificate of legal stay", date: "21 Dec 2026", detail: "You may stay and work while the case runs" },
  { id: "review", title: "Office reviews your file", date: "now", detail: "It may send a letter asking for documents (wezwanie). Dossierly reads it the day it arrives." },
  { id: "visit", title: "Fingerprint visit", date: "the office sets the date", detail: "At least 7 days' notice" },
  { id: "decision", title: "Decision", date: "expected Jun 2027 – Jun 2028", detail: "Mazowieckie average in 2026: 394 days" },
  { id: "after", title: "Card collected", date: "after the decision" },
];

export const CHECKLIST: { group: string; items: { title: string; sub: string; state: "done" | "todo" | "warn"; who?: string }[] }[] = [
  { group: "Accounts", items: [
    { title: "PESEL number", sub: "On your current card", state: "done" },
    { title: "Profil Zaufany login", sub: "Needed to sign in to MOS and sign the application", state: "done" },
    { title: "e-Doręczenia mailbox", sub: "The office sends letters here. Open it before you file.", state: "warn" },
  ] },
  { group: "Documents", items: [
    { title: "Photo 35×45 mm (684×883 px)", sub: "Checked: plain background, no shadow", state: "done" },
    { title: "Every passport page, scanned as one PDF", sub: "Blank pages too", state: "todo" },
    { title: "Health insurance for the whole stay", sub: "ZUS confirmation from your employer", state: "done" },
    { title: "Lease agreement", sub: "Proof of where you live", state: "done" },
    { title: "Employment contract", sub: "Signed copy", state: "done" },
  ] },
  { group: "Your employer", items: [
    { title: "Załącznik nr 1 (employer annex)", sub: "MOS emailed HR a link on 19 Nov. It works until Sat 19 Dec.", state: "warn", who: "Northwind HR" },
  ] },
  { group: "Fees: two separate transfers", items: [
    { title: "440 zł stamp duty", sub: "To Urząd m.st. Warszawy (the city office), not the voivode", state: "done" },
    { title: "100 zł residence card fee", sub: "To Mazowiecki Urząd Wojewódzki", state: "todo" },
  ] },
];

export const LETTER = {
  kind: "Wezwanie · documents",
  from: "Mazowiecki Urząd Wojewódzki",
  via: "e-Doręczenia",
  delivered: "Mon 15 Feb 2027",
  deadline: "Mon 1 Mar 2027",
  daysLeft: 13,
  basis: "Art. 106f, Ustawa o cudzoziemcach",
  polish: "Wzywa się Panią do przedłożenia w terminie 14 dni od dnia doręczenia niniejszego wezwania aktualnego zaświadczenia pracodawcy o zatrudnieniu i wysokości wynagrodzenia oraz umowy najmu lokalu.",
  asks: [
    { what: "A current certificate from your employer", sub: "Job title and monthly pay", have: false },
    { what: "Your lease agreement", sub: "Already in your case, added 2 Dec", have: true },
  ],
  count: [
    "Delivered to your e-Doręczenia box on Mon 15 Feb",
    "Day 1 is Tue 16 Feb (the delivery day is not counted, KPA art. 57 §1)",
    "Day 14 is Mon 1 Mar, a working day, so that is the last day",
    "Sending by e-Doręczenia counts on the day you send (KPA art. 57 §5)",
  ],
  plan: [
    { day: "Tue 16 Feb", what: "Ask HR for the certificate (email drafted)" },
    { day: "Thu 18 Feb", what: "Reminder if HR has not answered" },
    { day: "Mon 22 Feb", what: "Send both documents by e-Doręczenia" },
    { day: "Mon 1 Mar", what: "Last day", deadline: true },
  ],
};

export const HELP = [
  { name: "Stowarzyszenie Interwencji Prawnej (SIP)", sub: "Free legal aid for foreigners, Warsaw and online" },
  { name: "Fundacja Ocalenie", sub: "Free consultations on residence cases" },
  { name: "Nieodpłatna pomoc prawna", sub: "Free legal advice points run by the city" },
  { name: "A licensed lawyer", sub: "Opens an external directory; Dossierly is not a law firm" },
];
