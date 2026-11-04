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

/** Canonical film data (coordinator, 4 Nov): shared by the seed, sample emails, extraction checks and voice scripts. */
export const ARJUN = {
  caseNumber: "WSC-II-P.6151.48213.2026",
  filedAt: "2026-09-18",
  dorm: "DS Babilon, ul. Kickiego 12, 04-369 Warszawa",
  flat: "ul. Grzybowska 43A m. 12, 00-855 Warszawa",
  movedOn: "2026-10-01",
  summonsDated: "2026-10-22",
  summonsDelivered: "2026-11-04",
  office: "Mazowiecki Urząd Wojewódzki, Wydział Spraw Cudzoziemców",
  fingerprintsAt: "ul. Marszałkowska 3/5, 00-624 Warszawa",
} as const;

export function buildArjunSeed(today: string) {
  const at = (days: number, time = "09:00") => warsawIso(addDays(today, days), time);
  const delivered = ARJUN.summonsDelivered;
  const replyBy = nextWorkingDay(addDays(delivered, 14));

  return {
    profile: {
      fullName: "Arjun Raman",
      preferredLanguage: "en",
      country: "PL" as const,
      city: "Warsaw",
      permitType: "temporary_residence_study" as const,
      stage: "waiting_decision" as const,
      organisation: "Warsaw University of Technology (MSc Computer Science)",
      arrivalDate: "2026-09-10",
      // Demo account: calls on (Twilio calls DEMO_CALL_NUMBER; no number is stored in the seed).
      phone: { number: null, verified: true, callsEnabled: true },
      timezone: "Europe/Warsaw",
    },
    facts: {
      caseNumber: { value: ARJUN.caseNumber, source: { type: "email" as const, ref: "MOS filing confirmation" }, confirmedByUser: true },
      office: { value: ARJUN.office, source: { type: "email" as const, ref: null }, confirmedByUser: true },
      filedAt: { value: ARJUN.filedAt, source: { type: "email" as const, ref: "MOS filing confirmation" }, confirmedByUser: true },
      upoReceivedAt: { value: ARJUN.filedAt, source: { type: "email" as const, ref: "UPO receipt" }, confirmedByUser: true },
      mosStatus: { value: "Złożony (filed)", source: { type: "email" as const, ref: "MOS filing confirmation" }, confirmedByUser: true },
    },
    documents: [
      { id: "doc-passport", kind: "passport" as const, title: "Passport (India)", status: "have" as const, pages: 32, source: "scan" as const, extractedFields: { holder: "Arjun Raman", expires: "2031-03-14" } },
      {
        id: "doc-upo", kind: "upo" as const, title: "MOS filing confirmation (UPO)", status: "have" as const, source: "email" as const,
        extractedFields: { caseNumber: ARJUN.caseNumber, filedAt: ARJUN.filedAt, applicationAddress: ARJUN.dorm },
      },
      {
        id: "doc-rental", kind: "rental_agreement" as const, title: "Lease, ul. Grzybowska 43A m. 12", status: "have" as const, pages: 6, source: "email" as const,
        extractedFields: { address: ARJUN.flat, startDate: ARJUN.movedOn },
      },
      {
        id: "doc-health", kind: "health_insurance" as const, title: "NFZ student health insurance", status: "have" as const, source: "email" as const,
        extractedFields: { insurer: "NFZ (voluntary, student)", cover: "Whole stay" },
      },
      { id: "doc-photo", kind: "photo" as const, title: "New photo 35×45 mm meeting the requirements", status: "missing" as const, source: "user" as const, extractedFields: { requestedBy: "Summons of 22 Oct" } },
      {
        id: "doc-wezwanie", kind: "letter" as const, title: "Wezwanie: summons to complete the application", status: "have" as const, pages: 2, source: "email" as const,
        extractedFields: {
          sender: "Mazowiecki Urząd Wojewódzki", dated: ARJUN.summonsDated, delivered, addressedTo: ARJUN.dorm,
          asks: "lease; insurance for the whole stay; new photo", within: "14 days from delivery (KPA art. 64 § 2)",
        },
      },
    ],
    deadlines: [
      {
        id: "dl-summons", title: "Reply to the summons", dueDate: replyBy, triggeredBy: "doc-wezwanie", status: "open" as const,
        computation: {
          steps: [
            `Summons dated ${ARJUN.summonsDated}, delivered on ${delivered}`,
            "14 days from delivery per the summons (KPA art. 64 § 2)",
            `Delivery date + 14 days = ${addDays(delivered, 14)}`,
            "Not a Sunday or public holiday in Poland",
          ],
          rule: "KPA art. 64 § 2", legalRefUrl: LEGAL_URL,
        },
        reminders: [{ at: warsawIso(addDays(replyBy, -2), "09:00"), channel: "in_app" as const, sentAt: null }],
      },
      {
        id: "dl-filed", title: "Submit application within legal stay", dueDate: ARJUN.filedAt, status: "done" as const, triggeredBy: null,
        computation: { steps: ["Application must be filed while the visa or stay is still valid", `Filed in MOS on ${ARJUN.filedAt}, before the stay expired`], rule: "Ustawa o cudzoziemcach, art. 139a", legalRefUrl: null },
        reminders: [],
      },
    ],
    appointments: [
      {
        id: "apt-fingerprints", title: "Fingerprints", at: warsawIso(today, "10:40"),
        location: { name: "Mazowiecki Urząd Wojewódzki", address: ARJUN.fingerprintsAt },
        purpose: "Fingerprints for the residence card (karta pobytu)", prepTaskIds: ["task-passport"],
      },
    ],
    tasks: [
      { id: "task-photo", title: "Get a new photo that meets the requirements", detail: "The summons asks for a new 35×45 mm photo. The lease and the insurance are already in your case.", dueDeadlineId: "dl-summons", origin: "letter" as const, status: "open" as const },
      { id: "task-reply", title: "Send the lease and insurance with your reply", detail: "Both came in by email and are in your case.", dueDeadlineId: "dl-summons", origin: "letter" as const, status: "open" as const },
      { id: "task-passport", title: "Bring your original passport to fingerprints", detail: "Take the original passport and the case number.", dueDeadlineId: null, origin: "agent" as const, status: "open" as const },
    ],
    events: [
      { id: "ev-calendar", at: at(0, "08:21"), type: "note" as const, summary: "Added to Google Calendar with reminders: fingerprints today 10:40; reply to the summons by Wed 18 Nov", refs: ["apt-fingerprints", "dl-summons"] },
      { id: "ev-read", at: at(0, "08:20"), type: "letter_read" as const, summary: "Read the summons: the office asks for your lease, health insurance and a new photo within 14 days", refs: ["doc-wezwanie"] },
      { id: "ev-deadline", at: at(0, "08:19"), type: "deadline_created" as const, summary: "Created a deadline to reply to the summons", refs: ["dl-summons"] },
      { id: "ev-email", at: at(-1, "21:40"), type: "email_received" as const, summary: "Email from the voivodeship office: summons to complete your application", refs: ["doc-wezwanie"] },
      { id: "ev-lease", at: at(-20, "10:05"), type: "document_added" as const, summary: "Lease for ul. Grzybowska 43A m. 12 from your landlord's email (from 1 Oct)", refs: ["doc-rental"] },
      { id: "ev-note", at: warsawIso(ARJUN.filedAt, "15:30"), type: "note" as const, summary: "Case filed in MOS with the dorm address (DS Babilon)", refs: ["doc-upo"] },
    ],
  };
}

export type ArjunSeed = ReturnType<typeof buildArjunSeed>;
