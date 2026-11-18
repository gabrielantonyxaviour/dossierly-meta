import { addDays } from "@/lib/legal/calendar";
import { warsawDate, warsawToday } from "@/lib/case/next-step";
import type { CaseSnapshot, ResidenceStage } from "@/lib/case/types";
import { checklist } from "@/lib/residence/checklist";
import { daysSinceFiling, fileByDate, renewalPrepDate } from "@/lib/residence/dates";
import { DEFAULT_VOIVODESHIP, VOIVODESHIP_INFO } from "@/lib/residence/model";
import { nextAppointment, openLetterDeadline } from "@/lib/residence/stage";
import type { T } from "@/lib/i18n/translate";
import type { PathItem } from "@/components/residence/parts";
import { monthYear, shortDate } from "./format";

/** The filing date the case knows (typed in or read from the UPO). */
export const filedOn = (c: CaseSnapshot): string | null => c.facts.filedAt?.value?.slice(0, 10) ?? c.facts.upoReceivedAt?.value?.slice(0, 10) ?? null;

export const regionOf = (c: CaseSnapshot) => VOIVODESHIP_INFO[c.profile.voivodeship ?? DEFAULT_VOIVODESHIP];

/** Stages 1..7 as a case path, each with what the case knows about it. Links open the stage screens. */
export function casePath(c: CaseSnapshot, t: T): PathItem[] {
  const p = c.profile;
  const today = warsawToday();
  const filed = filedOn(c);
  const items = checklist(c);
  const done = items.filter((i) => i.done).length;
  const region = regionOf(c);
  const letter = openLetterDeadline(c);
  const letters = c.documents.filter((d) => d.kind === "letter").length;
  const appt = nextAppointment(c);
  const d = p.decision;
  const expected = filed ? addDays(filed, region.avgDays2026) : null;
  const href = (s: ResidenceStage) => `/app/residence/${s}`;
  return [
    { id: "prepare", href: href("prepare"), title: t("pathPrepare"), date: filed ? t("done") : p.legalStayUntil ? t("byDate", { date: shortDate(fileByDate(p.legalStayUntil)) }) : "", detail: t("pathPrepareDetail", { done, total: items.length }) },
    { id: "file", href: href("file"), title: t("pathFile"), date: filed ? shortDate(filed) : p.legalStayUntil ? t("byDate", { date: shortDate(fileByDate(p.legalStayUntil)) }) : "", detail: filed ? (c.facts.caseNumber ? t("pathFiledCase", { no: c.facts.caseNumber.value }) : t("pathFiledDetail")) : t("pathFileDetail") },
    { id: "waiting", href: href("waiting"), title: t("pathWaiting"), date: filed ? t("dayN", { n: daysSinceFiling(filed, today) }) : "", detail: t("pathWaitingDetail") },
    { id: "letter", href: href("letter"), title: t("pathLetter"), date: letter ? t("byDate", { date: shortDate(letter.dueDate) }) : letters ? t("lettersN", { n: letters }) : t("ifAny"), detail: letter ? t("pathLetterOpen") : t("pathLetterDetail") },
    { id: "visit", href: href("visit"), title: t("pathVisit"), date: appt ? shortDate(warsawDate(appt.at)) : t("officeSetsDate"), detail: t("pathVisitDetail") },
    { id: "decision", href: href("decision"), title: t("pathDecision"), date: d ? shortDate(d.deliveredOn) : expected ? t("aroundDate", { date: monthYear(expected) }) : "", detail: d ? t(d.outcome === "approved" ? "pathApproved" : "pathRefused") : t("pathDecisionDetail", { region: region.name, n: region.avgDays2026 }) },
    { id: "after", href: href("after"), title: t("pathAfter"), date: d?.cardCollectedOn ? shortDate(d.cardCollectedOn) : t("afterDecision"), detail: d?.validUntil ? t("pathRenewal", { date: shortDate(renewalPrepDate(d.validUntil)) }) : t("pathAfterDetail") },
  ];
}
