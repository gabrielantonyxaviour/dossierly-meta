"use client";
import { ButtonLink } from "@/components/ui";
import type { CaseSnapshot } from "@/lib/case/types";
import { warsawToday } from "@/lib/case/next-step";
import { decisionClockNotice } from "@/lib/legal/summons";
import { daysSinceFiling, waitShare } from "@/lib/residence/dates";
import { useT } from "@/lib/i18n/client";
import { Block, CasePath, Fact, StatusLine } from "@/components/residence/parts";
import { casePath, filedOn, regionOf } from "./path";
import { shortDate } from "./format";

/* Stage 3 · Waiting: flight-status line (day N against the regional average), what is allowed now, the case path. */

export function WaitingStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const today = warsawToday();
  const filed = filedOn(c);
  const region = regionOf(c);
  const n = filed ? daysSinceFiling(filed, today) : 0;
  const work = c.profile.permitType === "temporary_residence_work" || c.profile.permitType === "temporary_residence_blue_card";
  const suspended = decisionClockNotice(today).suspended;
  return (
    <>
      {filed ? (
        <StatusLine word={t("waitingWord")} sub={t("waitingSub")} pct={waitShare(n, region.avgDays2026) * 100}
          left={t("dayN", { n })} right={t("avgDays", { n: region.avgDays2026 })} />
      ) : (
        <div className="rp-callout tone-user">
          <b>{t("noFilingDate")}</b>
          <span>{t("noFilingDateBody")}</span>
          <span className="rp-callout-hint"><ButtonLink href="/app/residence/file" size="sm" variant="secondary">{t("addFiling")}</ButtonLink></span>
        </div>
      )}
      <Block title={t("canDoNow")}>
        <div className="rp-stack">
          <Fact icon="shield" tone="ok" title={t("canStay")} sub={t("canStaySub")} />
          <Fact icon="alert" tone="deadline" title={t("noTravel")} sub={c.profile.legalStayUntil ? t("noTravelSubDate", { date: shortDate(c.profile.legalStayUntil) }) : t("noTravelSub")} />
          {work ? <Fact icon="case" tone="warn" title={t("jobChange")} sub={t("jobChangeSub")} />
            : <Fact icon="case" tone="warn" title={t("purposeEnds")} sub={t("purposeEndsSub")} />}
          <Fact icon="pin" tone="warn" title={t("moveDuring")} sub={t("moveDuringSub")} />
        </div>
      </Block>
      <Block title={t("yourCase")} aside={c.facts.caseNumber ? <span className="ui-meta ui-num">{c.facts.caseNumber.value}</span> : undefined}>
        <CasePath items={casePath(c, t)} current="waiting" label={t("pathAria")} />
      </Block>
      <p className="rp-note">{t("waitNote", { region: region.name, n: region.avgDays2026 })}</p>
      {suspended && <p className="rp-note">{t("clockSuspended")}</p>}
    </>
  );
}
