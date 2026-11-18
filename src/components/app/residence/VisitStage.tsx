"use client";
import { ButtonLink, EmptyState } from "@/components/ui";
import type { CaseSnapshot } from "@/lib/case/types";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import { useT } from "@/lib/i18n/client";
import { Activity, Block, Fact } from "@/components/residence/parts";
import { nextAppointment } from "@/lib/residence/stage";
import { timeLabel } from "../format";
import { shortDate } from "./format";

/* Stage 5 · Fingerprint visit: from the appointment the summons created (Look/inbox), what to bring, and the
   rehearse → visit plan → Counter tools. Missing the visit discontinues the case (art. 106i). */

export function VisitStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const appt = nextAppointment(c);
  if (!appt) {
    return (
      <>
        <EmptyState icon="calendar" title={t("noVisitTitle")} action={<ButtonLink href="/app/look" variant="primary" icon="scan">{t("readALetter")}</ButtonLink>}>{t("noVisitBody")}</EmptyState>
        <Block title={t("bring")}>
          <div className="rp-stack">
            <Fact icon="card" title={t("bringPassport")} sub={t("bringPassportSub")} />
            <Fact icon="letter" title={t("bringSummons")} sub={t("bringSummonsSub")} />
          </div>
        </Block>
      </>
    );
  }
  const day = warsawDate(appt.at);
  const left = daysBetween(warsawToday(), day);
  const where = [appt.location.name, appt.location.address].filter(Boolean).join(", ");
  return (
    <>
      <div className="rp-deadline">
        <div><span className="ui-meta">{shortDate(day)} · {timeLabel(appt.at)}</span><b>{where}</b></div>
        <div className="rp-deadline-left"><b className="ui-num">{left}</b><span>{left === 0 ? t("today") : left === 1 ? t("dayLeft") : t("daysLeft")}</span></div>
      </div>
      <div className="rp-callout tone-deadline">
        <b>{t("dontMiss")}</b>
        <span>{t("dontMissBody")}</span>
      </div>
      <Block title={t("bring")}>
        <div className="rp-stack">
          <Fact icon="card" tone="ok" title={t("bringPassport")} sub={t("bringPassportSub")} />
          <Fact icon="letter" tone="ok" title={t("bringSummons")} sub={t("bringSummonsSub")} />
        </div>
        {c.profile.voivodeship === "mazowieckie" && <p className="rp-note">{t("warsawCounter")}</p>}
      </Block>
      <Activity
        title={t("atCounter")}
        steps={[
          { state: "next", title: t("rehearse"), sub: t("rehearseSub") },
          { state: "next", title: t("visitPlan"), sub: t("visitPlanSub") },
          { state: "next", title: t("phoneFlat"), sub: t("phoneFlatSub") },
          { state: "next", title: t("wrapUp"), sub: t("wrapUpSub") },
        ]}
        foot={<span className="ui-meta">{t("counterFoot")}</span>}
      />
      <div className="rs-actions">
        <ButtonLink href="/app/rehearse" variant="secondary" icon="mic">{t("rehearse")}</ButtonLink>
        <ButtonLink href="/app/visit-plan" variant="secondary" icon="calendar">{t("visitPlan")}</ButtonLink>
        <ButtonLink href="/app/counter" variant="primary" icon="counter">{t("openCounter")}</ButtonLink>
      </div>
    </>
  );
}
