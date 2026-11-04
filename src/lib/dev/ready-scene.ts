import { caseClient } from "@/lib/case/client";
import { warsawToday } from "@/lib/case/next-step";

/*
 * PREVIEW-ONLY scene for verifying "Ready for you" (film A8) and the agent notifications before the real inbox
 * processor (dm-onboarding) and call (dm-voice) run. Writes the agreed contract shapes (a)-(d) and says plainly
 * that no call was placed. Never used in production (callers check APP_ENV).
 */

const ids = { letter: "doc-enrol-letter", deadline: "dl-enrolment", reply: "doc-draft-office", dean: "doc-draft-dean", arrived: "ev-enrol-email", call: "ev-enrol-call" };

const plDate = (d: string) => new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

function warsawAt(date: string, time: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "longOffset" }).formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  return `${date}T${time}:00${part === "GMT" ? "+00:00" : part.replace("GMT", "")}`;
}

export async function writeReadyScene(userId: string, now = new Date()): Promise<void> {
  const cc = caseClient(userId);
  const snap = await cc.snapshot();
  for (const [kind, id] of [["documents", ids.letter], ["documents", ids.reply], ["documents", ids.dean], ["deadlines", ids.deadline], ["events", ids.arrived], ["events", ids.call]] as const) {
    if (snap[kind].some((x) => x.id === id)) await cc.remove(kind, id);
  }
  const today = warsawToday(now);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const caseNo = snap.facts.caseNumber?.value ?? "WSC-II-P.6151.48213.2026";
  const uni = snap.profile.organisation ?? "your university";
  const name = snap.profile.fullName ?? "Arjun Raman";
  const due = "2026-11-25";

  await cc.create("documents", {
    id: ids.letter, kind: "letter", title: "Letter from the office: certificate of enrolment", status: "have", fileKey: null, pages: 1, source: "email",
    extractedFields: { received: today, sender: "Mazowiecki Urząd Wojewódzki", asks: "A certificate that you are enrolled and continuing your studies", deadline: "Wed 25 Nov 2026" },
  });
  await cc.create("deadlines", {
    id: ids.deadline, title: "Send the certificate of enrolment", dueDate: due, triggeredBy: ids.letter, status: "open",
    computation: { steps: [`The letter reached you on ${today}`, "It names the date itself: 25 November 2026", "A Wednesday and a working day"], rule: "Date set in the letter", legalRefUrl: null },
    reminders: [{ at: warsawAt(tomorrow, "09:00"), channel: "call", sentAt: null }],
  });
  await cc.create("documents", {
    id: ids.reply, kind: "letter", title: "Reply to the office", status: "have", fileKey: null, pages: null, source: "agent",
    extractedFields: {
      triggeredBy: ids.letter, language: "pl", to: "Mazowiecki Urząd Wojewódzki, Wydział Spraw Cudzoziemców", subject: `Sygn. ${caseNo}: zaświadczenie o kontynuacji nauki`,
      draft: `Mazowiecki Urząd Wojewódzki w Warszawie\nWydział Spraw Cudzoziemców\nul. Marszałkowska 3/5, 00-624 Warszawa\n\nSygn. sprawy: ${caseNo}\n\nW odpowiedzi na pismo z dnia ${plDate(today)} w załączeniu przekazuję zaświadczenie o kontynuacji nauki wydane przez uczelnię.\n\nZ poważaniem\n${name}\nul. Grzybowska 43A m. 12, 00-855 Warszawa`,
    },
  });
  await cc.create("documents", {
    id: ids.dean, kind: "letter", title: "Request to the dean’s office", status: "have", fileKey: null, pages: null, source: "agent",
    extractedFields: {
      triggeredBy: ids.letter, language: "en", to: `Dean’s office, ${uni}`, subject: "Certificate of enrolment for the voivodeship office",
      draft: `Dear Dean’s Office,\n\nThe Mazowiecki Voivodeship Office has asked me for a certificate confirming that I am enrolled and continuing my studies, for my residence case ${caseNo}. I need to send it by 25 November 2026.\n\nCould you please issue the certificate (zaświadczenie o kontynuacji nauki) in Polish? I can collect it in person or receive a signed PDF.\n\nThank you,\n${name}`,
    },
  });
  const arrived = new Date(now.getTime() - 9 * 60_000).toISOString();
  const called = new Date(now.getTime() - 4 * 60_000).toISOString();
  await cc.create("events", { id: ids.arrived, at: arrived, type: "email_received", summary: "Email from the voivodeship office: they ask for your certificate of enrolment by Wed 25 Nov.", refs: [ids.letter, ids.deadline, ids.reply, ids.dean] });
  await cc.create("events", { id: ids.call, at: called, type: "call", summary: "Preview scene: no real call was placed. In the product, Dossierly phones you about the new letter and sets the reminder you agree to.", refs: [ids.deadline, ids.reply, ids.dean] });
}
