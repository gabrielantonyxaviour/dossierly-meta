/** Demo case for "Arjun Raman", used by the local-only /api/dev/demo sign-in. Dates are relative to `today`. */

const LEGAL_URL = "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19600300168";
const FIXED_HOLIDAYS = new Set(["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-25", "12-26"]);

export const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const isSunday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0;
const isHoliday = (d: string) => FIXED_HOLIDAYS.has(d.slice(5));
const nextWorkingDay = (d: string): string => (isSunday(d) || isHoliday(d) ? nextWorkingDay(addDays(d, 1)) : d);

/** ISO timestamp for a Europe/Warsaw wall-clock moment, with the correct UTC offset for that date. */
export function warsawIso(date: string, time: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "longOffset" }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const offset = part === "GMT" ? "+00:00" : part.replace("GMT", "");
  return `${date}T${time}:00${offset}`;
}

export function buildArjunSeed(today: string) {
  const at = (days: number, time = "09:00") => warsawIso(addDays(today, days), time);
  const delivered = addDays(today, -1);
  const replyBy = nextWorkingDay(addDays(delivered, 7) > addDays(today, 6) ? addDays(today, 6) : addDays(delivered, 7));
  const fingerprintDay = addDays(today, 9);
  const stay = addDays(today, -43);

  return {
    profile: {
      fullName: "Arjun Raman",
      preferredLanguage: "en",
      country: "PL" as const,
      city: "Warsaw",
      permitType: "temporary_residence_study" as const,
      stage: "waiting_decision" as const,
      organisation: "Warsaw University of Technology (MSc Computer Science)",
      arrivalDate: "2026-09-22",
      phone: { number: null, verified: false, callsEnabled: false },
      timezone: "Europe/Warsaw",
    },
    facts: {
      caseNumber: { value: "WSC-II-P.6151.48213.2026", source: { type: "email" as const, ref: "Mazowiecki Urząd Wojewódzki email" }, confirmedByUser: true },
      office: { value: "Mazowiecki Urząd Wojewódzki, Wydział Spraw Cudzoziemców", source: { type: "email" as const, ref: null }, confirmedByUser: true },
      filedAt: { value: "2026-10-06", source: { type: "user" as const, ref: null }, confirmedByUser: true },
      upoReceivedAt: { value: "2026-10-06", source: { type: "email" as const, ref: "UPO receipt" }, confirmedByUser: true },
      mosStatus: { value: "Złożony (filed)", source: { type: "screenshot" as const, ref: "MOS status screenshot" }, confirmedByUser: true },
    },
    documents: [
      { id: "doc-passport", kind: "passport" as const, title: "Passport (India)", status: "have" as const, pages: 32, source: "scan" as const, extractedFields: { holder: "Arjun Raman", expires: "2031-03-14" } },
      { id: "doc-enrol", kind: "university_certificate" as const, title: "University enrolment certificate", status: "have" as const, source: "upload" as const, extractedFields: { university: "Warsaw University of Technology", programme: "MSc Computer Science" } },
      { id: "doc-health", kind: "health_insurance" as const, title: "Health insurance policy (NFZ voluntary insurance)", status: "requested" as const, source: "email" as const, extractedFields: { requestedBy: "Wezwanie from the voivodeship office" } },
      { id: "doc-rental", kind: "rental_agreement" as const, title: "Rental agreement, Warsaw", status: "have" as const, pages: 6, source: "scan" as const, extractedFields: {} },
      { id: "doc-photo", kind: "photo" as const, title: "MOS photo 35x45 mm", status: "have" as const, source: "upload" as const, extractedFields: {} },
      { id: "doc-upo", kind: "upo" as const, title: "UPO receipt", status: "have" as const, source: "email" as const, extractedFields: { receivedAt: "2026-10-06" } },
      { id: "doc-wezwanie", kind: "letter" as const, title: "Wezwanie: summons to complete formal deficiencies", status: "have" as const, pages: 2, source: "email" as const, extractedFields: { sender: "Mazowiecki Urząd Wojewódzki", asks: "Proof of health insurance" } },
    ],
    deadlines: [
      {
        id: "dl-summons", title: "Reply to summons: submit missing health insurance", dueDate: replyBy, triggeredBy: "doc-wezwanie", status: "open" as const,
        computation: {
          steps: [
            `Letter delivered by email via e-Doręczenia on ${delivered}`,
            "7 days from delivery per the summons (KPA art. 64 § 2)",
            `Delivery date + 7 days = ${addDays(delivered, 7)}`,
            "Not a Sunday or public holiday in Poland",
          ],
          rule: "KPA art. 64 § 2", legalRefUrl: LEGAL_URL,
        },
        reminders: [{ at: warsawIso(addDays(replyBy, -2), "09:00"), channel: "in_app" as const, sentAt: null }],
      },
      {
        id: "dl-filed", title: "Submit application within legal stay", dueDate: stay, status: "done" as const, triggeredBy: null,
        computation: { steps: ["Application must be filed while the visa or stay is still valid", "Filed on 2026-10-06, before the stay expired"], rule: "Ustawa o cudzoziemcach, art. 139a", legalRefUrl: null },
        reminders: [],
      },
    ],
    appointments: [
      {
        id: "apt-fingerprints", title: "Fingerprint appointment", at: warsawIso(fingerprintDay, "10:30"),
        location: { name: "Mazowiecki Urząd Wojewódzki, Biuro Podawcze", address: "ul. Marszałkowska 3/5, 00-624 Warszawa" },
        purpose: "Fingerprints and photo for the residence card (karta pobytu)", prepTaskIds: ["task-passport"],
      },
    ],
    tasks: [
      { id: "task-insurance", title: "Buy NFZ voluntary health insurance", detail: "The summons asks for proof of health insurance. Voluntary NFZ insurance for students is one option; keep the policy PDF and the payment confirmation.", dueDeadlineId: "dl-summons", origin: "letter" as const, status: "open" as const },
      { id: "task-passport", title: "Bring original passport to fingerprint appointment", detail: "Take the original passport and the UPO receipt.", dueDeadlineId: null, origin: "agent" as const, status: "open" as const },
      { id: "task-upo", title: "Print UPO receipt", detail: "", dueDeadlineId: null, origin: "user" as const, status: "done" as const },
    ],
    events: [
      { id: "ev-counter", at: at(-1, "18:20"), type: "counter_session" as const, summary: "Practised the fingerprint appointment in Rehearse", refs: ["apt-fingerprints"] },
      { id: "ev-docadded", at: at(-1, "12:05"), type: "document_added" as const, summary: "Added the summons letter to your documents", refs: ["doc-wezwanie"] },
      { id: "ev-deadline", at: at(-1, "11:40"), type: "deadline_created" as const, summary: "Created a deadline to reply to the summons", refs: ["dl-summons"] },
      { id: "ev-read", at: at(-1, "11:30"), type: "letter_read" as const, summary: "Read the summons: the office asks for proof of health insurance within 7 days", refs: ["doc-wezwanie"] },
      { id: "ev-email", at: at(-1, "08:15"), type: "email_received" as const, summary: "Email from the voivodeship office: Wezwanie to complete formal deficiencies", refs: ["doc-wezwanie"] },
      { id: "ev-call", at: at(-12, "17:00"), type: "call" as const, summary: "Welcome call from Dossierly: explained your case, what the UPO means and what happens after filing", refs: [] },
      { id: "ev-note", at: at(-29, "15:30"), type: "note" as const, summary: "Case filed in MOS", refs: [] },
    ],
  };
}

export type ArjunSeed = ReturnType<typeof buildArjunSeed>;
