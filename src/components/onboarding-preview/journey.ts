import type { T } from "@/lib/i18n/translate";
import { sampleFor, type Answers, type Need } from "./content";

export type Demo = { phase: number; action: string; skipped: boolean; evidence: "request" | "detail" };
export type Demos = Partial<Record<Need, Demo>>;
export const freshDemo = (need: Need, t: T): Demo => ({ phase: 0, action: sampleFor(need, t).action, skipped: false, evidence: "request" });
export const orderedNeeds = (answers: Answers): Need[] => answers.main
  ? [answers.main, ...answers.needs.filter((need) => need !== answers.main)] : answers.needs;
export const resolved = (demo: Demo | undefined) => !!demo && (demo.phase === 3 || demo.skipped);
export const demoStatus = (demo: Demo | undefined, t: T) =>
  t(demo?.phase === 3 ? "statusReviewed" : demo?.skipped ? "statusSkipped" : demo?.phase ? "statusInProgress" : "statusNotStarted");

export function reconcileDemos(selected: Need[], current: Demos, t: T): Demos {
  return Object.fromEntries(selected.map((need) => [need, current[need] ?? freshDemo(need, t)]));
}

export function nextPending(order: Need[], active: Need, demos: Demos): Need | undefined {
  const index = order.indexOf(active);
  return [...order.slice(index + 1), ...order.slice(0, index + 1)].find((need) => !resolved(demos[need]));
}
