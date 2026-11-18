import type { HouseholdMember, PermitType, Voivodeship } from "@/lib/case/types";

/*
 * Residence-case reference data. Sources (research of 13 Nov 2026, ~/Documents/poland/dossierly/research):
 *  - waits: MSWiA reply to interpellation 18089, 27 Jul 2026, average days for temporary permits in 2026;
 *  - fees: Ustawa o opłacie skarbowej (Dz.U. 2026 poz. 1395) annex part III pkt 2 (340 zł) and 2b (440 zł);
 *    card fee 100 zł, 50 zł under 16 (Mazowieckie fee table); two separate transfers (UdSC "Informacje o opłatach");
 *  - family: art. 159 ust. 1 (sponsor on a single permit needs 2 years of permits), income 823 zł per person (MOS Q&A).
 * Names stay in Polish: they are what the office and its letters use.
 */

export type VoivodeshipInfo = { name: string; seat: string; avgDays2026: number };

export const VOIVODESHIP_INFO: Record<Voivodeship, VoivodeshipInfo> = {
  dolnoslaskie: { name: "Dolnośląskie", seat: "Wrocław", avgDays2026: 303 },
  kujawsko_pomorskie: { name: "Kujawsko-Pomorskie", seat: "Bydgoszcz", avgDays2026: 541 },
  lubelskie: { name: "Lubelskie", seat: "Lublin", avgDays2026: 386 },
  lubuskie: { name: "Lubuskie", seat: "Gorzów Wielkopolski", avgDays2026: 555 },
  lodzkie: { name: "Łódzkie", seat: "Łódź", avgDays2026: 386 },
  malopolskie: { name: "Małopolskie", seat: "Kraków", avgDays2026: 242 },
  mazowieckie: { name: "Mazowieckie", seat: "Warszawa", avgDays2026: 394 },
  opolskie: { name: "Opolskie", seat: "Opole", avgDays2026: 510 },
  podkarpackie: { name: "Podkarpackie", seat: "Rzeszów", avgDays2026: 302 },
  podlaskie: { name: "Podlaskie", seat: "Białystok", avgDays2026: 447 },
  pomorskie: { name: "Pomorskie", seat: "Gdańsk", avgDays2026: 598 },
  slaskie: { name: "Śląskie", seat: "Katowice", avgDays2026: 658 },
  swietokrzyskie: { name: "Świętokrzyskie", seat: "Kielce", avgDays2026: 325 },
  warminsko_mazurskie: { name: "Warmińsko-Mazurskie", seat: "Olsztyn", avgDays2026: 273 },
  wielkopolskie: { name: "Wielkopolskie", seat: "Poznań", avgDays2026: 339 },
  zachodniopomorskie: { name: "Zachodniopomorskie", seat: "Szczecin", avgDays2026: 465 },
};

export const DEFAULT_VOIVODESHIP: Voivodeship = "mazowieckie";

/** The four grounds the residence flow covers, as stored permit types. */
export const GROUNDS = ["temporary_residence_work", "temporary_residence_blue_card", "temporary_residence_family", "temporary_residence_study"] as const satisfies readonly PermitType[];
export type Ground = (typeof GROUNDS)[number];
export const isGround = (p: string | null | undefined): p is Ground => !!p && (GROUNDS as readonly string[]).includes(p);

/** Stamp duty (zł) to the city office at the voivode's seat: 440 for work and Blue Card, 340 for family and study. */
export const stampDuty = (p: PermitType | null | undefined): number =>
  p === "temporary_residence_work" || p === "temporary_residence_blue_card" ? 440 : 340;

/** Residence card fee (zł) to the voivodeship office: 100, or 50 for a child under 16. */
export const cardFee = (under16: boolean): number => (under16 ? 50 : 100);

/** Net monthly income the household needs for a family permit: 823 zł per person, sponsor included (MOS Q&A, since 1 Jan 2025). */
export const FAMILY_INCOME_PER_PERSON = 823;
export const familyIncomeNeeded = (members: number): number => FAMILY_INCOME_PER_PERSON * (1 + members);

/** Under 16 on `onDate` from a birth year alone: true only when certainly under 16 (born after onDate's year minus 16). */
export function under16From(birthYear: number | null, onDate: string): boolean {
  if (!birthYear) return false;
  return Number(onDate.slice(0, 4)) - birthYear < 16;
}

export type FeeLine = { who: string; memberId: string; stamp: number; card: number };

/** One stamp-duty and one card-fee transfer per person: never one transfer for several people. */
export function feeLines(own: { name: string; permitType: PermitType | null }, household: HouseholdMember[]): FeeLine[] {
  return [
    { who: own.name, memberId: "me", stamp: stampDuty(own.permitType), card: cardFee(false) },
    ...household.map((m) => ({ who: m.name, memberId: m.id, stamp: stampDuty(m.permitType), card: cardFee(m.under16) })),
  ];
}

export const feeTotal = (lines: FeeLine[]): number => lines.reduce((n, l) => n + l.stamp + l.card, 0);

/** Free legal aid and a lawyer directory. Dossierly is not a law firm and never picks one for you. */
export const LEGAL_HELP = [
  { id: "sip", name: "Stowarzyszenie Interwencji Prawnej (SIP)", url: "https://interwencjaprawna.pl/en/" },
  { id: "ocalenie", name: "Fundacja Ocalenie", url: "https://ocalenie.org.pl/en" },
  { id: "npp", name: "Nieodpłatna pomoc prawna", url: "https://np.ms.gov.pl/" },
  { id: "lawyer", name: "Krajowa Rada Radców Prawnych", url: "https://rejestr.kirp.pl/" },
] as const;
