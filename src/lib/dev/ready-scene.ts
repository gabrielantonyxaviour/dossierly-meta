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

type SceneInput = { caseNumber?: string | null; organisation?: string | null; fullName?: string | null };

/** The scene's items (contract shapes a–d), without server-filled fields. Also used by the /kit layout fixture. */
export function readySceneItems(info: SceneInput, now = new Date()) {
  const today = warsawToday(now);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const caseNo = info.caseNumber ?? "WSC-II-P.6151.48213.2026";
  const uni = info.organisation ?? "your university";
  const name = info.fullName ?? "Arjun Raman";
  const documents = [
    {
      id: ids.letter, kind: "letter" as const, title: "Letter from the office: certificate of enrolment", status: "have" as const, fileKey: null, pages: 1, source: "email" as const,
      extractedFields: { received: today, sender: "Mazowiecki Urząd Wojewódzki", asks: "A certificate that you are enrolled and continuing your studies", deadline: "Wed 25 Nov 2026" } as Record<string, string>,
    },
    {
      id: ids.reply, kind: "letter" as const, title: "Reply to the office", status: "have" as const, fileKey: null, pages: null, source: "agent" as const,
      extractedFields: {
        triggeredBy: ids.letter, language: "pl", to: "Mazowiecki Urząd Wojewódzki, Wydział Spraw Cudzoziemców", subject: `Sygn. ${caseNo}: zaświadczenie o kontynuacji nauki`,
        draft: `Mazowiecki Urząd Wojewódzki w Warszawie\nWydział Spraw Cudzoziemców\nul. Marszałkowska 3/5, 00-624 Warszawa\n\nSygn. sprawy: ${caseNo}\n\nW odpowiedzi na pismo z dnia ${plDate(today)} w załączeniu przekazuję zaświadczenie o kontynuacji nauki wydane przez uczelnię.\n\nZ poważaniem\n${name}\nul. Grzybowska 43A m. 12, 00-855 Warszawa`,
      } as Record<string, string>,
    },
    {
      id: ids.dean, kind: "letter" as const, title: "Request to the dean’s office", status: "have" as const, fileKey: null, pages: null, source: "agent" as const,
      extractedFields: {
        triggeredBy: ids.letter, language: "en", to: `Dean’s office, ${uni}`, subject: "Certificate of enrolment for the voivodeship office",
        draft: `Dear Dean’s Office,\n\nThe Mazowiecki Voivodeship Office has asked me for a certificate confirming that I am enrolled and continuing my studies, for my residence case ${caseNo}. I need to send it by 25 November 2026.\n\nCould you please issue the certificate (zaświadczenie o kontynuacji nauki) in Polish? I can collect it in person or receive a signed PDF.\n\nThank you,\n${name}`,
      } as Record<string, string>,
    },
  ];
  const deadlines = [{
    id: ids.deadline, title: "Send the certificate of enrolment", dueDate: "2026-11-25", triggeredBy: ids.letter, status: "open" as const,
    computation: { steps: [`The letter reached you on ${today}`, "It names the date itself: 25 November 2026", "A Wednesday and a working day"], rule: "Date set in the letter", legalRefUrl: null },
    reminders: [{ at: warsawAt(tomorrow, "09:00"), channel: "call" as const, sentAt: null }],
  }];
  const events = [
    { id: ids.arrived, at: new Date(now.getTime() - 9 * 60_000).toISOString(), type: "email_received" as const, summary: "Email from the voivodeship office: they ask for your certificate of enrolment by Wed 25 Nov.", refs: [ids.letter, ids.deadline, ids.reply, ids.dean] },
    { id: ids.call, at: new Date(now.getTime() - 4 * 60_000).toISOString(), type: "call" as const, summary: "Preview scene: no real call was placed. In the product, Dossierly phones you about the new letter and sets the reminder you agree to.", refs: [ids.deadline, ids.reply, ids.dean] },
  ];
  return { documents, deadlines, events };
}

export async function writeReadyScene(userId: string, now = new Date()): Promise<void> {
  const cc = caseClient(userId);
  const snap = await cc.snapshot();
  for (const [kind, id] of [["documents", ids.letter], ["documents", ids.reply], ["documents", ids.dean], ["deadlines", ids.deadline], ["events", ids.arrived], ["events", ids.call]] as const) {
    if (snap[kind].some((x) => x.id === id)) await cc.remove(kind, id);
  }
  const items = readySceneItems({ caseNumber: snap.facts.caseNumber?.value, organisation: snap.profile.organisation, fullName: snap.profile.fullName }, now);
  for (const d of items.documents) await cc.create("documents", d);
  for (const d of items.deadlines) await cc.create("deadlines", d);
  for (const e of items.events) await cc.create("events", e);
}
