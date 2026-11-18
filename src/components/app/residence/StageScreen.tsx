"use client";
import type { CaseSnapshot, ResidenceStage } from "@/lib/case/types";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { nextAppointment } from "@/lib/residence/stage";
import { StageFrame } from "./StageFrame";
import { StartStage } from "./StartStage";
import { PrepareStage } from "./PrepareStage";
import { FileStage } from "./FileStage";
import { WaitingStage } from "./WaitingStage";
import { LetterStage } from "./LetterStage";
import { VisitStage } from "./VisitStage";
import { DecisionStage } from "./DecisionStage";
import { AfterStage } from "./AfterStage";

const SCREEN: Record<ResidenceStage, (p: { c: CaseSnapshot }) => React.ReactNode> = {
  start: StartStage, prepare: PrepareStage, file: FileStage, waiting: WaitingStage, letter: LetterStage, visit: VisitStage, decision: DecisionStage, after: AfterStage,
};

function title(t: T, stage: ResidenceStage, c: CaseSnapshot): string {
  if (stage === "letter") {
    const open = c.deadlines.some((d) => d.status === "open" && d.triggeredBy);
    return open ? t("titleLetterOpen") : t("titleLetter");
  }
  if (stage === "visit") return nextAppointment(c) ? t("titleVisit") : t("titleVisitNone");
  if (stage === "decision") return c.profile.decision ? t(c.profile.decision.outcome === "approved" ? "titleApproved" : "titleRefused") : t("titleDecision");
  return t(`title_${stage}`);
}

/** One residence stage screen with its loading and error states. */
export function ResidenceStageScreen({ stage }: { stage: ResidenceStage }) {
  const t = useT("residence");
  const Screen = SCREEN[stage];
  return <StageFrame stage={stage} title={(c) => title(t, stage, c)}>{(c) => <Screen c={c} />}</StageFrame>;
}
