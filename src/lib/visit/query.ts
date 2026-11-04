import type { Appointment, CaseSnapshot } from "@/lib/case/types";

export const SEARCH_SYSTEM = [
  "You research what a foreign national must bring to an appointment at a Polish public office.",
  "Rely on official sources first: gov.pl (including /web/udsc and /web/uw-mazowiecki), migrant.wsc.mazowieckie.pl, mos.cudzoziemcy.gov.pl and isap.sejm.gov.pl.",
  "Use non-official sites only to fill gaps and say so. Never invent requirements, fees or addresses.",
  "Answer with a plain list of what to bring (originals, copies, photos, fees, confirmations), the office address and any rule about arriving, queueing or language. Mention anything you could not confirm.",
].join(" ");

const PERMIT: Record<string, string> = {
  temporary_residence_study: "temporary residence permit for studies",
  temporary_residence_work: "temporary residence and work permit",
};

export function purposeOf(appt: Appointment | null, purpose?: string): string {
  const p = purpose?.trim() || [appt?.title, appt?.purpose].filter(Boolean).join(": ");
  return p || "appointment";
}

const isFingerprint = (s: string) => /finger|biometr|odcisk/i.test(s);

export function buildQuery(snap: CaseSnapshot, appt: Appointment | null, purpose: string): string {
  const { profile } = snap;
  const permit = PERMIT[profile.permitType ?? ""] ?? "residence permit";
  const city = profile.city ?? "Warsaw";
  const where = appt?.location.name
    ? `${appt.location.name}${appt.location.address ? ` (${appt.location.address})` : ""}`
    : /warsaw|warszawa/i.test(city)
      ? "the Mazowiecki Voivodeship Office (Wydział Spraw Cudzoziemców, Warsaw)"
      : `the voivodeship office for foreigners in ${city}`;
  const what = isFingerprint(purpose) ? "fingerprint (biometrics)" : purpose;
  const office = /warsaw|warszawa/i.test(`${city} ${appt?.location.name ?? ""}`) ? " Mazowiecki Voivodeship Office (Wydział Spraw Cudzoziemców, Warsaw)." : "";
  return `What must a foreigner bring to a ${what} appointment at ${where} for a ${permit} in 2026? List the documents, copies, photos, fees and confirmations, and the office address.${office}`;
}

export function caseSummary(snap: CaseSnapshot): string {
  const p = snap.profile;
  const docs = snap.documents.map((d) => `${d.kind}:${d.status}`).join(", ") || "none";
  return `Permit: ${p.permitType ?? "unknown"}; city: ${p.city ?? "unknown"}; stage: ${p.stage}; organisation: ${p.organisation ?? "unknown"}; documents on file: ${docs}.`;
}

export const STRUCTURE_SYSTEM = [
  "Turn a web research answer into a visit checklist. Use ONLY what the research text states; never add requirements from memory.",
  "Return items: each one thing to bring or do, title a short noun phrase under 8 words that does not start with the word Bring (for example: Valid passport), detail one plain sentence, id a short lowercase slug.",
  "sourceIdx is the number of the source (from the numbered list) that supports the item, or null if none does.",
  "matchKind is the closest document kind the user may hold: passport, rental_agreement, health_insurance, university_certificate, photo, upo, letter, other; use null for things that are not documents (fees, arriving early, an appointment confirmation).",
  "office is the office name and address if stated, else null. warnings lists conflicts, uncertainty or gaps in the research. At most 10 items.",
].join(" ");
