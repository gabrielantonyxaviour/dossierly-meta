import type { Profile } from "@/lib/case/types";

export const STAGES: { id: Profile["stage"]; title: string; hint: string }[] = [
  { id: "just_arrived", title: "stageJustArrived", hint: "stageJustArrivedHint" },
  { id: "preparing_application", title: "stagePreparing", hint: "stagePreparingHint" },
  { id: "filed", title: "stageFiled", hint: "stageFiledHint" },
  { id: "waiting_decision", title: "stageWaiting", hint: "stageWaitingHint" },
  { id: "decision_received", title: "stageDecision", hint: "stageDecisionHint" },
];

export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] ?? "";
