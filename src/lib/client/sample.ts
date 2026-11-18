import type { Case, Language } from "./types";
import { tNow } from "@/lib/i18n/current";

export const MAZOWIECKI = "Wydział Spraw Cudzoziemców MUW - Marszałkowska";

export const OFFICES = [
  "Wydział Spraw Cudzoziemców MUW - Marszałkowska",
  "Wydział Spraw Cudzoziemców MUW - Aleje Jerozolimskie",
  "Wydział Spraw Cudzoziemców MUW - plac Bankowy (wejście G)",
  "Wydział Spraw Cudzoziemców MUW - Krucza (wejście E)",
];

/** SAMPLE: fictional person and case number, used only for the demo case. */
export function sampleCase(): Case {
  return {
    id: "case-sample-arjun",
    country: "pl",
    type: "temporary_residence_work",
    office: MAZOWIECKI,
    caseNumber: "WSC-II-P.6151.48213.2026",
    profile: { name: "Arjun Raman", language: "en" },
    events: [
      {
        id: "ev-mos-0602",
        date: "2026-06-02",
        kind: "note",
        title: "Applied online through MOS",
        summary:
          "Temporary residence and work permit application filed in MOS (Moduł Obsługi Spraw) and signed with profil zaufany. UPO saved. Stamp duty 440 zł and card fee 100 zł paid.",
      },
      {
        id: "ev-fp-0918",
        date: "2026-09-18",
        kind: "appointment",
        title: "Fingerprints at Marszałkowska 3/5",
        summary:
          "Fingerprints taken. Passport, photo and fee receipts accepted. The official said proof of health insurance for the whole stay is missing from the application and that a letter (wezwanie) will follow by e-Doręczenia or post.",
      },
    ],
    documents: [
      { name: "Passport (all pages)", have: true },
      { name: "Photo 35×45 mm", have: true },
      { name: "Stamp duty receipt 440 zł", have: true },
      { name: "Card fee receipt 100 zł", have: true },
      { name: "Employer attachment no. 1 (Załącznik nr 1)", have: true },
      { name: "Rental agreement (umowa najmu)", have: true },
      { name: "Proof of health insurance for the whole stay", have: false },
    ],
    deadlines: [],
  };
}

export function emptyCase(name: string, language: Language, office: string): Case {
  return {
    id: `case-${crypto.randomUUID().slice(0, 8)}`,
    country: "pl",
    type: "temporary_residence_work",
    office,
    profile: { name, language },
    events: [],
    documents: [],
    deadlines: [],
  };
}

const lang = (code: Language, native: string, speech: string) => ({
  /** The language's name in the interface language, read at use time. */
  get label() { return tNow("shell")(`lang_${code}`); },
  native,
  speech,
});

export const LANGUAGE_NAMES: Record<Language, { label: string; native: string; speech: string }> = {
  en: lang("en", "English", "en-GB"),
  ru: lang("ru", "Русский", "ru-RU"),
  zh: lang("zh", "中文", "zh-CN"),
  ja: lang("ja", "日本語", "ja-JP"),
  vi: lang("vi", "Tiếng Việt", "vi-VN"),
  uk: lang("uk", "Українська", "uk-UA"),
  hi: lang("hi", "हिन्दी", "hi-IN"),
  ta: lang("ta", "தமிழ்", "ta-IN"),
};
