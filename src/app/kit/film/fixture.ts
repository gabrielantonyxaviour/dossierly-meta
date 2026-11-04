import { warsawToday } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { readySceneItems } from "@/lib/dev/ready-scene";

/*
 * LAYOUT FIXTURE for the preview-only /kit/film checks: the film's canonical case data (Arjun Raman, fictional) as a
 * plain snapshot, so A4/A8 screens can be phone-checked without signing in. Never shown in production; never recorded.
 */

function warsawAt(date: string, time: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "longOffset" }).formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  return `${date}T${time}:00${part === "GMT" ? "+00:00" : part.replace("GMT", "")}`;
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const DORM = "DS Babilon, ul. Kickiego 12, 04-369 Warszawa";
const FLAT = "ul. Grzybowska 43A m. 12, 00-855 Warszawa";

export function filmSnapshot(evening: boolean, now = new Date()): CaseSnapshot {
  const today = warsawToday(now);
  const created = now.toISOString();
  const src = (ref: string) => ({ type: "email" as const, ref });
  const snap: CaseSnapshot = {
    profile: {
      fullName: "Arjun Raman", preferredLanguage: "en", country: "PL", city: "Warsaw", permitType: "temporary_residence_study", stage: "waiting_decision",
      organisation: "Warsaw University of Technology (MSc Computer Science)", arrivalDate: "2026-09-12", phone: { number: null, verified: false, callsEnabled: false }, timezone: "Europe/Warsaw",
    } as CaseSnapshot["profile"],
    facts: {
      caseNumber: { value: "WSC-II-P.6151.48213.2026", source: src("MOS filing confirmation"), confirmedByUser: true },
      office: { value: "Mazowiecki Urząd Wojewódzki, Wydział Spraw Cudzoziemców", source: src("Summons, 22 Oct 2026"), confirmedByUser: true },
      filedAt: { value: "2026-09-18", source: src("MOS filing confirmation"), confirmedByUser: true },
    } as CaseSnapshot["facts"],
    documents: [
      { id: "doc-wezwanie", kind: "letter", title: "Wezwanie: summons to complete the application", status: "have", fileKey: null, pages: 2, source: "email", extractedFields: { dated: "2026-10-22", addressedTo: DORM, asks: "Lease; health insurance for the whole stay; a new photo" }, createdAt: created },
      { id: "doc-mos", kind: "upo", title: "MOS filing confirmation", status: "have", fileKey: null, pages: 1, source: "email", extractedFields: { applicationAddress: DORM }, createdAt: created },
      { id: "doc-lease", kind: "rental_agreement", title: "Lease, Grzybowska 43A/12", status: "have", fileKey: null, pages: 6, source: "email", extractedFields: { address: FLAT, startDate: "2026-10-01" }, createdAt: created },
      { id: "doc-nfz", kind: "health_insurance", title: "NFZ student insurance", status: "have", fileKey: null, pages: 1, source: "email", extractedFields: {}, createdAt: created },
      { id: "doc-photo", kind: "photo", title: "New photo (current requirements)", status: "missing", fileKey: null, pages: null, source: "email", extractedFields: {}, createdAt: created },
    ],
    deadlines: [{
      id: "dl-summons", title: "Reply to summons", dueDate: addDays(today, 14), triggeredBy: "doc-wezwanie", status: "open", createdAt: created,
      computation: { steps: [`The summons reached you on ${today}`, "14 days from delivery (KPA art. 64 § 2)"], rule: "KPA art. 64 § 2", legalRefUrl: null }, reminders: [],
    }],
    tasks: [{ id: "task-photo", title: "Get a new photo that meets the requirements", detail: "35×45 mm, plain light background.", dueDeadlineId: "dl-summons", origin: "letter", status: "open", createdAt: created }],
    events: [
      { id: "ev-email", at: warsawAt(today, "08:10"), type: "email_received", summary: "Email from the voivodeship office: summons to complete your application (dated 22 Oct)", refs: ["doc-wezwanie"], createdAt: created },
    ],
    appointments: [{
      id: "apt-fingerprints", title: "Fingerprints", at: warsawAt(today, "10:40"), createdAt: created,
      location: { name: "Mazowiecki Urząd Wojewódzki", address: "ul. Marszałkowska 3/5, 00-624 Warszawa" }, purpose: "Fingerprints for the residence card.", prepTaskIds: [],
    }],
  };
  if (!evening) return snap;
  const r = readySceneItems({ caseNumber: "WSC-II-P.6151.48213.2026", organisation: snap.profile.organisation, fullName: "Arjun Raman" }, now);
  snap.documents.push(...r.documents.map((d) => ({ ...d, createdAt: created })));
  snap.deadlines.push(...r.deadlines.map((d) => ({ ...d, createdAt: created })));
  snap.events.unshift(...r.events.map((e) => ({ ...e, createdAt: created })));
  return snap;
}
