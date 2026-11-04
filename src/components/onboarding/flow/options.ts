import type { Profile } from "@/lib/case/types";

export type Reason = "study" | "work" | "family" | "other";
export const REASONS: { id: Reason; title: string; hint: string; permit: NonNullable<Profile["permitType"]> }[] = [
  { id: "study", title: "I'm studying", hint: "Temporary residence for studies", permit: "temporary_residence_study" },
  { id: "work", title: "I'm working", hint: "Temporary residence and work", permit: "temporary_residence_work" },
  { id: "family", title: "I'm joining family", hint: "Family reunification", permit: "other" },
  { id: "other", title: "Something else", hint: "Research, business, other grounds", permit: "other" },
];

export const STAGES: { id: Profile["stage"]; title: string; hint: string }[] = [
  { id: "just_arrived", title: "I just landed", hint: "Haven't started the application yet" },
  { id: "preparing_application", title: "Preparing my application", hint: "Gathering documents for MOS" },
  { id: "filed", title: "I've filed it", hint: "Submitted in MOS, have or await the UPO" },
  { id: "waiting_decision", title: "Waiting for a decision", hint: "Fingerprints given or letters arriving" },
  { id: "decision_received", title: "I got a decision", hint: "Positive, negative or a card to collect" },
];

export const CITIES = ["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Lublin", "Katowice", "Szczecin"];

/** "Studying" vs "Working" changes what we ask for and what the agent prepares. */
export const orgLabel = (permit: Profile["permitType"], reason: Reason | null) =>
  permit === "temporary_residence_study" ? { label: "Your university", placeholder: "University of Warsaw" }
  : permit === "temporary_residence_work" ? { label: "Your employer", placeholder: "Company name as on your contract" }
  : reason === "family" ? { label: "Who you're joining (optional)", placeholder: "Spouse, parent…" }
  : { label: "Organisation (optional)", placeholder: "University, employer or sponsor" };

export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] ?? "";
