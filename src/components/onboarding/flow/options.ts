import type { Profile } from "@/lib/case/types";
import type { T } from "@/lib/i18n/translate";

/** `id`/`permit` are stored values sent to the API; `title`/`hint` are message keys in the "onboarding" namespace. */
export type Reason = "study" | "work" | "family" | "other";
export const REASONS: { id: Reason; title: string; hint: string; permit: NonNullable<Profile["permitType"]> }[] = [
  { id: "study", title: "reasonStudy", hint: "reasonStudyHint", permit: "temporary_residence_study" },
  { id: "work", title: "reasonWork", hint: "reasonWorkHint", permit: "temporary_residence_work" },
  { id: "family", title: "reasonFamily", hint: "reasonFamilyHint", permit: "other" },
  { id: "other", title: "reasonOther", hint: "reasonOtherHint", permit: "other" },
];

export const STAGES: { id: Profile["stage"]; title: string; hint: string }[] = [
  { id: "just_arrived", title: "stageJustArrived", hint: "stageJustArrivedHint" },
  { id: "preparing_application", title: "stagePreparing", hint: "stagePreparingHint" },
  { id: "filed", title: "stageFiled", hint: "stageFiledHint" },
  { id: "waiting_decision", title: "stageWaiting", hint: "stageWaitingHint" },
  { id: "decision_received", title: "stageDecision", hint: "stageDecisionHint" },
];

/** City names stay in Polish: they are what the office and the letters use. */
export const CITIES = ["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Lublin", "Katowice", "Szczecin"];

/** "Studying" vs "Working" changes what we ask for and what the agent prepares. */
export const orgLabel = (permit: Profile["permitType"], reason: Reason | null, t: T) =>
  permit === "temporary_residence_study" ? { label: t("orgUniversity"), placeholder: t("orgUniversityPlaceholder") }
  : permit === "temporary_residence_work" ? { label: t("orgEmployer"), placeholder: t("orgEmployerPlaceholder") }
  : reason === "family" ? { label: t("orgFamily"), placeholder: t("orgFamilyPlaceholder") }
  : { label: t("orgOther"), placeholder: t("orgOtherPlaceholder") };

export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] ?? "";
