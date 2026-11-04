/*
 * SAMPLE case for Arjun Raman (fictional) so voice flows can be exercised on preview deployments.
 * Every record says "Sample" in its source or title. Never seeded in production.
 */
import type { CaseClient } from "../case/client";

export async function seedSampleCase(c: CaseClient): Promise<{ seeded: boolean }> {
  const snap = await c.snapshot();
  if (snap.documents.length || snap.deadlines.length || snap.facts.caseNumber) return { seeded: false };
  await c.patchProfile({
    fullName: "Arjun Raman", preferredLanguage: "en", city: "Warsaw", permitType: "temporary_residence_study",
    stage: "waiting_decision", organisation: "University of Warsaw (MSc Data Science)", arrivalDate: "2025-09-21",
  });
  const src = (ref: string) => ({ type: "letter" as const, ref, confirmedByUser: true });
  await c.patchFacts({
    caseNumber: { value: "WSC-II-P.6151.48213.2026", source: src("Sample wezwanie, 4 Nov 2026"), confirmedByUser: true },
    office: { value: "Mazowiecki Urząd Wojewódzki, Wydział Spraw Cudzoziemców, ul. Marszałkowska 3/5, Warszawa", source: src("Sample wezwanie"), confirmedByUser: true },
    filedAt: { value: "2026-08-12", source: { type: "email", ref: "Sample MOS filing confirmation", confirmedByUser: true }, confirmedByUser: true },
    upoReceivedAt: { value: "2026-08-12", source: { type: "email", ref: "Sample UPO", confirmedByUser: true }, confirmedByUser: true },
  });
  const doc = (id: string, kind: string, title: string, fields: Record<string, string>) =>
    c.create("documents", { id, kind, title, status: "have", source: "upload", pages: 1, extractedFields: fields });
  await doc("doc_passport", "passport", "Passport (sample)", { number: "Z7341982", nationality: "India", valid_until: "2033-03-14" });
  await doc("doc_lease", "rental_agreement", "Room lease, ul. Grochowska 212/14 (sample)", { address: "ul. Grochowska 212 m. 14, 04-357 Warszawa", from: "2025-10-01", until: "2026-12-31", rent: "1 900 zł / month" });
  await doc("doc_nfz", "health_insurance", "NFZ student health insurance confirmation (sample)", { insurer: "NFZ (voluntary student insurance)", valid_until: "2027-09-30" });
  await doc("doc_uni", "university_certificate", "University enrolment certificate (sample)", { programme: "MSc Data Science, year 2", issued: "2026-10-02" });
  await doc("doc_wezwanie", "letter", "Wezwanie: uzupełnienie braków (sample letter)", { received: "2026-11-04", asks: "Lease covering the stay; current enrolment certificate; 1 photo", deadline_days: "14" });
  const reply = await c.create("deadlines", {
    title: "Reply to the summons (uzupełnienie braków)", dueDate: "2026-11-18",
    computation: { steps: ["Letter delivered Wed 4 Nov 2026.", "The letter gives 14 days; delivery day is not counted.", "Day 14 is Wed 18 Nov 2026, a working day."], rule: "KPA art. 64 §2", legalRefUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19600300168" },
  });
  await c.create("appointments", {
    title: "Fingerprints (odciski palców)", at: "2026-11-12T09:40:00Z",
    location: { name: "Mazowiecki Urząd Wojewódzki", address: "ul. Marszałkowska 3/5, Warszawa" }, purpose: "Biometrics for the residence card. Bring passport and the summons.",
  });
  await c.create("tasks", { title: "Send the documents the summons asks for", detail: "Lease covering the whole stay, current enrolment certificate, one photo.", dueDeadlineId: reply.id, origin: "letter" });
  await c.create("events", { type: "letter_read", summary: "Sample wezwanie from MUW read: 14 days to supply missing documents.", refs: ["doc_wezwanie"] });
  return { seeded: true };
}
