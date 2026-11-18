/*
 * The three different summonses in a temporary residence case, and the art. 112a decision-clock notice.
 * Pure data and helpers. Statements here follow the official texts read in the research
 * (KPA Dz. U. 2025 poz. 1691; Ustawa o cudzoziemcach as amended by Dz. U. 2025 poz. 1794; Dz. U. 2026 poz. 203).
 * Only the quotes marked `quotePl` are verbatim; consequences are described, never quoted from memory.
 * Not legal advice.
 */
import { quote } from "./articles";

export type SummonsKind = "formal-defect" | "evidence-documents" | "personal-appearance";

export interface SummonsRule {
  kind: SummonsKind;
  basis: string;
  minDays: number;
  /** Where the minimum counts from. KPA art. 64 §2 names no start event; the Act on Foreigners counts from delivery. */
  from: "delivery" | "unspecified";
  quotePl: string | null;
  consequence: { code: "left-without-consideration" | "clock-starts" | "discontinuation"; basis: string; en: string };
}

export const SUMMONS_RULES: Record<SummonsKind, SummonsRule> = {
  "formal-defect": {
    kind: "formal-defect",
    basis: "KPA art. 64 §2",
    minDays: 7,
    from: "unspecified",
    quotePl: quote("kpa64", "2"),
    consequence: {
      code: "left-without-consideration",
      basis: "KPA art. 64 §2",
      en: "If the defects are not fixed in time, the application is left without consideration (pozostawienie bez rozpoznania).",
    },
  },
  "evidence-documents": {
    kind: "evidence-documents",
    basis: "Ustawa o cudzoziemcach art. 106f",
    minDays: 14,
    from: "delivery",
    quotePl: quote("uoc106f", "1"),
    consequence: {
      code: "clock-starts",
      basis: "Ustawa o cudzoziemcach art. 112a ust. 2 pkt 3",
      en: "If the period lapses unused, the 60-day decision period starts then (art. 112a ust. 2 pkt 3). No further consequence is claimed here.",
    },
  },
  "personal-appearance": {
    kind: "personal-appearance",
    basis: "Ustawa o cudzoziemcach art. 106e ust. 1",
    minDays: 7,
    from: "delivery",
    quotePl: "wojewoda wzywa cudzoziemca do osobistego stawiennictwa w terminie nie krótszym niż 7 dni od dnia doręczenia wezwania",
    consequence: {
      code: "discontinuation",
      basis: "Ustawa o cudzoziemcach art. 106i ust. 1",
      en: "If you do not appear (fingerprints, passport, signature), the proceedings are discontinued (umorzenie, art. 106i). This is not the same as being left without consideration.",
    },
  },
};

/** Maps a letter-type id from hub/poland/coverage.json to its summons rule. */
export function summonsForLetterType(letterTypeId: string): SummonsRule | null {
  if (letterTypeId === "wezwanie-braki-formalne") return SUMMONS_RULES["formal-defect"];
  if (letterTypeId === "wezwanie-dokumenty") return SUMMONS_RULES["evidence-documents"];
  if (letterTypeId === "fingerprint-appointment") return SUMMONS_RULES["personal-appearance"];
  return null;
}

/** Act of 12 Mar 2022 art. 100d (as extended by Dz. U. 2026 poz. 203): "W okresie do dnia 4 marca 2027 r." */
export const DECISION_CLOCK_SUSPENDED_THROUGH = "2027-03-04";

export interface DecisionClockNotice {
  suspended: boolean;
  /** Always false while suspended: an "overdue office" must not be shown as a legal fact. */
  mayShowOverdue: boolean;
  text: string;
}

export function decisionClockNotice(todayIso: string): DecisionClockNotice {
  const suspended = todayIso <= DECISION_CLOCK_SUSPENDED_THROUGH;
  return suspended
    ? {
        suspended,
        mayShowOverdue: false,
        text: "The 60-day decision period (art. 112a) does not start to run until after 4 March 2027 (art. 100d of the Act of 12 March 2022, Dz. U. 2026 poz. 203). Until then a long wait is not a legal delay by the office.",
      }
    : { suspended, mayShowOverdue: true, text: "The 60-day decision period in art. 112a applies. Check the letters for when it started." };
}

/** Deemed delivery for e-Doręczenia: the day after 14 days from arrival if not collected (art. 42 of the e-delivery act). */
export const E_DORECZENIA_DEEMED_DAYS = 14;
