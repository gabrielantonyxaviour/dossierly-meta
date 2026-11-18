import type { T } from "@/lib/i18n/translate";

/* Curated phrases stay in their own language on purpose; only the language names follow the interface. */
const LANGUAGES = [
  { value: "en", native: "English", key: "langEn", phrase: "One step at a time." },
  { value: "uk", native: "Українська", key: "langUk", phrase: "Крок за кроком." },
  { value: "ru", native: "Русский", key: "langRu", phrase: "Шаг за шагом." },
  { value: "hi", native: "हिन्दी", key: "langHi", phrase: "एक समय में एक कदम।" },
  { value: "ta", native: "தமிழ்", key: "langTa", phrase: "ஒரு நேரத்தில் ஒரு படி." },
  { value: "zh", native: "中文", key: "langZh", phrase: "一步一步来。" },
  { value: "ja", native: "日本語", key: "langJa", phrase: "一歩ずつ。" },
  { value: "vi", native: "Tiếng Việt", key: "langVi", phrase: "Từng bước một." },
];
export const languageOptions = (t: T) => LANGUAGES.map(({ value, native, key, phrase }) => {
  const local = t(key);
  return { value, phrase, label: local === native ? native : `${native} · ${local}` };
});

/* Stored values stay English; labels are translated. */
const REASONS = [["Work", "reasonWork"], ["Study", "reasonStudy"], ["Family", "reasonFamily"], ["Business", "reasonBusiness"], ["Other", "reasonOther"]] as const;
const STAGES = [["Planning to move", "stagePlanning"], ["Recently arrived", "stageArrived"], ["Preparing an application", "stagePreparing"],
  ["Waiting for a decision", "stageWaiting"], ["Renewing", "stageRenewing"], ["Not sure", "stageUnsure"]] as const;
export const reasons = REASONS.map(([value]) => value);
export const stages = STAGES.map(([value]) => value);
export const reasonLabel = (value: string, t: T) => { const key = REASONS.find(([v]) => v === value)?.[1]; return key ? t(key) : value; };
export const stageLabel = (value: string, t: T) => { const key = STAGES.find(([v]) => v === value)?.[1]; return key ? t(key) : value; };

export const needs = [{ value: "letters" }, { value: "documents" }, { value: "deadlines" }, { value: "appointments" }, { value: "communicate" }, { value: "updates" }] as const;
export type Need = (typeof needs)[number]["value"];
export const needDescription = (need: Need, t: T) => t(`${need}NeedDesc`);
export type { Tool } from "./providers";
export type Answers = { name: string; language: string; reason: string; stage: string; city: string; office: string; needs: Need[]; main: Need | "" };
export const emptyAnswers = (): Answers => ({ name: "", language: "en", reason: "", stage: "", city: "", office: "", needs: [], main: "" });
export const officeRelevant = (stage: string) => ["Preparing an application", "Waiting for a decision", "Renewing"].includes(stage);
export const needLabel = (need: Need | "", t: T) => need ? t(`${need}Need`) : t("choosePriority");

export type Sample = { title: string; kind: string; actionLabel: string; action: string; firstAction: string; plan: string[] };
/** The fictional example for one kind of help, in the interface language. */
export const sampleFor = (need: Need, t: T): Sample => ({
  title: t(`${need}Title`), kind: t(`${need}Kind`), actionLabel: t(`${need}ActionLabel`), action: t(`${need}Action`),
  firstAction: t(`${need}FirstAction`), plan: [t(`${need}Plan1`), t(`${need}Plan2`), t(`${need}Plan3`)],
});

export const stepsFor = (t: T) => [1, 2, 3, 4, 5].map((n) => ({ label: t(`step${n}Label`), title: t(`step${n}Title`), description: t(`step${n}Desc`) }));
