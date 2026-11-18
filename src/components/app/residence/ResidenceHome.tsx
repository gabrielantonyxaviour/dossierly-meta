"use client";
import { ButtonLink, Section } from "@/components/ui";
import type { NextStep } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { warsawToday } from "@/lib/case/next-step";
import { checklist } from "@/lib/residence/checklist";
import { appealDeadline, daysSinceFiling, daysToFile, fileByDate, renewalPrepDate, startByDate, waitShare } from "@/lib/residence/dates";
import { currentStage } from "@/lib/residence/stage";
import { useT } from "@/lib/i18n/client";
import { CasePath, StatusLine } from "@/components/residence/parts";
import { NextStepCard } from "../home/NextStepCard";
import { casePath, filedOn, regionOf } from "./path";
import { shortDate } from "./format";
import "@/components/residence/residence.css";
import "./residence-app.css";

/* Home, top: the stage the case is in, as one hero. Preparing: the file-by date. Filed: the waiting status line.
   An open letter deadline or a coming visit: the deadline hero (NextStepCard). Then the case path (Timeline-1). */

function Hero({ c, next }: { c: CaseSnapshot; next: NextStep | null }) {
  const t = useT("residence");
  const p = c.profile;
  const stage = currentStage(c);
  const today = warsawToday();
  const urgent = next && (next.kind === "deadline" || next.kind === "appointment") && next.daysLeft !== null && next.daysLeft <= 14;
  if (stage === "letter" || stage === "visit" || (urgent && stage !== "decision")) {
    return (
      <div className="rs-hero">
        <NextStepCard next={next} snapshot={c} />
        <ButtonLink href={`/app/residence/${stage === "visit" ? "visit" : "letter"}`} variant="secondary" iconEnd="forward">{stage === "visit" ? t("openVisit") : t("openLetter")}</ButtonLink>
      </div>
    );
  }
  if (stage === "start" || (!p.legalStayUntil && (stage === "prepare" || stage === "file"))) {
    return (
      <div className="rp-callout tone-user rs-hero">
        <b>{t("setupTitle")}</b>
        <span>{t("setupBody")}</span>
        <span className="rp-callout-hint"><ButtonLink href="/app/residence/start" variant="primary" iconEnd="forward">{t("setupCta")}</ButtonLink></span>
      </div>
    );
  }
  if (stage === "prepare" || stage === "file") {
    const items = checklist(c);
    const done = items.filter((i) => i.done).length;
    const left = daysToFile(p.legalStayUntil!, today);
    return (
      <div className="rs-hero">
        <StatusLine word={left >= 0 ? t("fileInDays", { n: left }) : t("fileByPassedWord")} tone={left <= 14 ? "deadline" : "user"}
          sub={t("homePrepareSub", { date: shortDate(fileByDate(p.legalStayUntil!)), done, total: items.length })}
          pct={(done / Math.max(1, items.length)) * 100} left={t("startBy", { date: shortDate(startByDate(p.legalStayUntil!)) })} right={t("fileByShort", { date: shortDate(fileByDate(p.legalStayUntil!)) })} />
        <div className="rs-hero-actions">
          <ButtonLink href="/app/residence/prepare" variant={stage === "prepare" ? "primary" : "secondary"} icon="prepare">{t("openChecklist")}</ButtonLink>
          <ButtonLink href="/app/residence/file" variant={stage === "file" ? "primary" : "secondary"} icon="send">{t("fileInMos")}</ButtonLink>
        </div>
      </div>
    );
  }
  if (stage === "waiting") {
    const filed = filedOn(c);
    const region = regionOf(c);
    const n = filed ? daysSinceFiling(filed, today) : 0;
    return (
      <div className="rs-hero">
        <StatusLine word={t("waitingWord")} sub={filed ? t("waitingSub") : t("noFilingDateBody")} pct={waitShare(n, region.avgDays2026) * 100}
          left={filed ? t("dayN", { n }) : "—"} right={t("avgDays", { n: region.avgDays2026 })} />
        <ButtonLink href="/app/residence/waiting" variant="secondary" iconEnd="forward">{t("whatYouCanDo")}</ButtonLink>
      </div>
    );
  }
  const d = p.decision;
  if (stage === "decision" && d?.outcome === "refused") {
    const appeal = appealDeadline(d.deliveredOn);
    return (
      <div className="rs-hero">
        <StatusLine word={t("refusedWord")} tone="deadline" sub={t("refusedSub", { date: shortDate(appeal.dueDate), n: Math.max(0, daysToFile(appeal.dueDate, today)) })} pct={100}
          left={t("deliveredShort", { date: shortDate(d.deliveredOn) })} right={t("appealBy", { date: shortDate(appeal.dueDate) })} />
        <ButtonLink href="/app/residence/decision" variant="primary" icon="help">{t("getHelp")}</ButtonLink>
      </div>
    );
  }
  if (stage === "decision") {
    return (
      <div className="rs-hero">
        <StatusLine word={d ? t("approvedWord") : t("decisionWord")} tone={d ? "ok" : "user"} sub={d ? t("homeCollect") : t("homeRecord")} pct={100} left="" right={d ? t("decidedShort", { date: shortDate(d.deliveredOn) }) : ""} />
        <ButtonLink href="/app/residence/decision" variant="primary" iconEnd="forward">{d ? t("collectCard") : t("recordDecision")}</ButtonLink>
      </div>
    );
  }
  const prep = d?.validUntil ? renewalPrepDate(d.validUntil) : null;
  return (
    <div className="rs-hero">
      <StatusLine word={t("validWord")} tone="ok" sub={prep ? t("renewSub", { date: shortDate(prep) }) : t("renewNoDate")} pct={4} left={t("today")} right={d?.validUntil ? t("cardEnds", { date: shortDate(d.validUntil) }) : "—"} />
      <ButtonLink href="/app/residence/after" variant="secondary" iconEnd="forward">{t("dutiesLink")}</ButtonLink>
    </div>
  );
}

export function ResidenceHero({ c, next }: { c: CaseSnapshot; next: NextStep | null }) {
  return <Hero c={c} next={next} />;
}

export function CasePathCard({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const stage = currentStage(c);
  if (stage === "start") return null;
  return (
    <Section title={t("pathTitle")} action={{ label: t(`stage_${stage}`), href: `/app/residence/${stage}` }}>
      <div className="rs-pathcard"><CasePath items={casePath(c, t)} current={stage} label={t("pathAria")} /></div>
    </Section>
  );
}
