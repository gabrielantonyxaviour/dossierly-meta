import { warsawDate, warsawToday } from "@/lib/case/next-step";
import { RESIDENCE_STAGES, type CaseSnapshot, type Profile, type ResidenceStage } from "@/lib/case/types";

/*
 * Where a residence case stands on the 8-stage path. The stored position covers what only the person knows
 * (setting up, preparing, filing); later stages follow the case data: a UPO / filing date means filed, an open
 * letter deadline means a letter is waiting for an answer, a coming appointment means the fingerprint visit,
 * a recorded decision means decision, a collected card means after.
 */

type OldStage = Profile["stage"];

/** Old 5-stage values (stored before the residence flow) onto the 8 stages. */
export const OLD_TO_NEW: Record<OldStage, ResidenceStage> = {
  just_arrived: "prepare",
  preparing_application: "prepare",
  filed: "waiting",
  waiting_decision: "waiting",
  decision_received: "decision",
};

/** The 8 stages back onto the old field, kept in sync for older readers (settings, agent context). */
export const NEW_TO_OLD: Record<ResidenceStage, OldStage> = {
  start: "just_arrived",
  prepare: "preparing_application",
  file: "preparing_application",
  waiting: "waiting_decision",
  letter: "waiting_decision",
  visit: "waiting_decision",
  decision: "decision_received",
  after: "decision_received",
};

export const stageIndex = (s: ResidenceStage): number => RESIDENCE_STAGES.indexOf(s);

/** The stored position, or the mapped old stage for a case set up before the residence flow. */
export function storedStage(p: Profile): ResidenceStage {
  return p.residenceStage ?? OLD_TO_NEW[p.stage] ?? "start";
}

/** An open deadline that came from a letter (triggered by a document) or a summons. */
export function openLetterDeadline(c: CaseSnapshot) {
  const letters = new Set(c.documents.filter((d) => d.kind === "letter").map((d) => d.id));
  return c.deadlines
    .filter((d) => d.status === "open" && (d.triggeredBy ? letters.has(d.triggeredBy) || d.triggeredBy.startsWith("doc_") : false))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}

/** The nearest appointment today or later. */
export function nextAppointment(c: CaseSnapshot, now = new Date()) {
  const today = warsawToday(now);
  return [...c.appointments].filter((a) => warsawDate(a.at) >= today).sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;
}

/** The stage the case is in now. */
export function currentStage(c: CaseSnapshot, now = new Date()): ResidenceStage {
  const p = c.profile;
  if (p.decision?.cardCollectedOn) return "after";
  if (p.decision) return "decision";
  let s = storedStage(p);
  const filed = !!c.facts.filedAt || !!c.facts.upoReceivedAt;
  if (filed && stageIndex(s) < stageIndex("waiting")) s = "waiting";
  if (s === "decision" || s === "after") return "decision"; // told us a decision came, not yet recorded
  if (stageIndex(s) >= stageIndex("waiting")) {
    if (openLetterDeadline(c)) return "letter";
    if (nextAppointment(c, now)) return "visit";
    return "waiting";
  }
  return s;
}

/** Profile patch that moves the case to `s`, keeping the old field in step. */
export const stagePatch = (s: ResidenceStage) => ({ residenceStage: s, stage: NEW_TO_OLD[s] });
