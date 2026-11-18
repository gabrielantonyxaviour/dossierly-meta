"use client";
import { ButtonLink, Pill } from "@/components/ui";
import type { CaseSnapshot } from "@/lib/case/types";
import { daysBetween, warsawToday } from "@/lib/case/next-step";
import { renewalPrepDate } from "@/lib/residence/dates";
import { useT } from "@/lib/i18n/client";
import { Block, CasePath, Fact, StatusLine } from "@/components/residence/parts";
import { memberRole, permitShort } from "./start/FamilyPlan";
import { casePath } from "./path";
import { shortDate } from "./format";

/* Stage 7 · Card and after: duties while the card is valid and the next renewal date for everyone in the household
   (a new application, prepared 3 months before the permit ends; family permits end with the sponsor's, art. 162). */

export function AfterStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const d = c.profile.decision;
  const today = warsawToday();
  const until = d?.validUntil ?? null;
  const prep = until ? renewalPrepDate(until) : null;
  const span = d?.cardCollectedOn && until ? Math.max(1, daysBetween(d.cardCollectedOn, until)) : 1;
  const pct = d?.cardCollectedOn && until ? (daysBetween(d.cardCollectedOn, today) / span) * 100 : 4;
  const work = c.profile.permitType === "temporary_residence_work" || c.profile.permitType === "temporary_residence_blue_card";
  const household = c.profile.household ?? [];
  return (
    <>
      <StatusLine word={t("validWord")} tone="ok" sub={prep ? t("renewSub", { date: shortDate(prep) }) : t("renewNoDate")} pct={pct}
        left={d?.cardCollectedOn ? t("collectedShort", { date: shortDate(d.cardCollectedOn) }) : t("today")} right={until ? t("cardEnds", { date: shortDate(until) }) : "—"} />
      {!until && <ButtonLink href="/app/residence/decision" variant="secondary" icon="calendar">{t("addValidUntil")}</ButtonLink>}
      <Block title={t("whileValid")}>
        <div className="rp-stack">
          {work ? <Fact icon="case" tone="warn" title={t("loseJob")} sub={t("loseJobSub")} />
            : <Fact icon="case" tone="warn" title={t("purposeEnds")} sub={t("purposeEndsSub")} />}
          <Fact icon="pin" tone="warn" title={t("moveHouse")} sub={t("moveHouseSub")} />
          <Fact icon="alert" title={t("cardLost")} sub={t("cardLostSub")} />
          <Fact icon="globe" tone="ok" title={t("travel")} sub={t("travelSub")} />
        </div>
      </Block>
      <Block title={t("household")}>
        <div className="rp-stack">
          <Fact icon="user" title={c.profile.fullName ?? t("you")} sub={t("roleYou", { permit: permitShort(t, c.profile.permitType) })}
            end={<Pill tone="ok">{prep ? t("prepFrom", { date: shortDate(prep) }) : t("cardCollectedPill")}</Pill>} />
          {household.map((m) => (
            <Fact key={m.id} icon="user" title={m.name} sub={memberRole(t, m)} end={<Pill tone="warn">{prep && m.permitType === "temporary_residence_family" ? t("prepFrom", { date: shortDate(prep) }) : t("ownDates")}</Pill>} />
          ))}
        </div>
        {household.length > 0 && <p className="rp-note">{t("familyEndsWithYours")}</p>}
      </Block>
      <Block title={t("wholeCase")}><CasePath items={casePath(c, t)} current="after" label={t("pathAria")} /></Block>
    </>
  );
}
